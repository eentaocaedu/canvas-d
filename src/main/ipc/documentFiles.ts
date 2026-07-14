import { app, dialog, ipcMain } from 'electron'
import { execFile } from 'node:child_process'
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, extname, join } from 'node:path'
import { promisify } from 'node:util'
import type { FileResult } from './fileSystem'

const execFileAsync = promisify(execFile)

export interface OpenedDocument {
  kind: 'project' | 'svg' | 'vector' | 'image'
  name: string
  extension: string
  project?: unknown
  content?: string
  dataUrl?: string
  bytes?: Uint8Array
  convertedFrom?: 'eps'
}

const commonInkscapePaths = (): string[] => [
  process.env.INKSCAPE_PATH ?? '',
  join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Inkscape', 'bin', 'inkscape.exe'),
  join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'Inkscape', 'bin', 'inkscape.exe'),
  join(process.env.LOCALAPPDATA ?? app.getPath('appData'), 'Programs', 'Inkscape', 'bin', 'inkscape.exe')
].filter(Boolean)

let inkscapePromise: Promise<string | null> | null = null

const findInkscape = async (): Promise<string | null> => {
  if (inkscapePromise) return inkscapePromise
  inkscapePromise = (async () => {
    for (const path of commonInkscapePaths()) {
      try {
        await access(path)
        return path
      } catch {
        // Continue through known install locations.
      }
    }
    try {
      const { stdout } = await execFileAsync('where.exe', ['inkscape.exe'], { encoding: 'utf8', windowsHide: true })
      return stdout.split(/\r?\n/).map((value) => value.trim()).find(Boolean) ?? null
    } catch {
      return null
    }
  })()
  return inkscapePromise
}

const convertVectorPathToSvg = async (inputPath: string): Promise<string> => {
  const inkscape = await findInkscape()
  if (!inkscape) {
    throw new Error('Este EPS exige conversao vetorial. Instale o Inkscape para habilitar essa conversao; o Canvas D nao vai rasterizar o arquivo silenciosamente.')
  }
  const tempDir = await mkdtemp(join(tmpdir(), 'canvas-d-vector-'))
  const outputPath = join(tempDir, 'converted.svg')
  try {
    await execFileAsync(inkscape, [inputPath, '--export-type=svg', `--export-filename=${outputPath}`], { windowsHide: true, maxBuffer: 8 * 1024 * 1024, timeout: 120000 })
    return await readFile(outputPath, 'utf8')
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

const mimeForExtension = (extension: string): string => {
  if (extension === '.webp') return 'image/webp'
  if (extension === '.png') return 'image/png'
  return 'image/jpeg'
}

const openDocumentPath = async (path: string): Promise<FileResult<OpenedDocument>> => {
  const extension = extname(path).toLowerCase()
  const name = basename(path, extension)
  if (extension === '.pcanvas') return { ok: true, path, data: { kind: 'project', name, extension, project: JSON.parse(await readFile(path, 'utf8')) } }
  if (extension === '.svg') return { ok: true, path, data: { kind: 'svg', name, extension, content: await readFile(path, 'utf8') } }
  if (extension === '.ai') {
    return { ok: false, error: 'Arquivos AI proprietarios nao sao abertos diretamente. No Illustrator, exporte como SVG para preservar vetores e grupos e abra o SVG no Canvas D.' }
  }
  if (extension === '.eps') {
    return { ok: true, path, data: { kind: 'vector', name, extension, bytes: new Uint8Array(await readFile(path)), convertedFrom: 'eps' } }
  }
  if (extension === '.webp' || extension === '.png' || extension === '.jpg' || extension === '.jpeg') {
    const bytes = await readFile(path)
    return { ok: true, path, data: { kind: 'image', name, extension, dataUrl: `data:${mimeForExtension(extension)};base64,${bytes.toString('base64')}` } }
  }
  return { ok: false, error: `Formato ${extension || 'desconhecido'} nao suportado.` }
}

export const registerDocumentFileIpc = (): void => {
  ipcMain.handle('document:open', async (): Promise<FileResult<OpenedDocument>> => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Abrir no Canvas D',
        properties: ['openFile'],
        filters: [
          { name: 'Todos os formatos do Canvas D', extensions: ['pcanvas', 'svg', 'eps', 'webp', 'png', 'jpg', 'jpeg'] },
          { name: 'Projetos Canvas D', extensions: ['pcanvas'] },
          { name: 'Vetores editaveis', extensions: ['svg', 'eps'] },
          { name: 'Imagens', extensions: ['webp', 'png', 'jpg', 'jpeg'] }
        ]
      })
      if (result.canceled || result.filePaths.length === 0) return { canceled: true }
      return await openDocumentPath(result.filePaths[0])
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Nao foi possivel abrir o arquivo.' }
    }
  })

  ipcMain.handle('document:openPath', async (_event, path: string): Promise<FileResult<OpenedDocument>> => {
    try {
      return await openDocumentPath(path)
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Nao foi possivel abrir o arquivo.' }
    }
  })

  ipcMain.handle('document:chooseSavePath', async (_event, defaultName?: string): Promise<FileResult> => {
    const result = await dialog.showSaveDialog({
      title: 'Salvar como',
      defaultPath: defaultName ?? 'Sem titulo.pcanvas',
      filters: [
        { name: 'Projeto editavel Canvas D', extensions: ['pcanvas'] },
        { name: 'SVG vetorial editavel', extensions: ['svg'] },
        { name: 'EPS vetorial', extensions: ['eps'] },
        { name: 'WebP', extensions: ['webp'] },
        { name: 'PNG', extensions: ['png'] },
        { name: 'JPEG', extensions: ['jpg', 'jpeg'] }
      ]
    })
    return result.canceled || !result.filePath ? { canceled: true } : { ok: true, path: result.filePath }
  })

  ipcMain.handle('document:writeText', async (_event, payload: { path: string; content: string }): Promise<FileResult> => {
    try {
      await writeFile(payload.path, payload.content, 'utf8')
      return { ok: true, path: payload.path }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Nao foi possivel salvar o arquivo.' }
    }
  })

  ipcMain.handle('document:writeBytes', async (_event, payload: { path: string; bytes: Uint8Array }): Promise<FileResult> => {
    try {
      await writeFile(payload.path, Buffer.from(payload.bytes))
      return { ok: true, path: payload.path }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Nao foi possivel salvar o arquivo.' }
    }
  })

  ipcMain.handle('vector:convertBuffer', async (_event, payload: { name: string; bytes: Uint8Array }): Promise<FileResult<string>> => {
    const tempDir = await mkdtemp(join(tmpdir(), 'canvas-d-source-'))
    const inputPath = join(tempDir, basename(payload.name))
    try {
      await writeFile(inputPath, Buffer.from(payload.bytes))
      return { ok: true, data: await convertVectorPathToSvg(inputPath) }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Nao foi possivel converter o vetor.' }
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  ipcMain.handle('vector:writeEps', async (_event, payload: { path: string; svg: string }): Promise<FileResult> => {
    const inkscape = await findInkscape()
    if (!inkscape) return { ok: false, error: 'Salvar EPS exige o Inkscape instalado. O SVG continua disponivel sem dependencia externa.' }
    const tempDir = await mkdtemp(join(tmpdir(), 'canvas-d-eps-'))
    const inputPath = join(tempDir, 'source.svg')
    try {
      await writeFile(inputPath, payload.svg, 'utf8')
      await execFileAsync(inkscape, [inputPath, `--export-filename=${payload.path}`], { windowsHide: true, timeout: 120000, maxBuffer: 8 * 1024 * 1024 })
      return { ok: true, path: payload.path }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Nao foi possivel gerar o EPS.' }
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })
}
