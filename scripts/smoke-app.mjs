import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const packagedExe = process.env.CANVAS_D_EXE
const electronExe = join(root, 'node_modules', 'electron', 'dist', process.platform === 'win32' ? 'electron.exe' : 'electron')
const executable = packagedExe ? resolve(packagedExe) : electronExe
const port = 9400 + (process.pid % 200)
const tempWritePath = join(tmpdir(), `canvas-d-smoke-${process.pid}.txt`)
const tempProfilePath = join(tmpdir(), `canvas-d-smoke-profile-${process.pid}`)
const launchArgs = packagedExe
  ? [`--remote-debugging-port=${port}`, `--user-data-dir=${tempProfilePath}`]
  : [root, `--remote-debugging-port=${port}`, `--user-data-dir=${tempProfilePath}`]
const failures = []
const rendererErrors = []

const assert = (condition, message) => {
  if (!condition) failures.push(message)
}

const wait = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds))

const waitForTarget = async () => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`)
      const targets = await response.json()
      const page = targets.find((target) => target.type === 'page')
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl
    } catch {
      // Electron has not exposed the DevTools endpoint yet.
    }
    await wait(100)
  }
  throw new Error('Renderer DevTools endpoint did not become available.')
}

class CdpClient {
  constructor(url) {
    this.socket = new WebSocket(url)
    this.nextId = 0
    this.pending = new Map()
  }

  async connect() {
    await new Promise((resolvePromise, reject) => {
      this.socket.addEventListener('open', resolvePromise, { once: true })
      this.socket.addEventListener('error', reject, { once: true })
    })
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data)
      if (message.id) {
        const pending = this.pending.get(message.id)
        if (!pending) return
        this.pending.delete(message.id)
        if (message.error) pending.reject(new Error(message.error.message))
        else pending.resolve(message.result)
        return
      }
      if (message.method === 'Runtime.exceptionThrown') rendererErrors.push(message.params.exceptionDetails?.exception?.description ?? message.params.exceptionDetails?.text ?? 'Renderer exception')
      if (message.method === 'Log.entryAdded' && message.params.entry?.level === 'error') rendererErrors.push(message.params.entry.text)
    })
    await this.call('Runtime.enable')
    await this.call('Log.enable')
  }

  call(method, params = {}) {
    const id = ++this.nextId
    return new Promise((resolvePromise, reject) => {
      this.pending.set(id, { resolve: resolvePromise, reject })
      this.socket.send(JSON.stringify({ id, method, params }))
    })
  }

  async evaluate(expression, awaitPromise = false) {
    const result = await this.call('Runtime.evaluate', { expression, awaitPromise, returnByValue: true, userGesture: true })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
    return result.result?.value
  }

  close() {
    this.socket.close()
  }
}

const stopProcessTree = (child) => {
  if (!child || child.killed) return
  if (process.platform === 'win32') spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
  else child.kill('SIGKILL')
}

if (!existsSync(executable)) throw new Error(`Electron executable not found: ${executable}`)

const child = spawn(executable, launchArgs, { cwd: root, stdio: 'ignore', windowsHide: true })
let client

try {
  client = new CdpClient(await waitForTarget())
  await client.connect()
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const mounted = await client.evaluate(`Boolean(document.querySelector('#root')?.children.length && document.body.innerText.includes('Novo projeto'))`)
    if (mounted) break
    await wait(100)
  }

  const home = JSON.parse(await client.evaluate(`JSON.stringify({
    text: document.body.innerText,
    rootChildren: document.querySelector('#root')?.children.length ?? 0,
    apiMethods: Object.keys(window.canvasD ?? {}).sort()
  })`))
  assert(home.rootChildren === 1, 'Home did not mount a root view.')
  for (const text of ['Canvas D', 'Novo projeto', 'Abrir projeto', 'RECENTES']) assert(home.text.includes(text), `Home is missing: ${text}`)
  for (const method of ['openDocument', 'openDocumentPath', 'chooseSavePath', 'listFonts', 'exportWebp', 'exportVector', 'writeDocumentText', 'onOpenSettings']) assert(home.apiMethods.includes(method), `Preload API is missing: ${method}`)

  const ipc = JSON.parse(await client.evaluate(`(async () => {
    const recent = await window.canvasD.getRecentProjects()
    const fonts = await window.canvasD.listFonts()
    const write = await window.canvasD.writeDocumentText(${JSON.stringify(tempWritePath)}, 'canvas-d-smoke')
    return JSON.stringify({ recentIsArray: Array.isArray(recent), fontCount: fonts.length, write })
  })()`, true))
  assert(ipc.recentIsArray, 'Recent projects IPC did not return an array.')
  assert(ipc.fontCount > 0, 'Installed fonts IPC returned no fonts.')
  assert(ipc.write?.ok === true && existsSync(tempWritePath) && readFileSync(tempWritePath, 'utf8') === 'canvas-d-smoke', 'Document write IPC failed.')

  await client.evaluate(`(() => {
    window.__canvasDSmokeAlerts = []
    window.alert = (message) => window.__canvasDSmokeAlerts.push(String(message))
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent?.includes('Novo projeto'))
    button?.click()
    return Boolean(button)
  })()`)
  await wait(500)

  const newDialogText = await client.evaluate('document.body.innerText')
  for (const text of ['Como voce quer comecar?', 'Canvas infinito', 'Prancheta com tamanho']) assert(newDialogText.includes(text), `New-project dialog is missing: ${text}`)
  await client.evaluate(`([...document.querySelectorAll('button')].find((item) => item.textContent?.includes('Prancheta com tamanho'))?.click(), true)`)
  await wait(120)
  const artboardDialogText = await client.evaluate('document.body.innerText')
  for (const text of ['Pixels', 'Centimetros', 'Milimetros', 'Metros', 'Full HD', 'A4', 'DPI', 'Fundo da prancheta']) assert(artboardDialogText.toLowerCase().includes(text.toLowerCase()), `Artboard settings are missing: ${text}`)
  await client.evaluate(`([...document.querySelectorAll('button')].find((item) => item.textContent?.trim().startsWith('A4'))?.click(), true)`)
  await wait(100)
  assert((await client.evaluate('document.body.innerText')).includes('2.480 x 3.508 px'), 'A4 at 300 DPI did not convert to 2480 x 3508 px.')
  await client.evaluate(`([...document.querySelectorAll('button')].find((item) => item.textContent?.trim() === 'Centimetros')?.click(), true)`)
  await wait(100)
  const convertedA4 = JSON.parse(await client.evaluate(`JSON.stringify({ width: document.querySelector('input[aria-label="Largura"]')?.value, height: document.querySelector('input[aria-label="Altura"]')?.value })`))
  assert(convertedA4.width === '21' && convertedA4.height === '29.7', `A4 unit conversion to centimeters failed: ${JSON.stringify(convertedA4)}.`)
  const typedDocumentWidth = JSON.parse(await client.evaluate(`(async () => {
    const input = document.querySelector('input[aria-label="Largura"]')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(input, '20')
    input?.dispatchEvent(new Event('input', { bubbles: true }))
    input?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await new Promise((resolve) => setTimeout(resolve, 80))
    return JSON.stringify({ value: input?.value, preview: document.body.innerText })
  })()`, true))
  assert(typedDocumentWidth.value === '20' && typedDocumentWidth.preview.includes('2.362 x 3.508 px'), `Typed document width did not commit on Enter: ${JSON.stringify(typedDocumentWidth)}.`)
  await client.evaluate(`([...document.querySelectorAll('button')].find((item) => item.textContent?.includes('Canvas infinito') && !item.textContent?.includes('Criar'))?.click(), true)`)
  await wait(80)
  await client.evaluate(`([...document.querySelectorAll('button')].find((item) => item.textContent?.includes('Criar canvas infinito'))?.click(), true)`)
  await wait(500)

  const shell = JSON.parse(await client.evaluate(`JSON.stringify({ text: document.body.innerText, toolCount: document.querySelectorAll('button[title*="("]').length, canvasCount: document.querySelectorAll('canvas').length })`))
  for (const text of ['Arquivo', 'Exportar', 'Salvar', 'Ferramenta: select']) assert(shell.text.includes(text), `Workspace shell is missing: ${text}`)
  assert(shell.toolCount >= 15, `Expected at least 15 tools, found ${shell.toolCount}.`)
  assert(shell.canvasCount > 0, 'Konva canvas did not mount.')

  const toolTitles = ['Selecionar (V)', 'Mover canvas (H)', 'Frame (F)', 'Retangulo (R)', 'Elipse (O)', 'Losango (D)', 'Poligono (U)', 'Nota (N)', 'Linha (L)', 'Seta (A)', 'Caminho vetorial (B)', 'Texto (T)', 'Desenho livre (P)', 'Imagem (I)', 'Recortar imagem (C)']
  for (const title of toolTitles) {
    await client.evaluate(`(() => { const button = [...document.querySelectorAll('button')].find((item) => item.title === ${JSON.stringify(title)}); button?.click(); return Boolean(button) })()`)
    await wait(35)
    const active = await client.evaluate(`Boolean([...document.querySelectorAll('button')].find((item) => item.title === ${JSON.stringify(title)})?.classList.contains('is-active'))`)
    assert(active, `Tool did not activate: ${title}`)
  }

  await client.evaluate(`(() => { const button=[...document.querySelectorAll('button')].find((item)=>item.textContent?.trim().startsWith('Arquivo')); button?.click(); return Boolean(button) })()`)
  await wait(100)
  const fileMenu = await client.evaluate(`document.body.innerText.includes('Salvar como...') && document.body.innerText.includes('PCanvas, SVG, EPS, WebP, PNG ou JPEG')`)
  assert(fileMenu, 'File menu did not expose open/save formats.')
  await client.evaluate(`(() => { const button=[...document.querySelectorAll('button')].find((item)=>item.textContent?.trim().startsWith('Exportar')); button?.click(); return Boolean(button) })()`)
  await wait(100)
  const exportMenu = await client.evaluate(`document.body.innerText.includes('SVG editavel') && document.body.innerText.includes('EPS vetorial') && !document.body.innerText.includes('AI compativel') && document.body.innerText.includes('PNG') && document.body.innerText.includes('WebP')`)
  assert(exportMenu, 'Export menu did not expose the expected SVG/EPS/PNG/WebP formats.')
  await client.evaluate(`([...document.querySelectorAll('button')].find((item)=>item.textContent?.trim().startsWith('Exportar'))?.click(), true)`)
  await wait(80)

  const drawingResult = JSON.parse(await client.evaluate(`(async () => {
    const content = document.querySelector('.konvajs-content')
    const bounds = content.getBoundingClientRect()
    const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
    const activate = async (title) => {
      const button = [...document.querySelectorAll('button')].find((item) => item.title === title)
      button?.click()
      await wait(80)
      return Boolean(button)
    }
    const fire = (type, x, y, buttons, detail = 1) => {
      const clientX = bounds.left + x
      const clientY = bounds.top + y
      document.elementFromPoint(clientX, clientY)?.dispatchEvent(new MouseEvent(type, { view: window, bubbles: true, cancelable: true, clientX, clientY, button: 0, buttons, detail }))
    }
    const drag = async (title, start, end, intermediate = []) => {
      await activate(title)
      fire('mousedown', start[0], start[1], 1)
      await wait(70)
      for (const point of [...intermediate, end]) {
        fire('mousemove', point[0], point[1], 1)
        await wait(50)
      }
      fire('mouseup', end[0], end[1], 0)
      await wait(100)
    }

    const drawingTools = [
      ['Frame (F)', [60, 70], [160, 135]], ['Retangulo (R)', [220, 70], [330, 135]],
      ['Elipse (O)', [390, 70], [500, 135]], ['Losango (D)', [560, 70], [670, 135]],
      ['Poligono (U)', [730, 220], [840, 290]], ['Nota (N)', [60, 220], [170, 290]],
      ['Linha (L)', [230, 220], [340, 290]], ['Seta (A)', [400, 220], [510, 290]]
    ]
    for (const [title, start, end] of drawingTools) await drag(title, start, end)
    await drag('Desenho livre (P)', [570, 220], [700, 290], [[590, 230], [615, 255], [640, 235], [670, 275]])

    await activate('Caminho vetorial (B)')
    const vectorPoints = [[60, 390], [160, 390], [110, 475], [60, 390]]
    for (const point of vectorPoints) {
      fire('mousedown', point[0], point[1], 1)
      await wait(45)
      fire('mouseup', point[0], point[1], 0)
      await wait(45)
    }

    await drag('Texto (T)', [250, 400], [250, 400])
    await wait(100)
    const pointEditor = document.querySelector('textarea[aria-label="Editar texto livre"]')
    pointEditor?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }))
    await wait(100)
    await drag('Texto (T)', [430, 385], [650, 465])
    await wait(100)
    const paragraphEditor = document.querySelector('textarea[aria-label="Editar texto de paragrafo"]')
    paragraphEditor?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }))
    await wait(120)

    document.querySelector('button[title="Camadas"]')?.click()
    await wait(120)
    return JSON.stringify({
      layerCount: document.querySelectorAll('.layer-row').length,
      layerNames: [...document.querySelectorAll('.layer-row button[title^="Clique para selecionar"]')].map((button) => button.innerText.trim()),
      hasPointText: Boolean(pointEditor),
      hasParagraphText: Boolean(paragraphEditor)
    })
  })()`, true))
  assert(drawingResult.layerCount >= 12, `Drawing tools created only ${drawingResult.layerCount} layers: ${drawingResult.layerNames.join(', ')}.`)
  assert(drawingResult.hasPointText, 'Point text editor did not open.')
  assert(drawingResult.hasParagraphText, 'Paragraph text editor did not open.')

  const inspectorEditing = JSON.parse(await client.evaluate(`(async () => {
    const rectangle = [...document.querySelectorAll('.layer-row button[title^="Clique para selecionar"]')].find((button) => button.innerText.includes('Rectangle'))
    rectangle?.click()
    await new Promise((resolve) => setTimeout(resolve, 100))
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    const widthLabel = [...document.querySelectorAll('label.inspector-field')].find((label) => label.querySelector(':scope > span')?.textContent === 'W')
    const width = widthLabel?.querySelector('input')
    setter?.call(width, '137')
    width?.dispatchEvent(new Event('input', { bubbles: true }))
    width?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    const radius = document.querySelector('input[aria-label="Arredondamento"]')
    setter?.call(radius, '18')
    radius?.dispatchEvent(new Event('input', { bubbles: true }))
    radius?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await new Promise((resolve) => setTimeout(resolve, 120))
    return JSON.stringify({
      width: document.querySelector('label.inspector-field input[aria-label="W"]')?.value ?? width?.value,
      radius: document.querySelector('input[aria-label="Arredondamento"]')?.value,
      hasRadiusSlider: Boolean(document.querySelector('input[aria-label="Arredondamento slider"]')),
      text: document.body.innerText
    })
  })()`, true))
  assert(inspectorEditing.width === '137', `Inspector width did not commit typed value on Enter: ${JSON.stringify(inspectorEditing)}.`)
  assert(inspectorEditing.radius === '18' && inspectorEditing.hasRadiusSlider, `Rectangle rounding field/slider failed: ${JSON.stringify(inspectorEditing)}.`)
  assert(inspectorEditing.text.includes('Exportar') && inspectorEditing.text.includes('SVG') && inspectorEditing.text.includes('EPS') && !inspectorEditing.text.includes('AI*'), 'Selected-object export panel is incomplete.')

  const layerWheelScroll = JSON.parse(await client.evaluate(`(async () => {
    const row = document.querySelector('.layer-row')
    const scroller = row?.parentElement
    if (!row || !scroller) return JSON.stringify({ top: 0, hint: false })
    const draggedLayerId = row.dataset.layerId
    scroller.scrollTop = 0
    const bounds = row.getBoundingClientRect()
    const pointerId = 17
    row.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 1, clientX: bounds.left + 20, clientY: bounds.top + 20 }))
    document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, cancelable: true, pointerId, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 1, clientX: bounds.left + 28, clientY: bounds.top + 28 }))
    await new Promise((resolve) => setTimeout(resolve, 40))
    document.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 180, deltaMode: 0 }))
    await new Promise((resolve) => setTimeout(resolve, 60))
    const result = { top: scroller.scrollTop, hint: document.body.innerText.includes('Use a roda do mouse para rolar enquanto arrasta') }
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 0, clientX: bounds.left + 28, clientY: bounds.top + 28 }))
    await new Promise((resolve) => setTimeout(resolve, 80))
    result.orderChanged = document.querySelector('.layer-row')?.dataset.layerId !== draggedLayerId
    return JSON.stringify(result)
  })()`, true))
  assert(layerWheelScroll.top > 0 && layerWheelScroll.hint && layerWheelScroll.orderChanged, 'Mouse wheel scrolling or layer reorder failed during pointer drag.')
  if (process.env.CANVAS_D_SMOKE_DEBUG) console.log('smoke checkpoint: layer wheel')

  const inspectorLayout = JSON.parse(await client.evaluate(`(async () => {
    const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
    const card = (id) => document.querySelector('[data-inspector-card="' + id + '"]')
    const order = (id) => Number(getComputedStyle(card(id)).order)
    const initialOrder = { transform: order('transform'), identity: order('identity'), export: order('export') }

    const appearanceToggle = document.querySelector('button[aria-label="Recolher Aparencia"]')
    appearanceToggle?.click()
    await wait(60)
    const cardCollapsed = card('appearance')?.classList.contains('is-collapsed') && !card('appearance')?.querySelector('.inspector-card-content')
    document.querySelector('button[aria-label="Expandir Aparencia"]')?.click()

    const identityHeader = card('identity')?.querySelector('.inspector-card-header')
    const transformCard = card('transform')
    const transfer = new DataTransfer()
    identityHeader?.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: transfer }))
    transformCard?.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer }))
    transformCard?.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }))
    identityHeader?.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer: transfer }))
    await wait(80)
    const reordered = order('identity') < order('transform')
    document.querySelector('button[aria-label="Restaurar organizacao do painel"]')?.click()
    await wait(80)
    const restored = order('transform') < order('identity') && order('export') > order('appearance')

    const separator = document.querySelector('[aria-label="Redimensionar painel de propriedades"]')
    separator?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, clientX: window.innerWidth - 336 }))
    window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: window.innerWidth - 420 }))
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: window.innerWidth - 420 }))
    await wait(80)
    const savedWidth = JSON.parse(localStorage.getItem('canvas-d:inspector-layout') || '{}')?.state?.width

    document.querySelector('button[aria-label="Recolher painel de propriedades"]')?.click()
    await wait(80)
    const railVisible = Boolean(document.querySelector('.inspector-panel-collapsed'))
    document.querySelector('button[aria-label="Abrir Transformacao"]')?.click()
    await wait(80)
    const temporary = Boolean(document.querySelector('.inspector-panel.is-temporary'))
    const visibleTemporaryCards = [...document.querySelectorAll('.inspector-sortable-card')].filter((item) => getComputedStyle(item).display !== 'none').map((item) => item.dataset.inspectorCard)
    document.querySelector('.konvajs-content')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))
    await wait(80)
    const closedOnOutside = Boolean(document.querySelector('.inspector-panel-collapsed'))
    document.querySelector('button[aria-label="Abrir painel de propriedades"]')?.click()
    await wait(80)
    document.querySelector('button[aria-label="Restaurar organizacao do painel"]')?.click()
    return JSON.stringify({ initialOrder, cardCollapsed, reordered, restored, savedWidth, railVisible, temporary, visibleTemporaryCards, closedOnOutside })
  })()`, true))
  assert(inspectorLayout.initialOrder.transform < inspectorLayout.initialOrder.identity && inspectorLayout.initialOrder.export > inspectorLayout.initialOrder.identity, 'Default inspector card order is incorrect.')
  assert(inspectorLayout.cardCollapsed && inspectorLayout.reordered && inspectorLayout.restored, 'Inspector card collapse, drag ordering, or reset failed.')
  assert(inspectorLayout.savedWidth === 420, `Inspector width was not persisted after resize: ${inspectorLayout.savedWidth}.`)
  assert(inspectorLayout.railVisible && inspectorLayout.temporary && inspectorLayout.closedOnOutside && inspectorLayout.visibleTemporaryCards.length === 1 && inspectorLayout.visibleTemporaryCards[0] === 'transform', 'Collapsed inspector rail/popover behavior failed.')
  if (process.env.CANVAS_D_SMOKE_DEBUG) console.log('smoke checkpoint: inspector layout')

  const settingsResult = JSON.parse(await client.evaluate(`(async () => {
    const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
    ;[...document.querySelectorAll('button')].find((item) => item.textContent?.trim().startsWith('Arquivo'))?.click()
    await wait(50)
    ;[...document.querySelectorAll('button')].find((item) => item.textContent?.trim().startsWith('Configuracoes'))?.click()
    await wait(80)
    const dialog = document.querySelector('.settings-dialog')
    const themes = document.querySelectorAll('.settings-theme-card').length
    ;[...document.querySelectorAll('.settings-theme-card')].find((item) => item.textContent?.includes('OLED preto'))?.click()
    await wait(60)
    const oledApplied = document.documentElement.dataset.theme === 'oled'
    const savedTheme = JSON.parse(localStorage.getItem('canvas-d:app-settings') || '{}')?.state?.theme
    ;[...document.querySelectorAll('.settings-theme-card')].find((item) => item.textContent?.includes('Midnight azul'))?.click()
    ;[...document.querySelectorAll('button')].find((item) => item.textContent?.trim() === 'Concluido')?.click()
    await wait(60)
    return JSON.stringify({ dialog: Boolean(dialog), themes, oledApplied, savedTheme, restoredTheme: document.documentElement.dataset.theme })
  })()`, true))
  assert(settingsResult.dialog && settingsResult.themes === 5 && settingsResult.oledApplied && settingsResult.savedTheme === 'oled' && settingsResult.restoredTheme === 'midnight', `Settings dialog or persistent theme switching failed: ${JSON.stringify(settingsResult)}.`)
  if (process.env.CANVAS_D_SMOKE_DEBUG) console.log('smoke checkpoint: settings')

  const layersDocking = JSON.parse(await client.evaluate(`(async () => {
    const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
    if (!document.querySelector('button[title="Encaixar em Propriedades"]')) {
      document.querySelector('button[title="Camadas"]')?.click()
      await wait(60)
    }
    document.querySelector('button[title="Encaixar em Propriedades"]')?.click()
    await wait(100)
    const docked = Boolean(document.querySelector('[data-inspector-card="layers"]')) && Boolean(document.querySelector('button[title="Desencaixar camadas"]'))
    document.querySelector('button[title="Desencaixar camadas"]')?.click()
    await wait(100)
    const floatingButton = document.querySelector('button[title="Camadas"]')
    floatingButton?.click()
    await wait(60)
    document.querySelector('.konvajs-content')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))
    await wait(80)
    const autoClosed = Boolean(document.querySelector('button[title="Camadas"]'))
    document.querySelector('button[title="Camadas"]')?.click()
    await wait(60)
    return JSON.stringify({ docked, autoClosed, reopened: Boolean(document.querySelector('.layer-row')) })
  })()`, true))
  assert(layersDocking.docked && layersDocking.autoClosed && layersDocking.reopened, `Layers dock/undock or click-outside behavior failed: ${JSON.stringify(layersDocking)}.`)
  if (process.env.CANVAS_D_SMOKE_DEBUG) console.log('smoke checkpoint: layers docking')

  const importResult = JSON.parse(await client.evaluate(`(async () => {
    const drop = (file) => {
      const transfer = new DataTransfer()
      transfer.items.add(file)
      window.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer, clientX: 640, clientY: 420 }))
      window.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer, clientX: 640, clientY: 420 }))
    }
    drop(new File(['%PDF-1.4'], 'unsupported.ai', { type: 'application/pdf' }))
    await new Promise((resolve) => setTimeout(resolve, 120))
    drop(new File(['<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><path id="smoke-svg" d="M5 5 L115 5 L60 75 Z" fill="#f43f5e" stroke="#ffffff" stroke-width="2"/></svg>'], 'smoke.svg', { type: 'image/svg+xml' }))
    await new Promise((resolve) => setTimeout(resolve, 500))
    const eps = '%!PS-Adobe-3.0 EPSF-3.0\\n%%BoundingBox: 0 0 120 80\\nnewpath\\n5 5 moveto\\n115 5 lineto\\n60 75 lineto\\nclosepath\\n0.1 0.6 1 setrgbcolor\\nfill\\nshowpage\\n%%EOF'
    drop(new File([eps], 'smoke.eps', { type: 'application/postscript' }))
    for (let attempt = 0; attempt < 30 && !document.body.innerText.toLowerCase().includes('smoke - path'); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    const canvas = document.createElement('canvas'); canvas.width = 4; canvas.height = 4
    canvas.getContext('2d').fillRect(0, 0, 4, 4)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9))
    if (blob) drop(new File([blob], 'smoke.webp', { type: 'image/webp' }))
    await new Promise((resolve) => setTimeout(resolve, 650))
    return JSON.stringify({
      layerCount: document.querySelectorAll('.layer-row').length,
      text: document.body.innerText,
      alerts: window.__canvasDSmokeAlerts,
      hasWebpBlob: Boolean(blob)
    })
  })()`, true))
  assert(importResult.hasWebpBlob, 'Chromium could not encode the WebP smoke fixture.')
  assert(importResult.layerCount >= drawingResult.layerCount + 3, `SVG/EPS/WebP import created only ${importResult.layerCount - drawingResult.layerCount} additional layers.`)
  assert(importResult.text.includes('smoke-svg'), 'Native SVG path is missing from Layers.')
  assert(importResult.text.toLowerCase().includes('smoke - path'), 'Native EPS path is missing from Layers.')
  assert(importResult.alerts.length === 1 && importResult.alerts[0].includes('exporte como SVG'), `AI guidance or import alerts were unexpected: ${importResult.alerts.join(' | ')}`)

  const cropResult = JSON.parse(await client.evaluate(`(async () => {
    const fieldValue = (name) => {
      const label = [...document.querySelectorAll('label.inspector-field')].find((item) => item.querySelector(':scope > span')?.textContent === name)
      return Number(label?.querySelector('input')?.value)
    }
    const before = { width: fieldValue('W'), height: fieldValue('H') }
    const tool = [...document.querySelectorAll('button')].find((item) => item.title === 'Recortar imagem (C)')
    tool?.click()
    await new Promise((resolve) => setTimeout(resolve, 80))
    const content = document.querySelector('.konvajs-content')
    const bounds = content.getBoundingClientRect()
    const fire = (type, x, y, buttons) => document.elementFromPoint(bounds.left + x, bounds.top + y)?.dispatchEvent(new MouseEvent(type, { view: window, bubbles: true, cancelable: true, clientX: bounds.left + x, clientY: bounds.top + y, button: 0, buttons }))
    fire('mousedown', 550, 340, 1)
    await new Promise((resolve) => setTimeout(resolve, 70))
    fire('mousemove', 610, 400, 1)
    await new Promise((resolve) => setTimeout(resolve, 60))
    fire('mouseup', 610, 400, 0)
    await new Promise((resolve) => setTimeout(resolve, 180))
    return JSON.stringify({ before, after: { width: fieldValue('W'), height: fieldValue('H') } })
  })()`, true))
  assert(cropResult.before.width === 80 && cropResult.before.height === 80, `WebP import dimensions were unexpected: ${cropResult.before.width}x${cropResult.before.height}.`)
  assert(cropResult.after.width > 0 && cropResult.after.width < cropResult.before.width && cropResult.after.height > 0 && cropResult.after.height < cropResult.before.height, `Crop did not reduce the image: ${JSON.stringify(cropResult)}.`)

  const multiSelect = await client.evaluate(`(() => {
    const buttons = [...document.querySelectorAll('.layer-row button[title^="Clique para selecionar"]')]
    if (buttons.length < 2) return false
    buttons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    buttons[1].dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }))
    return true
  })()`)
  assert(multiSelect, 'Layers did not expose enough items for multi-selection.')
  await wait(200)
  const multiText = await client.evaluate('document.body.innerText')
  assert(multiText.includes('2 selecionado(s)'), 'Ctrl layer multi-selection did not select two items.')
  assert(multiText.toLowerCase().includes('aparencia conjunta') && multiText.includes('Fill (') && multiText.includes('Stroke ('), 'Multi-selection appearance controls did not render.')

  const appearancePatched = await client.evaluate(`(() => {
    const section = [...document.querySelectorAll('h3')].find((item) => item.textContent?.includes('Aparencia conjunta'))?.closest('.inspector-card')
    const colors = section ? [...section.querySelectorAll('input[type="color"]')] : []
    const width = section?.querySelector('input[type="number"]')
    const setValue = (input, value) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    }
    if (colors[0]) setValue(colors[0], '#22c55e')
    if (colors[1]) setValue(colors[1], '#0f172a')
    if (width) setValue(width, '5')
    return colors.length >= 2 && Boolean(width)
  })()`)
  assert(appearancePatched, 'Multi-selection fill/stroke controls could not be edited.')
  await wait(180)

  const beforeGroupCount = await client.evaluate(`document.querySelectorAll('.layer-row').length`)
  await client.evaluate(`([...document.querySelectorAll('button')].find((item) => item.textContent?.includes('Agrupar selecionados'))?.click(), true)`)
  await wait(180)
  const grouped = JSON.parse(await client.evaluate(`JSON.stringify({ count: document.querySelectorAll('.layer-row').length, text: document.body.innerText })`))
  assert(grouped.count === beforeGroupCount - 1 && grouped.text.includes('Group 2'), 'Grouping two selected layers failed.')
  await client.evaluate(`document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', ctrlKey: true, shiftKey: true, bubbles: true }))`)
  await wait(180)
  assert((await client.evaluate(`document.querySelectorAll('.layer-row').length`)) === beforeGroupCount, 'Ctrl+Shift+G did not ungroup the selection.')

  const clipboardResult = JSON.parse(await client.evaluate(`(async () => {
    const buttons = [...document.querySelectorAll('.layer-row button[title^="Clique para selecionar"]')]
    buttons[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await new Promise((resolve) => setTimeout(resolve, 80))
    buttons[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }))
    await new Promise((resolve) => setTimeout(resolve, 80))
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true }))
    await new Promise((resolve) => setTimeout(resolve, 80))
    const before = document.querySelectorAll('.layer-row').length
    const transfer = new DataTransfer()
    transfer.setData('text/plain', 'application/x-canvas-d-internal-objects')
    window.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: transfer }))
    await new Promise((resolve) => setTimeout(resolve, 180))
    const afterPaste = document.querySelectorAll('.layer-row').length
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }))
    await new Promise((resolve) => setTimeout(resolve, 180))
    const afterUndo = document.querySelectorAll('.layer-row').length
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true, bubbles: true }))
    await new Promise((resolve) => setTimeout(resolve, 180))
    return JSON.stringify({ before, afterPaste, afterUndo, afterRedo: document.querySelectorAll('.layer-row').length })
  })()`, true))
  assert(clipboardResult.afterPaste === clipboardResult.before + 2, `Internal paste precedence did not duplicate two layers: ${JSON.stringify(clipboardResult)}.`)
  assert(clipboardResult.afterUndo === clipboardResult.before && clipboardResult.afterRedo === clipboardResult.afterPaste, `Undo/redo around paste failed: ${JSON.stringify(clipboardResult)}.`)

  await client.evaluate(`document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', bubbles: true }))`)
  await wait(100)
  assert((await client.evaluate('document.body.innerText')).includes('Ferramenta: select'), 'V shortcut did not return to the Select tool.')

  await client.call('Page.enable')
  await client.call('Page.reload', { ignoreCache: true })
  await wait(1200)
  await client.evaluate(`([...document.querySelectorAll('button')].find((item) => item.textContent?.includes('Novo projeto'))?.click(), true)`)
  await wait(180)
  await client.evaluate(`([...document.querySelectorAll('button')].find((item) => item.textContent?.includes('Prancheta com tamanho'))?.click(), true)`)
  await wait(120)
  await client.evaluate(`([...document.querySelectorAll('button')].find((item) => item.textContent?.trim().startsWith('Full HD'))?.click(), true)`)
  await wait(100)
  await client.evaluate(`(() => {
    const setValue = (selector, value) => {
      const input = document.querySelector(selector)
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(input, value)
      input?.dispatchEvent(new Event('input', { bubbles: true }))
      input?.dispatchEvent(new Event('change', { bubbles: true }))
    }
    setValue('input[aria-label="Nome do projeto"]', 'Smoke Fixed')
    setValue('input[aria-label="Largura"]', '800')
    setValue('input[aria-label="Altura"]', '600')
  })()`)
  await wait(150)
  await client.evaluate(`([...document.querySelectorAll('button')].find((item) => item.textContent?.includes('Criar prancheta'))?.click(), true)`)
  await wait(500)
  const fixedProject = await client.evaluate('document.body.innerText')
  assert(fixedProject.includes('Smoke Fixed'), 'Configured project name was not applied.')
  assert(fixedProject.includes('800 x 600 px') && fixedProject.includes('800 x 600 px · 96 DPI'), 'Configured artboard dimensions were not preserved in the project inspector.')
  await client.evaluate(`document.querySelector('button[title="Camadas"]')?.click()`)
  await wait(120)
  const fixedLayers = JSON.parse(await client.evaluate(`JSON.stringify({ count: document.querySelectorAll('.layer-row').length, text: document.body.innerText })`))
  assert(fixedLayers.count === 1 && fixedLayers.text.includes('Prancheta 800 x 600 px'), 'Fixed-size project did not create one matching artboard.')

  await wait(250)
  assert(rendererErrors.length === 0, `Renderer emitted errors: ${rendererErrors.join(' | ')}`)
} finally {
  client?.close()
  stopProcessTree(child)
  rmSync(tempWritePath, { force: true })
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      rmSync(tempProfilePath, { recursive: true, force: true, maxRetries: 2, retryDelay: 60 })
      break
    } catch (error) {
      if (attempt === 11) console.warn(`Could not remove temporary smoke profile: ${error instanceof Error ? error.message : String(error)}`)
      else await wait(100)
    }
  }
}

if (failures.length > 0) {
  console.error(`Canvas D smoke failed (${failures.length}):`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Canvas D smoke passed: project modes, tools, text, vectors, raster metadata, inspector resize/order/collapse/rail persistence, settings/themes, Layers dock/auto-close/wheel-drag, clipboard, history, shortcuts, and renderer errors.')
