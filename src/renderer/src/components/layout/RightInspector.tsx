import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import {
  AlignCenter,
  Box,
  ChevronLeft,
  Circle,
  Copy,
  Crop,
  Diamond,
  Download,
  Eye,
  EyeOff,
  FileText,
  Frame,
  Hand,
  Hexagon,
  Image as ImageIcon,
  Layers3,
  Link2,
  Lock,
  Minus,
  MousePointer2,
  Move,
  MoveRight,
  Palette,
  PanelRightClose,
  PanelRightOpen,
  PenTool,
  Pencil,
  RotateCcw,
  SendToBack,
  SlidersHorizontal,
  Square,
  StickyNote,
  Trash2,
  Type,
  Unlock,
  Wrench,
  type LucideIcon
} from 'lucide-react'
import { getObjectBounds } from '@renderer/lib/bounds'
import { makeFrame, nextObjectZIndex } from '@renderer/lib/objectFactory'
import { measurePointText } from '@renderer/lib/textMetrics'
import { useProjectCommands } from '@renderer/hooks/useProjectCommands'
import { useCanvasStore } from '@renderer/store/useCanvasStore'
import { useHistoryStore } from '@renderer/store/useHistoryStore'
import { useWorkspaceStore } from '@renderer/store/useWorkspaceStore'
import { useAppSettingsStore } from '@renderer/store/useAppSettingsStore'
import { defaultInspectorWidth, maxInspectorWidth, minInspectorWidth, useInspectorLayoutStore, type InspectorCardId } from '@renderer/store/useInspectorLayoutStore'
import type { CanvasObject, CanvasTool, FrameObject, Point, TextObject, ToolStyle } from '@renderer/types/canvas'
import FontPicker from '@renderer/components/controls/FontPicker'
import NumberInput from '@renderer/components/controls/NumberInput'
import InspectorPanelCard from './InspectorPanelCard'
import LayersPanel from '@renderer/components/canvas/LayersPanel'

const framePresets: Array<{ label: string; width: number; height: number; preset: FrameObject['preset'] }> = [
  { label: 'Desktop 1440', width: 1440, height: 1024, preset: 'desktop' },
  { label: 'Desktop 1920', width: 1920, height: 1080, preset: 'desktop' },
  { label: 'Mobile', width: 390, height: 844, preset: 'mobile' },
  { label: 'Tablet', width: 768, height: 1024, preset: 'tablet' },
  { label: 'Instagram', width: 1080, height: 1350, preset: 'instagram' }
]

interface NumberFieldProps {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  onChange: (value: number) => void
}

const NumberField = ({ label, value, min, max, step = 0.1, onChange }: NumberFieldProps): JSX.Element => (
  <label className="inspector-field">
    <span>{label}</span>
    <NumberInput ariaLabel={label} value={value} min={min} max={max} step={step} onCommit={onChange} />
  </label>
)

const RangeNumberField = ({ label, value, min = 0, max = 100, step = 1, onChange }: NumberFieldProps): JSX.Element => (
  <div className="inspector-range-field">
    <div className="inspector-range-heading">
      <span>{label}</span>
      <NumberInput ariaLabel={label} value={value} min={min} max={max} step={step} onCommit={onChange} />
    </div>
    <input
      aria-label={`${label} slider`}
      type="range"
      min={min}
      max={max}
      step={step}
      value={Math.min(max, Math.max(min, value))}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  </div>
)

const toolMeta: Record<CanvasTool, { label: string; description: string; tone: string }> = {
  select: { label: 'Selecao', description: 'Selecione, mova e transforme objetos.', tone: 'blue' },
  pan: { label: 'Navegacao', description: 'Arraste o canvas sem alterar os objetos.', tone: 'slate' },
  frame: { label: 'Prancheta', description: 'Crie uma area de saida com tamanho definido.', tone: 'violet' },
  rect: { label: 'Retangulo', description: 'Forma com fill, contorno e cantos ajustaveis.', tone: 'cyan' },
  ellipse: { label: 'Elipse', description: 'Circulos e elipses com aparencia independente.', tone: 'cyan' },
  diamond: { label: 'Losango', description: 'Forma de decisao para fluxos e diagramas.', tone: 'cyan' },
  polygon: { label: 'Poligono', description: 'Forma regular com quantidade de lados configuravel.', tone: 'cyan' },
  note: { label: 'Nota', description: 'Bloco visual com dobra configuravel.', tone: 'amber' },
  line: { label: 'Linha', description: 'Segmentos com traco e extremidades configuraveis.', tone: 'emerald' },
  arrow: { label: 'Conector', description: 'Setas que podem se ligar e acompanhar objetos.', tone: 'emerald' },
  vector: { label: 'Caneta vetorial', description: 'Crie paths abertos ou fechados ponto a ponto.', tone: 'violet' },
  text: { label: 'Texto', description: 'Clique para texto livre ou arraste para paragrafo.', tone: 'rose' },
  freehand: { label: 'Desenho livre', description: 'Trace linhas organicas com suavidade ajustavel.', tone: 'amber' },
  image: { label: 'Imagem', description: 'Importe PNG, JPEG, WebP e SVG.', tone: 'blue' },
  crop: { label: 'Recorte', description: 'Defina a area visivel de uma imagem ou SVG.', tone: 'rose' }
}

const toolIcons: Record<CanvasTool, LucideIcon> = {
  select: MousePointer2,
  pan: Hand,
  frame: Frame,
  rect: Square,
  ellipse: Circle,
  diamond: Diamond,
  polygon: Hexagon,
  note: StickyNote,
  line: Minus,
  arrow: MoveRight,
  vector: PenTool,
  text: Type,
  freehand: Pencil,
  image: ImageIcon,
  crop: Crop
}

const inspectorCardMeta: Record<InspectorCardId, { title: string; icon: LucideIcon }> = {
  transform: { title: 'Transformacao', icon: Move },
  identity: { title: 'Camada', icon: FileText },
  appearance: { title: 'Aparencia', icon: Palette },
  typography: { title: 'Tipografia', icon: Type },
  connector: { title: 'Conector', icon: Link2 },
  path: { title: 'Path SVG', icon: PenTool },
  vector: { title: 'Path vetorial', icon: PenTool },
  freehand: { title: 'Traco livre', icon: Pencil },
  image: { title: 'Imagem e recorte', icon: ImageIcon },
  document: { title: 'Documento', icon: FileText },
  tool: { title: 'Ferramenta', icon: Wrench },
  guide: { title: 'Guia', icon: Move },
  multiAppearance: { title: 'Aparencia conjunta', icon: Palette },
  alignment: { title: 'Organizar', icon: AlignCenter },
  layers: { title: 'Camadas', icon: Layers3 },
  actions: { title: 'Acoes', icon: Layers3 },
  canvasActions: { title: 'Canvas', icon: Trash2 },
  export: { title: 'Exportar', icon: Download }
}

interface ColorFieldProps {
  label: string
  value: string
  allowNone?: boolean
  enabled?: boolean
  onChange: (value: string) => void
  onToggle?: (enabled: boolean) => void
}

const safeColor = (value: string, fallback = '#000000'): string => (/^#[0-9a-f]{6}$/i.test(value) ? value : fallback)

const inspectorHistoryWindow = (patch: Partial<CanvasObject>): number | null => {
  const keys = Object.keys(patch)
  if (keys.some((key) => key === 'locked' || key === 'visible')) return null
  if (keys.some((key) => key === 'fill' || key === 'stroke' || key === 'background')) return 30000
  return 1500
}

const inspectorHistoryKey = (id: string, patch: Partial<CanvasObject>): string => `inspector:${id}:${Object.keys(patch).sort().join('|')}`

const toolStyleFromObject = (object: CanvasObject): Partial<ToolStyle> => {
  if (object.type === 'text') {
    const patch: Partial<ToolStyle> = {
      fontFamily: object.fontFamily,
      fontSize: object.fontSize,
      fontWeight: object.fontWeight,
      fontStyle: object.fontStyle ?? 'normal',
      align: object.align,
      lineHeight: object.lineHeight,
      letterSpacing: object.letterSpacing ?? 0,
      textDecoration: object.textDecoration ?? 'none'
    }
    if (object.fill !== 'transparent') patch.textFill = object.fill
    return patch
  }

  const patch: Partial<ToolStyle> = {}
  if (object.type === 'frame') {
    patch.fill = object.background
    patch.fillEnabled = object.background !== 'transparent'
  }
  if (object.type === 'rect' || object.type === 'ellipse' || object.type === 'diamond' || object.type === 'polygon' || object.type === 'note' || object.type === 'vector' || object.type === 'path') {
    patch.fillEnabled = object.fill !== 'transparent'
    if (object.fill !== 'transparent') patch.fill = object.fill
  }
  if (object.type === 'rect') patch.radius = object.radius
  if (object.type === 'polygon') patch.polygonSides = object.sides
  if (object.type === 'note') patch.noteFoldSize = object.foldSize
  if (object.type === 'rect' || object.type === 'ellipse' || object.type === 'diamond' || object.type === 'polygon' || object.type === 'note' || object.type === 'line' || object.type === 'arrow' || object.type === 'vector' || object.type === 'path' || object.type === 'freehand') {
    patch.strokeEnabled = object.stroke !== 'transparent' && object.strokeWidth > 0
    if (object.stroke !== 'transparent') patch.stroke = object.stroke
    if (object.strokeWidth > 0) patch.strokeWidth = object.strokeWidth
  }
  if (object.type === 'line' || object.type === 'arrow' || object.type === 'vector' || object.type === 'path' || object.type === 'freehand') {
    patch.lineCap = object.lineCap ?? 'round'
    patch.strokePattern = object.strokePattern ?? 'solid'
  }
  if (object.type === 'arrow') {
    patch.pointerLength = object.pointerLength
    patch.pointerWidth = object.pointerWidth
    patch.pointerAtBeginning = object.pointerAtBeginning ?? false
    patch.pointerAtEnding = object.pointerAtEnding ?? true
    patch.arrowRouting = object.routing ?? 'straight'
  }
  if (object.type === 'freehand') patch.tension = object.tension
  if (object.type === 'vector') patch.tension = object.tension
  return patch
}

const withPointTextSize = (object: TextObject, patch: Partial<CanvasObject>): Partial<CanvasObject> => {
  const merged = { ...object, ...patch } as TextObject
  if ((merged.textMode ?? 'paragraph') !== 'point') return patch
  const size = measurePointText({
    text: merged.text,
    fontFamily: merged.fontFamily,
    fontSize: merged.fontSize,
    fontWeight: merged.fontWeight,
    fontStyle: merged.fontStyle,
    lineHeight: merged.lineHeight,
    letterSpacing: merged.letterSpacing
  })
  return { ...patch, ...size }
}

const ColorField = ({ label, value, allowNone = false, enabled = true, onChange, onToggle }: ColorFieldProps): JSX.Element => (
  <label className="inspector-field">
    <span>{label}</span>
    <span className="flex items-center gap-2">
      <input type="color" value={safeColor(value)} disabled={!enabled} onChange={(event) => onChange(event.target.value)} />
      {allowNone ? (
        <button type="button" className={`mini-toggle ${enabled ? '' : 'is-active'}`} onClick={() => onToggle?.(!enabled)}>
          sem
        </button>
      ) : null}
    </span>
  </label>
)

const RightInspector = (): JSX.Element => {
  const project = useWorkspaceStore((state) => state.project)
  const markDirty = useWorkspaceStore((state) => state.markDirty)
  const layersDocked = useAppSettingsStore((state) => state.layersDocked)
  const panelCollapsed = useInspectorLayoutStore((state) => state.panelCollapsed)
  const inspectorWidth = useInspectorLayoutStore((state) => state.width)
  const cardOrder = useInspectorLayoutStore((state) => state.cardOrder)
  const temporaryCard = useInspectorLayoutStore((state) => state.temporaryCard)
  const setPanelCollapsed = useInspectorLayoutStore((state) => state.setPanelCollapsed)
  const setInspectorWidth = useInspectorLayoutStore((state) => state.setWidth)
  const setCardCollapsed = useInspectorLayoutStore((state) => state.setCardCollapsed)
  const resetInspectorLayout = useInspectorLayoutStore((state) => state.resetLayout)
  const openTemporaryCard = useInspectorLayoutStore((state) => state.openTemporaryCard)
  const inspectorRef = useRef<HTMLElement>(null)
  const objects = useCanvasStore((state) => state.objects)
  const selectedIds = useCanvasStore((state) => state.selectedIds)
  const selectedGuideId = useCanvasStore((state) => state.selectedGuideId)
  const guides = useCanvasStore((state) => state.guides)
  const rulersVisible = useCanvasStore((state) => state.rulersVisible)
  const smartGuidesEnabled = useCanvasStore((state) => state.smartGuidesEnabled)
  const tool = useCanvasStore((state) => state.tool)
  const setTool = useCanvasStore((state) => state.setTool)
  const toolStyle = useCanvasStore((state) => state.toolStyle)
  const setToolStyle = useCanvasStore((state) => state.setToolStyle)
  const toggleRulers = useCanvasStore((state) => state.toggleRulers)
  const setSmartGuidesEnabled = useCanvasStore((state) => state.setSmartGuidesEnabled)
  const camera = useCanvasStore((state) => state.camera)
  const updateObject = useCanvasStore((state) => state.updateObject)
  const updateObjects = useCanvasStore((state) => state.updateObjects)
  const addObject = useCanvasStore((state) => state.addObject)
  const duplicateSelected = useCanvasStore((state) => state.duplicateSelected)
  const deleteSelected = useCanvasStore((state) => state.deleteSelected)
  const groupSelected = useCanvasStore((state) => state.groupSelected)
  const ungroupSelected = useCanvasStore((state) => state.ungroupSelected)
  const clearCanvas = useCanvasStore((state) => state.clearCanvas)
  const bringSelectedForward = useCanvasStore((state) => state.bringSelectedForward)
  const sendSelectedBackward = useCanvasStore((state) => state.sendSelectedBackward)
  const updateGuide = useCanvasStore((state) => state.updateGuide)
  const deleteSelectedGuide = useCanvasStore((state) => state.deleteSelectedGuide)
  const pushHistory = useHistoryStore((state) => state.push)
  const pushCoalescedHistory = useHistoryStore((state) => state.pushCoalesced)
  const { exportSelectedFrame, exportSelectedSvg, exportSelectedVector } = useProjectCommands()
  const selectedObject = selectedIds.length === 1 ? objects.find((object) => object.id === selectedIds[0]) : null
  const selectedObjects = objects.filter((object) => selectedIds.includes(object.id))
  const selectedGuide = selectedGuideId ? guides.find((guide) => guide.id === selectedGuideId) : null

  const metaForCard = (id: InspectorCardId): { title: string; icon: LucideIcon } => {
    if (id === 'tool') return { title: toolMeta[tool].label, icon: toolIcons[tool] }
    return inspectorCardMeta[id]
  }

  const beginInspectorResize = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (panelCollapsed || event.button !== 0) return
    event.preventDefault()
    document.body.classList.add('is-resizing-inspector')
    const onPointerMove = (moveEvent: PointerEvent): void => setInspectorWidth(window.innerWidth - moveEvent.clientX)
    const onPointerUp = (): void => {
      document.body.classList.remove('is-resizing-inspector')
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  useEffect(() => {
    if (selectedObject) setToolStyle(toolStyleFromObject(selectedObject))
  }, [selectedObject, setToolStyle])

  useEffect(() => {
    if (!temporaryCard) return
    const closeOnOutsideClick = (event: PointerEvent): void => {
      if (!inspectorRef.current?.contains(event.target as Node)) openTemporaryCard(null)
    }
    window.addEventListener('pointerdown', closeOnOutsideClick)
    return () => window.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [openTemporaryCard, temporaryCard])

  const snapshot = (): void => pushHistory({ camera, objects, guides })

  const patchSelected = (patch: Partial<CanvasObject>): void => {
    if (!selectedObject || (selectedObject.locked && !('locked' in patch))) return
    let nextPatch = selectedObject.type === 'text' ? withPointTextSize(selectedObject, patch) : patch
    if (selectedObject.type === 'image' && selectedObject.lockAspectRatio !== false && selectedObject.naturalWidth > 0 && selectedObject.naturalHeight > 0) {
      const ratio = selectedObject.crop ? selectedObject.crop.width / selectedObject.crop.height : selectedObject.naturalWidth / selectedObject.naturalHeight
      if ('width' in patch && typeof patch.width === 'number') nextPatch = { ...nextPatch, height: patch.width / ratio }
      else if ('height' in patch && typeof patch.height === 'number') nextPatch = { ...nextPatch, width: patch.height * ratio }
    }
    if (selectedObject.type === 'text' && patch.textMode === 'paragraph') {
      nextPatch = {
        ...nextPatch,
        width: Math.max(240, selectedObject.width),
        height: Math.max(selectedObject.height, selectedObject.fontSize * selectedObject.lineHeight * 4)
      }
    }
    const coalesceWindow = inspectorHistoryWindow(nextPatch)
    if (coalesceWindow === null) {
      snapshot()
    } else {
      pushCoalescedHistory(inspectorHistoryKey(selectedObject.id, nextPatch), { camera, objects, guides }, coalesceWindow)
    }
    updateObject(selectedObject.id, nextPatch)
    markDirty()
  }

  const runAction = (action: () => void): void => {
    snapshot()
    action()
    markDirty()
  }

  const runMultiObjectAction = (action: () => Array<{ id: string; patch: Partial<CanvasObject> }>): void => {
    const updates = action()
    if (updates.length === 0) return
    snapshot()
    updateObjects(updates)
    markDirty()
  }

  const alignSelection = (mode: 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom'): void => {
    runMultiObjectAction(() => {
      const unlocked = selectedObjects.filter((object) => !object.locked)
      const bounds = unlocked.map((object) => ({ object, bounds: getObjectBounds(object) }))
      if (bounds.length < 2) return []
      const left = Math.min(...bounds.map((item) => item.bounds.x))
      const right = Math.max(...bounds.map((item) => item.bounds.x + item.bounds.width))
      const centerX = (left + right) / 2
      const top = Math.min(...bounds.map((item) => item.bounds.y))
      const bottom = Math.max(...bounds.map((item) => item.bounds.y + item.bounds.height))
      const centerY = (top + bottom) / 2

      return bounds.map(({ object, bounds: objectBounds }) => {
        let dx = 0
        let dy = 0
        if (mode === 'left') dx = left - objectBounds.x
        if (mode === 'centerX') dx = centerX - (objectBounds.x + objectBounds.width / 2)
        if (mode === 'right') dx = right - (objectBounds.x + objectBounds.width)
        if (mode === 'top') dy = top - objectBounds.y
        if (mode === 'centerY') dy = centerY - (objectBounds.y + objectBounds.height / 2)
        if (mode === 'bottom') dy = bottom - (objectBounds.y + objectBounds.height)
        return { id: object.id, patch: { x: object.x + dx, y: object.y + dy } as Partial<CanvasObject> }
      })
    })
  }

  const distributeSelection = (axis: 'horizontal' | 'vertical'): void => {
    runMultiObjectAction(() => {
      const unlocked = selectedObjects.filter((object) => !object.locked)
      if (unlocked.length < 3) return []
      const bounds = unlocked
        .map((object) => ({ object, bounds: getObjectBounds(object) }))
        .sort((a, b) => (axis === 'horizontal' ? a.bounds.x - b.bounds.x : a.bounds.y - b.bounds.y))
      const first = bounds[0]
      const last = bounds[bounds.length - 1]
      const start = axis === 'horizontal' ? first.bounds.x : first.bounds.y
      const end = axis === 'horizontal' ? last.bounds.x + last.bounds.width : last.bounds.y + last.bounds.height
      const totalSize = bounds.reduce((sum, item) => sum + (axis === 'horizontal' ? item.bounds.width : item.bounds.height), 0)
      const gap = (end - start - totalSize) / (bounds.length - 1)
      let cursor = start

      return bounds.map(({ object, bounds: objectBounds }, index) => {
        if (index === 0 || index === bounds.length - 1) {
          cursor += (axis === 'horizontal' ? objectBounds.width : objectBounds.height) + gap
          return { id: object.id, patch: {} }
        }
        const delta = cursor - (axis === 'horizontal' ? objectBounds.x : objectBounds.y)
        cursor += (axis === 'horizontal' ? objectBounds.width : objectBounds.height) + gap
        return {
          id: object.id,
          patch: axis === 'horizontal' ? ({ x: object.x + delta } as Partial<CanvasObject>) : ({ y: object.y + delta } as Partial<CanvasObject>)
        }
      })
    })
  }

  const createPresetFrame = (preset: (typeof framePresets)[number]): void => {
    const origin: Point = { x: Math.round((-camera.x + 120) / camera.zoom), y: Math.round((-camera.y + 80) / camera.zoom) }
    runAction(() => addObject(makeFrame(origin, preset.width, preset.height, nextObjectZIndex(objects), preset.preset, toolStyle.fillEnabled ? toolStyle.fill : 'transparent')))
  }

  const patchGuide = (id: string, patch: Parameters<typeof updateGuide>[1]): void => {
    pushCoalescedHistory(`guide:${id}:${Object.keys(patch).sort().join('|')}`, { camera, objects, guides }, 1500)
    updateGuide(id, patch)
    markDirty()
  }

  const patchMultipleAppearance = (property: 'fill' | 'stroke' | 'strokeWidth', value: string | number): void => {
    runMultiObjectAction(() =>
      selectedObjects.flatMap((object) => {
        if (object.locked) return []
        if (property === 'fill') {
          if (object.type === 'frame') return [{ id: object.id, patch: { background: value as string } as Partial<CanvasObject> }]
          if ('fill' in object) return [{ id: object.id, patch: { fill: value as string } as Partial<CanvasObject> }]
          return []
        }
        if (property === 'stroke' && 'stroke' in object) return [{ id: object.id, patch: { stroke: value as string } as Partial<CanvasObject> }]
        if (property === 'strokeWidth' && 'strokeWidth' in object) return [{ id: object.id, patch: { strokeWidth: value as number } as Partial<CanvasObject> }]
        return []
      })
    )
    if (property === 'fill' && typeof value === 'string' && value !== 'transparent') setToolStyle({ fill: value, fillEnabled: true })
    if (property === 'stroke' && typeof value === 'string' && value !== 'transparent') setToolStyle({ stroke: value, strokeEnabled: true })
    if (property === 'strokeWidth' && typeof value === 'number') setToolStyle({ strokeWidth: value, strokeEnabled: value > 0 })
  }

  const renderToolContext = (): JSX.Element | null => {
    if (tool === 'select' || tool === 'pan') return null

    if (tool === 'frame') {
      return (
        <div className="space-y-3 pt-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">Ferramenta Frame</h3>
          <ColorField label="Background" value={toolStyle.fill} onChange={(fill) => setToolStyle({ fill, fillEnabled: true })} />
          <div className="grid grid-cols-2 gap-2">
            {framePresets.map((preset) => (
              <button key={`${preset.label}-${preset.width}`} className="compact-button" onClick={() => createPresetFrame(preset)}>
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )
    }

    if (tool === 'rect' || tool === 'ellipse' || tool === 'diamond' || tool === 'polygon' || tool === 'note') {
      const toolLabel = tool === 'rect' ? 'Retangulo' : tool === 'ellipse' ? 'Elipse' : tool === 'diamond' ? 'Losango' : tool === 'polygon' ? 'Poligono' : 'Nota'
      return (
        <div className="space-y-2 pt-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">Ferramenta {toolLabel}</h3>
          <ColorField
            label="Fill"
            value={toolStyle.fill}
            allowNone
            enabled={toolStyle.fillEnabled}
            onToggle={(fillEnabled) => setToolStyle({ fillEnabled })}
            onChange={(fill) => setToolStyle({ fill, fillEnabled: true })}
          />
          <ColorField
            label="Stroke"
            value={toolStyle.stroke}
            allowNone
            enabled={toolStyle.strokeEnabled}
            onToggle={(strokeEnabled) => setToolStyle({ strokeEnabled })}
            onChange={(stroke) => setToolStyle({ stroke, strokeEnabled: true })}
          />
          <NumberField label="Espessura" value={toolStyle.strokeWidth} min={0} max={64} onChange={(strokeWidth) => setToolStyle({ strokeWidth })} />
          {tool === 'rect' ? <RangeNumberField label="Arredondamento" value={toolStyle.radius} min={0} max={240} step={1} onChange={(radius) => setToolStyle({ radius })} /> : null}
          {tool === 'polygon' ? <NumberField label="Lados" value={toolStyle.polygonSides} min={3} max={12} step={1} onChange={(polygonSides) => setToolStyle({ polygonSides })} /> : null}
          {tool === 'note' ? <NumberField label="Dobra" value={toolStyle.noteFoldSize} min={0} max={160} step={1} onChange={(noteFoldSize) => setToolStyle({ noteFoldSize })} /> : null}
        </div>
      )
    }

    if (tool === 'vector') {
      return (
        <div className="space-y-2 pt-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">Caminho vetorial</h3>
          <div className="rounded-lg border border-border bg-surface/60 px-2 py-2 text-[11px] leading-4 text-muted">
            Clique para criar pontos. Shift restringe a 45°. Clique no primeiro ponto para fechar ou Enter para finalizar aberto.
          </div>
          <ColorField
            label="Fill"
            value={toolStyle.fill}
            allowNone
            enabled={toolStyle.fillEnabled}
            onToggle={(fillEnabled) => setToolStyle({ fillEnabled })}
            onChange={(fill) => setToolStyle({ fill, fillEnabled: true })}
          />
          <ColorField
            label="Stroke"
            value={toolStyle.stroke}
            allowNone
            enabled={toolStyle.strokeEnabled}
            onToggle={(strokeEnabled) => setToolStyle({ strokeEnabled })}
            onChange={(stroke) => setToolStyle({ stroke, strokeEnabled: true })}
          />
          <NumberField label="Espessura" value={toolStyle.strokeWidth} min={0} max={64} onChange={(strokeWidth) => setToolStyle({ strokeWidth })} />
          <label className="inspector-field">
            <span>Traco</span>
            <select className="inspector-input" value={toolStyle.strokePattern} onChange={(event) => setToolStyle({ strokePattern: event.target.value as ToolStyle['strokePattern'] })}>
              <option value="solid">Solido</option>
              <option value="dashed">Tracejado</option>
              <option value="dotted">Pontilhado</option>
            </select>
          </label>
        </div>
      )
    }

    if (tool === 'line' || tool === 'arrow' || tool === 'freehand') {
      return (
        <div className="space-y-2 pt-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">Ferramenta {tool}</h3>
          <ColorField
            label="Stroke"
            value={toolStyle.stroke}
            allowNone
            enabled={toolStyle.strokeEnabled}
            onToggle={(strokeEnabled) => setToolStyle({ strokeEnabled })}
            onChange={(stroke) => setToolStyle({ stroke, strokeEnabled: true })}
          />
          <NumberField label="Espessura" value={toolStyle.strokeWidth} min={0} max={64} onChange={(strokeWidth) => setToolStyle({ strokeWidth })} />
          <label className="inspector-field">
            <span>Traco</span>
            <select className="inspector-input" value={toolStyle.strokePattern} onChange={(event) => setToolStyle({ strokePattern: event.target.value as ToolStyle['strokePattern'] })}>
              <option value="solid">Solido</option>
              <option value="dashed">Tracejado</option>
              <option value="dotted">Pontilhado</option>
            </select>
          </label>
          <label className="inspector-field">
            <span>Extremidade</span>
            <select className="inspector-input" value={toolStyle.lineCap} onChange={(event) => setToolStyle({ lineCap: event.target.value as ToolStyle['lineCap'] })}>
              <option value="round">Redonda</option>
              <option value="butt">Reta</option>
              <option value="square">Quadrada</option>
            </select>
          </label>
          {tool === 'freehand' ? <NumberField label="Tension" value={toolStyle.tension} min={0} max={1} step={0.05} onChange={(tension) => setToolStyle({ tension })} /> : null}
          {tool === 'arrow' ? (
            <>
              <button
                type="button"
                className={`compact-button w-full ${toolStyle.arrowAutoBind ? 'is-active' : 'is-inactive'}`}
                onClick={() => setToolStyle({ arrowAutoBind: !toolStyle.arrowAutoBind })}
              >
                {toolStyle.arrowAutoBind ? 'Conexao automatica ligada' : 'Conexao automatica desligada'}
              </button>
              <NumberField label="Ponta L" value={toolStyle.pointerLength} min={1} max={80} onChange={(pointerLength) => setToolStyle({ pointerLength })} />
              <NumberField label="Ponta W" value={toolStyle.pointerWidth} min={1} max={80} onChange={(pointerWidth) => setToolStyle({ pointerWidth })} />
              <label className="inspector-field">
                <span>Rota</span>
                <select className="inspector-input" value={toolStyle.arrowRouting} onChange={(event) => setToolStyle({ arrowRouting: event.target.value as ToolStyle['arrowRouting'] })}>
                  <option value="straight">Direta</option>
                  <option value="elbow">Ortogonal</option>
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={`compact-button ${toolStyle.pointerAtBeginning ? 'is-active' : 'is-inactive'}`}
                  onClick={() => setToolStyle({ pointerAtBeginning: !toolStyle.pointerAtBeginning })}
                >
                  Ponta inicial
                </button>
                <button
                  type="button"
                  className={`compact-button ${toolStyle.pointerAtEnding ? 'is-active' : 'is-inactive'}`}
                  onClick={() => setToolStyle({ pointerAtEnding: !toolStyle.pointerAtEnding })}
                >
                  Ponta final
                </button>
              </div>
            </>
          ) : null}
        </div>
      )
    }

    if (tool === 'text') {
      return (
        <div className="space-y-2 pt-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">Ferramenta Texto</h3>
          <div className="rounded-lg border border-border bg-surface/60 px-2 py-2 text-[11px] leading-4 text-muted">
            Clique para texto livre. Clique e arraste para criar uma caixa de paragrafo.
          </div>
          <FontPicker value={toolStyle.fontFamily} onChange={(fontFamily) => setToolStyle({ fontFamily })} />
          <ColorField label="Cor" value={toolStyle.textFill} onChange={(textFill) => setToolStyle({ textFill })} />
          <NumberField label="Tamanho" value={toolStyle.fontSize} min={4} max={400} step={1} onChange={(fontSize) => setToolStyle({ fontSize })} />
          <label className="inspector-field">
            <span>Peso</span>
            <select className="inspector-input" value={toolStyle.fontWeight} onChange={(event) => setToolStyle({ fontWeight: event.target.value })}>
              <option value="100">Thin</option>
              <option value="200">Extra light</option>
              <option value="300">Light</option>
              <option value="400">Regular</option>
              <option value="500">Medium</option>
              <option value="600">Semibold</option>
              <option value="700">Bold</option>
              <option value="800">Extra bold</option>
              <option value="900">Black</option>
            </select>
          </label>
          <button
            type="button"
            className={`compact-button w-full ${toolStyle.fontStyle === 'italic' ? 'is-active' : 'is-inactive'}`}
            onClick={() => setToolStyle({ fontStyle: toolStyle.fontStyle === 'italic' ? 'normal' : 'italic' })}
          >
            Italico
          </button>
          <label className="inspector-field">
            <span>Alinhar</span>
            <select className="inspector-input" value={toolStyle.align} onChange={(event) => setToolStyle({ align: event.target.value as TextObject['align'] })}>
              <option value="left">Esquerda</option>
              <option value="center">Centro</option>
              <option value="right">Direita</option>
              <option value="justify">Justificado</option>
            </select>
          </label>
          <NumberField label="Entrelinha" value={toolStyle.lineHeight} min={0.6} max={4} step={0.05} onChange={(lineHeight) => setToolStyle({ lineHeight })} />
          <NumberField label="Tracking" value={toolStyle.letterSpacing} min={-20} max={100} step={0.5} onChange={(letterSpacing) => setToolStyle({ letterSpacing })} />
          <label className="inspector-field">
            <span>Decoracao</span>
            <select
              className="inspector-input"
              value={toolStyle.textDecoration}
              onChange={(event) => setToolStyle({ textDecoration: event.target.value as ToolStyle['textDecoration'] })}
            >
              <option value="none">Nenhuma</option>
              <option value="underline">Sublinhado</option>
              <option value="line-through">Tachado</option>
            </select>
          </label>
        </div>
      )
    }

    if (tool === 'crop') {
      return (
        <div className="space-y-2 pt-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">Ferramenta Recorte</h3>
          <div className="rounded-lg border border-border bg-surface/60 px-2 py-2 text-[11px] leading-4 text-muted">
            Clique e arraste dentro de uma imagem para definir a area que deve permanecer. Funciona tambem com SVG.
          </div>
        </div>
      )
    }

    if (tool === 'image') {
      return (
        <div className="space-y-2 pt-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">Ferramenta Imagem</h3>
          <div className="text-xs leading-5 text-muted">Clique no canvas para importar PNG, JPG, JPEG ou WEBP no centro da viewport.</div>
        </div>
      )
    }

    return null
  }

  const renderExportPanel = (): JSX.Element => (
    <InspectorPanelCard id="export" title="Exportar" icon={<Download size={15} />} className="inspector-export-card">
      <p className="inspector-help">
        PNG, JPEG e WebP respeitam o tamanho exato da prancheta e o DPI do projeto. Vetores permanecem escalaveis.
      </p>
      <div className="grid grid-cols-3 gap-2">
        <button className="compact-button" onClick={() => void exportSelectedFrame(1, 'png')}>PNG</button>
        <button className="compact-button" onClick={() => void exportSelectedFrame(1, 'jpeg')}>JPEG</button>
        <button className="compact-button" onClick={() => void exportSelectedFrame(1, 'webp')}>WebP</button>
        <button className="compact-button" onClick={() => void exportSelectedSvg()}>SVG</button>
        <button className="compact-button" onClick={() => void exportSelectedVector('eps')}>EPS</button>
      </div>
    </InspectorPanelCard>
  )

  const renderDockedLayersPanel = (): JSX.Element | null => layersDocked ? (
    <InspectorPanelCard id="layers" title="Camadas" icon={<Layers3 size={15} />}>
      <LayersPanel mode="docked" />
    </InspectorPanelCard>
  ) : null

  const toolContext = renderToolContext()
  const multiHasAppearance = selectedObjects.some((object) => !object.locked && (object.type === 'frame' || 'fill' in object || ('stroke' in object && 'strokeWidth' in object)))
  const contextualCardIds: InspectorCardId[] = selectedGuide
    ? ['guide']
    : selectedIds.length === 0
      ? ['document', ...(toolContext ? (['tool'] as InspectorCardId[]) : []), 'canvasActions']
      : selectedObject
        ? [
            'transform',
            'identity',
            'appearance',
            ...(selectedObject.type === 'arrow' ? (['connector'] as InspectorCardId[]) : []),
            ...(selectedObject.type === 'freehand' ? (['freehand'] as InspectorCardId[]) : []),
            ...(selectedObject.type === 'vector' ? (['vector'] as InspectorCardId[]) : []),
            ...(selectedObject.type === 'path' ? (['path'] as InspectorCardId[]) : []),
            ...(selectedObject.type === 'text' ? (['typography'] as InspectorCardId[]) : []),
            ...(selectedObject.type === 'image' ? (['image'] as InspectorCardId[]) : []),
            'actions',
            'export'
          ]
        : [...(multiHasAppearance ? (['multiAppearance'] as InspectorCardId[]) : []), 'alignment', 'export']
  const visibleCardIds: InspectorCardId[] = [...contextualCardIds, ...(layersDocked ? (['layers'] as InspectorCardId[]) : [])]
  const orderedVisibleCards = [...visibleCardIds].sort((left, right) => cardOrder.indexOf(left) - cardOrder.indexOf(right))

  if (panelCollapsed && !temporaryCard) {
    return (
      <aside ref={inspectorRef} className="inspector-panel inspector-panel-collapsed border-l border-border bg-panel" aria-label="Propriedades recolhidas">
        <button type="button" className="inspector-rail-button is-primary" title="Abrir painel de propriedades" aria-label="Abrir painel de propriedades" onClick={() => { openTemporaryCard(null); setPanelCollapsed(false) }}>
          <PanelRightOpen size={18} />
        </button>
        <div className="inspector-rail-divider" />
        {orderedVisibleCards.map((id) => {
          const meta = metaForCard(id)
          const Icon = meta.icon
          return (
            <button
              key={id}
              type="button"
              className="inspector-rail-button"
              title={`Abrir ${meta.title}`}
              aria-label={`Abrir ${meta.title}`}
              onClick={() => {
                setCardCollapsed(id, false)
                openTemporaryCard(id)
              }}
            >
              <Icon size={17} />
            </button>
          )
        })}
      </aside>
    )
  }

  return (
    <aside ref={inspectorRef} className={`inspector-panel relative min-w-0 overflow-y-auto border-l border-border bg-panel ${temporaryCard ? 'is-temporary' : ''}`} style={{ width: inspectorWidth }}>
      <div
        className="inspector-resize-handle"
        role="separator"
        aria-label="Redimensionar painel de propriedades"
        aria-orientation="vertical"
        title="Arraste para redimensionar; clique duplo para restaurar"
        onPointerDown={beginInspectorResize}
        onDoubleClick={() => setInspectorWidth(defaultInspectorWidth)}
      />
      <div className="inspector-sticky-header">
        <div>
          <span className="inspector-eyebrow">Painel lateral</span>
          <h2>Propriedades</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inspector-context-badge">
            {selectedGuide ? 'Guia' : selectedIds.length > 1 ? `${selectedIds.length} itens` : selectedObject?.type ?? toolMeta[tool].label}
          </span>
          <button type="button" className="inspector-header-button" title="Restaurar organizacao do painel" aria-label="Restaurar organizacao do painel" onClick={resetInspectorLayout}>
            <RotateCcw size={14} />
          </button>
          <button type="button" className="inspector-header-button" title="Recolher painel de propriedades" aria-label="Recolher painel de propriedades" onClick={() => temporaryCard ? openTemporaryCard(null) : setPanelCollapsed(true)}>
            <PanelRightClose size={15} />
          </button>
        </div>
      </div>
      <div className="p-3">
      {selectedGuide ? (
        <div className="inspector-card-stack text-sm text-muted">
          <InspectorPanelCard id="guide" title="Guia" icon={<Move size={15} />} accessory={selectedGuide.orientation}>
            <div className="space-y-3">
              <NumberField label="Posicao" value={selectedGuide.position} onChange={(position) => patchGuide(selectedGuide.id, { position })} />
              <button className={`compact-button w-full ${selectedGuide.locked ? 'is-active' : 'is-inactive'}`} onClick={() => patchGuide(selectedGuide.id, { locked: !selectedGuide.locked })}>
                {selectedGuide.locked ? <Unlock size={14} /> : <Lock size={14} />}
                {selectedGuide.locked ? 'Desbloquear guia' : 'Bloquear guia'}
              </button>
              <button className={`compact-button w-full ${selectedGuide.visible ? 'is-active' : 'is-inactive'}`} onClick={() => patchGuide(selectedGuide.id, { visible: !selectedGuide.visible })}>
                {selectedGuide.visible ? <EyeOff size={14} /> : <Eye size={14} />}
                {selectedGuide.visible ? 'Ocultar guia' : 'Mostrar guia'}
              </button>
              <button
                className="compact-button is-danger w-full"
                onClick={() => {
                  snapshot()
                  deleteSelectedGuide()
                  markDirty()
                }}
              >
                <Trash2 size={14} />
                Remover guia
              </button>
            </div>
          </InspectorPanelCard>
          {renderDockedLayersPanel()}
        </div>
      ) : selectedIds.length === 0 ? (
        <div className="inspector-card-stack text-sm text-muted">
          <InspectorPanelCard id="document" title="Documento" icon={<FileText size={15} />} accessory={`${objects.length} itens`}>
          <div className="space-y-3">
          <div className="inspector-row">
            <span>Projeto</span>
            <span className="text-white">{project?.name}</span>
          </div>
          <div className="inspector-row">
            <span>Objetos</span>
            <span className="text-white">{objects.length}</span>
          </div>
          <div className="inspector-row">
            <span>Canvas</span>
            <span className="text-right text-white">
              {project?.setup?.mode === 'artboard'
                ? `${project.setup.width} x ${project.setup.height} ${project.setup.unit}`
                : 'Infinito'}
            </span>
          </div>
          {project?.setup?.mode === 'artboard' ? (
            <div className="inspector-row">
              <span>Saida</span>
              <span className="text-right text-white">{project.setup.pixelWidth} x {project.setup.pixelHeight} px · {project.setup.dpi} DPI</span>
            </div>
          ) : null}
          <div className="inspector-row">
            <span>Zoom</span>
            <span className="text-white">{Math.round(camera.zoom * 100)}%</span>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button className={`compact-button ${rulersVisible ? 'is-active' : 'is-inactive'}`} onClick={toggleRulers}>
              Reguas
            </button>
            <button className={`compact-button ${smartGuidesEnabled ? 'is-active' : 'is-inactive'}`} onClick={() => setSmartGuidesEnabled(!smartGuidesEnabled)}>
              Snap
            </button>
          </div>
          <div className="inspector-row">
            <span>Guias</span>
            <span className="text-white">{guides.length}</span>
          </div>
          </div>
          </InspectorPanelCard>
          {toolContext ? (
            <InspectorPanelCard id="tool" title={toolMeta[tool].label} icon={(() => { const ToolIcon = toolIcons[tool]; return <ToolIcon size={15} /> })()}>
              <div className={`inspector-tool-hero tone-${toolMeta[tool].tone}`}>
                <span className="inspector-eyebrow">Ferramenta ativa</span>
                <strong>{toolMeta[tool].label}</strong>
                <p>{toolMeta[tool].description}</p>
              </div>
              <div className="inspector-tool-options">{toolContext}</div>
            </InspectorPanelCard>
          ) : null}
          <InspectorPanelCard id="canvasActions" title="Canvas" icon={<Trash2 size={15} />}>
            <button
              className="compact-button is-danger w-full"
              onClick={() => {
                if (window.confirm('Limpar todos os objetos do canvas?')) runAction(clearCanvas)
              }}
            >
              Limpar canvas
            </button>
          </InspectorPanelCard>
          {renderDockedLayersPanel()}
        </div>
      ) : selectedObject ? (
        <div className="inspector-card-stack text-sm text-muted">
          <InspectorPanelCard id="identity" title="Camada" icon={<Box size={15} />} accessory={selectedObject.type}>
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium text-white">{selectedObject.name}</span>
              <span className="rounded-md border border-border px-2 py-1 text-[11px]">{selectedObject.type}</span>
            </div>
            <input
              className="inspector-input w-full"
              value={selectedObject.name}
              onChange={(event) => patchSelected({ name: event.target.value })}
              disabled={selectedObject.locked}
            />
          </InspectorPanelCard>

          <InspectorPanelCard id="transform" title="Transformacao" icon={<Move size={15} />} accessory="px">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="X" value={selectedObject.x} onChange={(x) => patchSelected({ x })} />
              <NumberField label="Y" value={selectedObject.y} onChange={(y) => patchSelected({ y })} />
              <NumberField label="W" value={selectedObject.width} min={1} onChange={(width) => patchSelected({ width })} />
              <NumberField label="H" value={selectedObject.height} min={1} onChange={(height) => patchSelected({ height })} />
              <NumberField label="Rot" value={selectedObject.rotation} onChange={(rotation) => patchSelected({ rotation })} />
              <NumberField label="Opac." value={selectedObject.opacity} min={0} max={1} step={0.05} onChange={(opacity) => patchSelected({ opacity })} />
            </div>
          </InspectorPanelCard>

          <InspectorPanelCard id="appearance" title="Aparencia" icon={<Palette size={15} />}>
          <div className="space-y-3">
          {'background' in selectedObject ? <ColorField label="Background" value={selectedObject.background} onChange={(background) => patchSelected({ background })} /> : null}
          {'fill' in selectedObject ? (
            <ColorField
              label={selectedObject.type === 'text' ? 'Cor' : 'Fill'}
              value={selectedObject.fill}
              allowNone
              enabled={selectedObject.fill !== 'transparent'}
              onToggle={(enabled) => patchSelected({ fill: enabled ? (selectedObject.type === 'text' ? toolStyle.textFill : toolStyle.fill) : 'transparent' })}
              onChange={(fill) => patchSelected({ fill })}
            />
          ) : null}
          {'stroke' in selectedObject ? (
            <ColorField
              label="Stroke"
              value={selectedObject.stroke}
              allowNone
              enabled={selectedObject.stroke !== 'transparent' && (!('strokeWidth' in selectedObject) || selectedObject.strokeWidth > 0)}
              onToggle={(enabled) => patchSelected({ stroke: enabled ? toolStyle.stroke : 'transparent', ...('strokeWidth' in selectedObject ? { strokeWidth: enabled ? toolStyle.strokeWidth : 0 } : {}) })}
              onChange={(stroke) => patchSelected({ stroke })}
            />
          ) : null}
          {'strokeWidth' in selectedObject ? (
            <NumberField label="Stroke width" value={selectedObject.strokeWidth} min={0} onChange={(strokeWidth) => patchSelected({ strokeWidth })} />
          ) : null}
          {selectedObject.type === 'line' || selectedObject.type === 'arrow' || selectedObject.type === 'vector' || selectedObject.type === 'path' || selectedObject.type === 'freehand' ? (
            <>
              <label className="inspector-field">
                <span>Traco</span>
                <select
                  className="inspector-input"
                  value={selectedObject.strokePattern ?? 'solid'}
                  onChange={(event) => patchSelected({ strokePattern: event.target.value as ToolStyle['strokePattern'] })}
                >
                  <option value="solid">Solido</option>
                  <option value="dashed">Tracejado</option>
                  <option value="dotted">Pontilhado</option>
                </select>
              </label>
              <label className="inspector-field">
                <span>Extremidade</span>
                <select
                  className="inspector-input"
                  value={selectedObject.lineCap ?? 'round'}
                  onChange={(event) => patchSelected({ lineCap: event.target.value as ToolStyle['lineCap'] })}
                >
                  <option value="round">Redonda</option>
                  <option value="butt">Reta</option>
                  <option value="square">Quadrada</option>
                </select>
              </label>
            </>
          ) : null}
          {selectedObject.type === 'rect' ? (
            <RangeNumberField
              label="Arredondamento"
              value={selectedObject.radius}
              min={0}
              max={Math.max(0, Math.min(selectedObject.width, selectedObject.height) / 2)}
              step={1}
              onChange={(radius) => patchSelected({ radius, cornerRadii: [radius, radius, radius, radius] })}
            />
          ) : null}
          {selectedObject.type === 'polygon' ? <NumberField label="Lados" value={selectedObject.sides} min={3} max={12} step={1} onChange={(sides) => patchSelected({ sides: Math.round(sides) })} /> : null}
          {selectedObject.type === 'note' ? <NumberField label="Dobra" value={selectedObject.foldSize} min={0} max={Math.min(selectedObject.width, selectedObject.height) / 2} step={1} onChange={(foldSize) => patchSelected({ foldSize })} /> : null}
          </div>
          </InspectorPanelCard>
          {selectedObject.type === 'arrow' ? (
            <InspectorPanelCard id="connector" title="Conector" icon={<Link2 size={15} />}>
              <div className="space-y-3">
              <NumberField label="Ponta L" value={selectedObject.pointerLength} min={1} max={160} onChange={(pointerLength) => patchSelected({ pointerLength })} />
              <NumberField label="Ponta W" value={selectedObject.pointerWidth} min={1} max={160} onChange={(pointerWidth) => patchSelected({ pointerWidth })} />
              <label className="inspector-field">
                <span>Rota</span>
                <select className="inspector-input" value={selectedObject.routing ?? 'straight'} onChange={(event) => patchSelected({ routing: event.target.value as ToolStyle['arrowRouting'] })}>
                  <option value="straight">Direta</option>
                  <option value="elbow">Ortogonal</option>
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={`compact-button ${selectedObject.pointerAtBeginning ?? false ? 'is-active' : 'is-inactive'}`}
                  onClick={() => patchSelected({ pointerAtBeginning: !(selectedObject.pointerAtBeginning ?? false) })}
                >
                  Ponta inicial
                </button>
                <button
                  type="button"
                  className={`compact-button ${selectedObject.pointerAtEnding ?? true ? 'is-active' : 'is-inactive'}`}
                  onClick={() => patchSelected({ pointerAtEnding: !(selectedObject.pointerAtEnding ?? true) })}
                >
                  Ponta final
                </button>
              </div>
              {selectedObject.startBinding || selectedObject.endBinding ? (
                <button type="button" className="compact-button w-full" onClick={() => patchSelected({ startBinding: undefined, endBinding: undefined })}>
                  Desconectar dos objetos
                </button>
              ) : null}
              </div>
            </InspectorPanelCard>
          ) : null}
          {selectedObject.type === 'freehand' ? (
            <InspectorPanelCard id="freehand" title="Traco livre" icon={<Pencil size={15} />}><RangeNumberField label="Suavidade" value={selectedObject.tension} min={0} max={1} step={0.05} onChange={(tension) => patchSelected({ tension })} /></InspectorPanelCard>
          ) : null}
          {selectedObject.type === 'vector' ? (
            <InspectorPanelCard id="vector" title="Path vetorial" icon={<PenTool size={15} />}>
              <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className={`compact-button ${selectedObject.closed ? 'is-active' : 'is-inactive'}`}
                onClick={() => patchSelected({ closed: !selectedObject.closed, fill: !selectedObject.closed && toolStyle.fillEnabled ? toolStyle.fill : 'transparent' })}
              >
                {selectedObject.closed ? 'Fechado' : 'Aberto'}
              </button>
              <NumberField label="Curva" value={selectedObject.tension} min={0} max={1} step={0.05} onChange={(tension) => patchSelected({ tension })} />
              </div>
            </InspectorPanelCard>
          ) : null}
          {selectedObject.type === 'path' ? (
            <InspectorPanelCard id="path" title="Path SVG" icon={<PenTool size={15} />}>
              <div className="space-y-2">
              <label className="inspector-field">
                <span>Regra de fill</span>
                <select className="inspector-input" value={selectedObject.fillRule ?? 'nonzero'} onChange={(event) => patchSelected({ fillRule: event.target.value as 'nonzero' | 'evenodd' })}>
                  <option value="nonzero">Non-zero</option>
                  <option value="evenodd">Even-odd</option>
                </select>
              </label>
              <label className="block text-[11px] text-muted">
                <span className="mb-1 block">SVG path</span>
                <textarea className="inspector-input min-h-20 w-full resize-y font-mono text-[10px]" value={selectedObject.data} onChange={(event) => patchSelected({ data: event.target.value })} />
              </label>
              <div className="text-[10px] leading-4 text-muted">Os pontos e alcas Bezier aparecem diretamente no canvas.</div>
              </div>
            </InspectorPanelCard>
          ) : null}

          {selectedObject.type === 'text' ? (
            <InspectorPanelCard id="typography" title="Tipografia" icon={<Type size={15} />}>
              <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={`compact-button ${(selectedObject.textMode ?? 'paragraph') === 'point' ? 'is-active' : 'is-inactive'}`}
                  onClick={() => patchSelected({ textMode: 'point' })}
                >
                  Texto livre
                </button>
                <button
                  type="button"
                  className={`compact-button ${(selectedObject.textMode ?? 'paragraph') === 'paragraph' ? 'is-active' : 'is-inactive'}`}
                  onClick={() => patchSelected({ textMode: 'paragraph' })}
                >
                  Paragrafo
                </button>
              </div>
              <FontPicker value={selectedObject.fontFamily} onChange={(fontFamily) => patchSelected({ fontFamily })} />
              <NumberField label="Tamanho" value={selectedObject.fontSize} min={1} max={400} step={1} onChange={(fontSize) => patchSelected({ fontSize })} />
              <label className="inspector-field">
                <span>Peso</span>
                <select className="inspector-input" value={selectedObject.fontWeight} onChange={(event) => patchSelected({ fontWeight: event.target.value })}>
                  <option value="100">Thin</option>
                  <option value="200">Extra light</option>
                  <option value="300">Light</option>
                  <option value="400">Regular</option>
                  <option value="500">Medium</option>
                  <option value="600">Semibold</option>
                  <option value="700">Bold</option>
                  <option value="800">Extra bold</option>
                  <option value="900">Black</option>
                </select>
              </label>
              <button
                type="button"
                className={`compact-button w-full ${(selectedObject.fontStyle ?? 'normal') === 'italic' ? 'is-active' : 'is-inactive'}`}
                onClick={() => patchSelected({ fontStyle: (selectedObject.fontStyle ?? 'normal') === 'italic' ? 'normal' : 'italic' })}
              >
                Italico
              </button>
              <label className="inspector-field">
                <span>Alinhar</span>
                <select className="inspector-input" value={selectedObject.align} onChange={(event) => patchSelected({ align: event.target.value as TextObject['align'] })}>
                  <option value="left">Esquerda</option>
                  <option value="center">Centro</option>
                  <option value="right">Direita</option>
                  <option value="justify">Justificado</option>
                </select>
              </label>
              <NumberField label="Entrelinha" value={selectedObject.lineHeight} min={0.6} max={4} step={0.05} onChange={(lineHeight) => patchSelected({ lineHeight })} />
              <NumberField label="Tracking" value={selectedObject.letterSpacing ?? 0} min={-20} max={100} step={0.5} onChange={(letterSpacing) => patchSelected({ letterSpacing })} />
              <label className="inspector-field">
                <span>Decoracao</span>
                <select
                  className="inspector-input"
                  value={selectedObject.textDecoration ?? 'none'}
                  onChange={(event) => patchSelected({ textDecoration: event.target.value as TextObject['textDecoration'] })}
                >
                  <option value="none">Nenhuma</option>
                  <option value="underline">Sublinhado</option>
                  <option value="line-through">Tachado</option>
                </select>
              </label>
              </div>
            </InspectorPanelCard>
          ) : null}

          {selectedObject.type === 'image' ? (
            <InspectorPanelCard id="image" title="Imagem e recorte" icon={<ImageIcon size={15} />}>
              <div className="space-y-3">
              <div className="inspector-row text-xs">
                <span>Original</span>
                <span className="text-white">{selectedObject.naturalWidth} × {selectedObject.naturalHeight}</span>
              </div>
              {selectedObject.isVector ? <div className="rounded-md border border-border px-2 py-1 text-[11px] text-white">SVG vetorial</div> : null}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={`compact-button ${selectedObject.lockAspectRatio !== false ? 'is-active' : 'is-inactive'}`}
                  onClick={() => patchSelected({ lockAspectRatio: selectedObject.lockAspectRatio === false })}
                >
                  Proporcao
                </button>
                <button type="button" className="compact-button" onClick={() => patchSelected({ width: selectedObject.naturalWidth, height: selectedObject.naturalHeight })}>
                  Tamanho original
                </button>
                <button type="button" className="compact-button" onClick={() => setTool('crop')}>
                  Recortar
                </button>
                <button type="button" className="compact-button" disabled={!selectedObject.crop} onClick={() => patchSelected({ crop: undefined })}>
                  Remover recorte
                </button>
              </div>
              </div>
            </InspectorPanelCard>
          ) : null}

          {renderExportPanel()}

          <InspectorPanelCard id="actions" title="Acoes" icon={<Layers3 size={15} />}>
            <div className="grid grid-cols-2 gap-2">
            <button className="compact-button" onClick={() => runAction(duplicateSelected)}>
              <Copy size={14} />
              Duplicar
            </button>
            <button className="compact-button" onClick={() => runAction(deleteSelected)}>
              <Trash2 size={14} />
              Deletar
            </button>
            <button className={`compact-button ${selectedObject.locked ? 'is-active' : 'is-inactive'}`} onClick={() => patchSelected({ locked: !selectedObject.locked })}>
              {selectedObject.locked ? <Unlock size={14} /> : <Lock size={14} />}
              {selectedObject.locked ? 'Unlock' : 'Lock'}
            </button>
            <button className={`compact-button ${selectedObject.visible ? 'is-active' : 'is-inactive'}`} onClick={() => patchSelected({ visible: !selectedObject.visible })}>
              {selectedObject.visible ? <EyeOff size={14} /> : <Eye size={14} />}
              {selectedObject.visible ? 'Hide' : 'Show'}
            </button>
            <button className="compact-button" onClick={() => runAction(bringSelectedForward)}>
              <RotateCcw size={14} />
              Frente
            </button>
            <button className="compact-button" onClick={() => runAction(sendSelectedBackward)}>
              <SendToBack size={14} />
              Tras
            </button>
            {selectedObject.type === 'group' ? (
              <button className="compact-button col-span-2" onClick={() => runAction(ungroupSelected)}>
                Desagrupar
              </button>
            ) : null}
            </div>
          </InspectorPanelCard>
          {renderDockedLayersPanel()}
        </div>
      ) : (
        <div className="inspector-card-stack text-sm text-muted">
          {(() => {
            const fillTargets = selectedObjects.filter((object) => !object.locked && (object.type === 'frame' || 'fill' in object))
            const strokeTargets = selectedObjects.filter((object) => !object.locked && 'stroke' in object && 'strokeWidth' in object)
            const firstFill = fillTargets[0]?.type === 'frame' ? fillTargets[0].background : fillTargets[0] && 'fill' in fillTargets[0] ? fillTargets[0].fill : toolStyle.fill
            const firstStroke = strokeTargets[0] && 'stroke' in strokeTargets[0] ? strokeTargets[0].stroke : toolStyle.stroke
            const firstStrokeWidth = strokeTargets[0] && 'strokeWidth' in strokeTargets[0] ? strokeTargets[0].strokeWidth : toolStyle.strokeWidth
            return fillTargets.length > 0 || strokeTargets.length > 0 ? (
              <InspectorPanelCard id="multiAppearance" title="Aparencia conjunta" icon={<Palette size={15} />}>
                <div className="space-y-3">
                {fillTargets.length > 0 ? (
                  <ColorField
                    label={`Fill (${fillTargets.length})`}
                    value={firstFill}
                    allowNone
                    enabled={fillTargets.some((object) => (object.type === 'frame' ? object.background : 'fill' in object ? object.fill : 'transparent') !== 'transparent')}
                    onToggle={(enabled) => patchMultipleAppearance('fill', enabled ? toolStyle.fill : 'transparent')}
                    onChange={(fill) => patchMultipleAppearance('fill', fill)}
                  />
                ) : null}
                {strokeTargets.length > 0 ? (
                  <>
                    <ColorField
                      label={`Stroke (${strokeTargets.length})`}
                      value={firstStroke}
                      allowNone
                      enabled={strokeTargets.some((object) => 'stroke' in object && object.stroke !== 'transparent' && object.strokeWidth > 0)}
                      onToggle={(enabled) => {
                        patchMultipleAppearance('stroke', enabled ? toolStyle.stroke : 'transparent')
                        if (enabled) patchMultipleAppearance('strokeWidth', Math.max(1, toolStyle.strokeWidth))
                      }}
                      onChange={(stroke) => patchMultipleAppearance('stroke', stroke)}
                    />
                    <NumberField label="Espessura" value={firstStrokeWidth} min={0} max={64} onChange={(strokeWidth) => patchMultipleAppearance('strokeWidth', strokeWidth)} />
                  </>
                ) : null}
                </div>
              </InspectorPanelCard>
            ) : null
          })()}
          <InspectorPanelCard id="alignment" title="Organizar" icon={<AlignCenter size={15} />} accessory={`${selectedIds.length} itens`}>
            <div className="space-y-3">
            <div className="inspector-tool-hero tone-blue">
              <span className="inspector-eyebrow">Selecao multipla</span>
              <strong>{selectedIds.length} objetos</strong>
              <p>Alinhe, distribua ou agrupe a selecao.</p>
            </div>
            <button className="compact-button w-full" onClick={() => runAction(groupSelected)}>Agrupar selecionados</button>
            <div className="inspector-section-heading"><h3>Alinhar</h3></div>
            <div className="grid grid-cols-3 gap-2">
              <button className="compact-button" onClick={() => alignSelection('left')}>
                Esq
              </button>
              <button className="compact-button" onClick={() => alignSelection('centerX')}>
                Centro X
              </button>
              <button className="compact-button" onClick={() => alignSelection('right')}>
                Dir
              </button>
              <button className="compact-button" onClick={() => alignSelection('top')}>
                Topo
              </button>
              <button className="compact-button" onClick={() => alignSelection('centerY')}>
                Centro Y
              </button>
              <button className="compact-button" onClick={() => alignSelection('bottom')}>
                Base
              </button>
            </div>
            <div className="inspector-section-heading pt-1"><h3>Distribuir</h3></div>
            <div className="grid grid-cols-2 gap-2">
              <button className="compact-button" onClick={() => distributeSelection('horizontal')}>
                Horizontal
              </button>
              <button className="compact-button" onClick={() => distributeSelection('vertical')}>
                Vertical
              </button>
            </div>
            </div>
          </InspectorPanelCard>
          {renderExportPanel()}
          {renderDockedLayersPanel()}
        </div>
      )}
      </div>
    </aside>
  )
}

export default RightInspector
