import { create } from 'zustand'
import { getObjectBounds } from '@renderer/lib/bounds'
import type { Camera, CanvasCursorHint, CanvasGuide, CanvasObject, CanvasSnapshot, CanvasTool, Point, SmartGuideLine, ToolStyle } from '@renderer/types/canvas'

interface SetCanvasOptions {
  preserveSelection?: boolean
}

interface CanvasState {
  tool: CanvasTool
  toolStyle: ToolStyle
  camera: Camera
  objects: CanvasObject[]
  guides: CanvasGuide[]
  rulersVisible: boolean
  smartGuidesEnabled: boolean
  smartGuideLines: SmartGuideLine[]
  cursorHint: CanvasCursorHint
  selectedIds: string[]
  selectedGuideId: string | null
  mouseWorld: Point
  clipboard: CanvasObject[]
  setTool: (tool: CanvasTool) => void
  setCamera: (camera: Camera) => void
  setObjects: (objects: CanvasObject[]) => void
  setGuides: (guides: CanvasGuide[]) => void
  setCanvas: (snapshot: CanvasSnapshot, options?: SetCanvasOptions) => void
  setSelectedIds: (ids: string[]) => void
  setSelectedGuideId: (id: string | null) => void
  setMouseWorld: (point: Point) => void
  addObject: (object: CanvasObject, select?: boolean) => void
  updateObject: (id: string, patch: Partial<CanvasObject>) => void
  updateObjects: (updates: Array<{ id: string; patch: Partial<CanvasObject> }>) => void
  deleteSelected: () => void
  duplicateSelected: () => void
  copySelected: () => void
  pasteClipboard: () => void
  selectAll: () => void
  clearSelection: () => void
  clearCanvas: () => void
  bringSelectedForward: () => void
  sendSelectedBackward: () => void
  moveSelectedLayer: (direction: 'up' | 'down') => void
  setLayerZIndex: (id: string, zIndex: number) => void
  groupSelected: () => void
  ungroupSelected: () => void
  setToolStyle: (patch: Partial<ToolStyle>) => void
  toggleRulers: () => void
  setSmartGuidesEnabled: (enabled: boolean) => void
  setSmartGuideLines: (lines: SmartGuideLine[]) => void
  setCursorHint: (hint: CanvasCursorHint) => void
  addGuide: (guide: Omit<CanvasGuide, 'id'>) => void
  updateGuide: (id: string, patch: Partial<CanvasGuide>) => void
  deleteSelectedGuide: () => void
}

const cloneObjects = (objects: CanvasObject[]): CanvasObject[] => structuredClone(objects) as CanvasObject[]
const nextZIndex = (objects: CanvasObject[]): number => Math.max(0, ...objects.map((object) => object.zIndex)) + 1
const sortedByZIndex = (objects: CanvasObject[]): CanvasObject[] => [...objects].sort((a, b) => a.zIndex - b.zIndex)
const connectorPoint = (object: CanvasObject, target: { x: number; y: number }): Point => {
  const bounds = getObjectBounds(object)
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
  const dx = target.x - center.x
  const dy = target.y - center.y
  if (dx === 0 && dy === 0) return center
  const scaleX = dx === 0 ? Number.POSITIVE_INFINITY : bounds.width / 2 / Math.abs(dx)
  const scaleY = dy === 0 ? Number.POSITIVE_INFINITY : bounds.height / 2 / Math.abs(dy)
  const scale = Math.min(scaleX, scaleY)
  return { x: center.x + dx * scale, y: center.y + dy * scale }
}

const reflowBoundArrows = (objects: CanvasObject[]): CanvasObject[] => {
  const byId = new Map(objects.map((object) => [object.id, object]))
  return objects.map((object) => {
    if (object.type !== 'arrow' || (!object.startBinding && !object.endBinding)) return object
    const startObject = object.startBinding ? byId.get(object.startBinding) : undefined
    const endObject = object.endBinding ? byId.get(object.endBinding) : undefined
    const currentStart = { x: object.x + (object.points[0] ?? 0), y: object.y + (object.points[1] ?? 0) }
    const currentEnd = { x: object.x + (object.points[object.points.length - 2] ?? 0), y: object.y + (object.points[object.points.length - 1] ?? 0) }
    const startCenter = startObject ? getObjectBounds(startObject) : null
    const endCenter = endObject ? getObjectBounds(endObject) : null
    const targetForStart = endCenter ? { x: endCenter.x + endCenter.width / 2, y: endCenter.y + endCenter.height / 2 } : currentEnd
    const targetForEnd = startCenter ? { x: startCenter.x + startCenter.width / 2, y: startCenter.y + startCenter.height / 2 } : currentStart
    const start = startObject ? connectorPoint(startObject, targetForStart) : currentStart
    const end = endObject ? connectorPoint(endObject, targetForEnd) : currentEnd
    return {
      ...object,
      x: start.x,
      y: start.y,
      width: Math.max(1, Math.abs(end.x - start.x)),
      height: Math.max(1, Math.abs(end.y - start.y)),
      points: [0, 0, end.x - start.x, end.y - start.y],
      startBinding: startObject ? object.startBinding : undefined,
      endBinding: endObject ? object.endBinding : undefined
    }
  })
}
const cloneWithFreshIds = (object: CanvasObject): CanvasObject => {
  const clone = {
    ...(structuredClone(object) as CanvasObject),
    id: crypto.randomUUID(),
    name: `${object.name} copy`,
    locked: false
  } as CanvasObject

  if (clone.type === 'group') {
    clone.children = clone.children.map((child) => cloneWithFreshIds(child))
  }

  return clone
}
const offsetDuplicate = (object: CanvasObject): CanvasObject => ({
  ...cloneWithFreshIds(object),
  x: object.x + 24,
  y: object.y + 24
})

const defaultToolStyle: ToolStyle = {
  fill: '#1f2937',
  fillEnabled: true,
  stroke: '#d1d5db',
  strokeEnabled: true,
  strokeWidth: 2,
  radius: 10,
  fontFamily: 'Segoe UI',
  fontSize: 24,
  fontWeight: '500',
  fontStyle: 'normal',
  textFill: '#f3f4f6',
  align: 'left',
  lineHeight: 1.2,
  letterSpacing: 0,
  textDecoration: 'none',
  tension: 0.35,
  pointerLength: 12,
  pointerWidth: 12,
  pointerAtBeginning: false,
  pointerAtEnding: true,
  lineCap: 'round',
  strokePattern: 'solid',
  arrowRouting: 'straight',
  arrowAutoBind: false,
  polygonSides: 6,
  noteFoldSize: 24
}

const loadToolStyle = (): ToolStyle => {
  try {
    const saved = window.localStorage.getItem('canvas-d:tool-style')
    return saved ? { ...defaultToolStyle, ...(JSON.parse(saved) as Partial<ToolStyle>) } : defaultToolStyle
  } catch {
    return defaultToolStyle
  }
}

const persistToolStyle = (style: ToolStyle): void => {
  try {
    window.localStorage.setItem('canvas-d:tool-style', JSON.stringify(style))
  } catch {
    // The current session still keeps the style even if local storage is unavailable.
  }
}

export const useCanvasStore = create<CanvasState>((set) => ({
  tool: 'select',
  toolStyle: loadToolStyle(),
  camera: { x: 0, y: 0, zoom: 1 },
  objects: [],
  guides: [],
  rulersVisible: false,
  smartGuidesEnabled: true,
  smartGuideLines: [],
  cursorHint: null,
  selectedIds: [],
  selectedGuideId: null,
  mouseWorld: { x: 0, y: 0 },
  clipboard: [],
  setTool: (tool) => set({ tool }),
  setCamera: (camera) => set({ camera }),
  setObjects: (objects) => set({ objects: sortedByZIndex(reflowBoundArrows(objects)) }),
  setGuides: (guides) => set({ guides }),
  setCanvas: (snapshot, options) =>
    set((state) => {
      const objects = sortedByZIndex(reflowBoundArrows(snapshot.objects))
      const guides = snapshot.guides ?? []

      if (!options?.preserveSelection) {
        return { camera: snapshot.camera, objects, guides, selectedIds: [], selectedGuideId: null }
      }

      const objectIds = new Set(objects.map((object) => object.id))
      const guideIds = new Set(guides.map((guide) => guide.id))
      const selectedGuideId = state.selectedGuideId && guideIds.has(state.selectedGuideId) ? state.selectedGuideId : null

      return {
        camera: snapshot.camera,
        objects,
        guides,
        selectedIds: selectedGuideId ? [] : state.selectedIds.filter((id) => objectIds.has(id)),
        selectedGuideId
      }
    }),
  setSelectedIds: (selectedIds) => set({ selectedIds, selectedGuideId: null }),
  setSelectedGuideId: (selectedGuideId) => set({ selectedGuideId, selectedIds: [] }),
  setMouseWorld: (mouseWorld) =>
    set((state) => (state.mouseWorld.x === mouseWorld.x && state.mouseWorld.y === mouseWorld.y ? state : { mouseWorld })),
  addObject: (object, select = true) =>
    set((state) => {
      const objectWithZ = { ...object, zIndex: object.zIndex || nextZIndex(state.objects) } as CanvasObject
      return {
        objects: sortedByZIndex(reflowBoundArrows([...state.objects, objectWithZ])),
        selectedIds: select ? [objectWithZ.id] : state.selectedIds,
        selectedGuideId: null
      }
    }),
  updateObject: (id, patch) =>
    set((state) => ({
      objects: sortedByZIndex(reflowBoundArrows(state.objects.map((object) => (object.id === id ? ({ ...object, ...patch } as CanvasObject) : object))))
    })),
  updateObjects: (updates) =>
    set((state) => ({
      objects: sortedByZIndex(reflowBoundArrows(
        state.objects.map((object) => {
          const update = updates.find((candidate) => candidate.id === object.id)
          return update ? ({ ...object, ...update.patch } as CanvasObject) : object
        })
      ))
    })),
  deleteSelected: () =>
    set((state) => ({
      objects: reflowBoundArrows(state.objects.filter((object) => !state.selectedIds.includes(object.id) || object.locked)),
      selectedIds: []
    })),
  duplicateSelected: () =>
    set((state) => {
      const selected = state.objects.filter((object) => state.selectedIds.includes(object.id) && !object.locked)
      const duplicates = selected.map((object, index) => ({ ...offsetDuplicate(object), zIndex: nextZIndex(state.objects) + index }))
      return {
        objects: sortedByZIndex(reflowBoundArrows([...state.objects, ...duplicates])),
        selectedIds: duplicates.map((object) => object.id)
      }
    }),
  copySelected: () =>
    set((state) => ({
      clipboard: cloneObjects(state.objects.filter((object) => state.selectedIds.includes(object.id)))
    })),
  pasteClipboard: () =>
    set((state) => {
      const pasted = state.clipboard.map((object, index) => ({ ...offsetDuplicate(object), zIndex: nextZIndex(state.objects) + index }))
      return {
        objects: sortedByZIndex(reflowBoundArrows([...state.objects, ...pasted])),
        selectedIds: pasted.map((object) => object.id)
      }
    }),
  selectAll: () => set((state) => ({ selectedIds: state.objects.filter((object) => object.visible && !object.locked).map((object) => object.id) })),
  clearSelection: () => set({ selectedIds: [], selectedGuideId: null }),
  clearCanvas: () => set({ objects: [], guides: [], selectedIds: [], selectedGuideId: null }),
  bringSelectedForward: () =>
    set((state) => {
      const maxZ = nextZIndex(state.objects)
      return {
        objects: sortedByZIndex(state.objects.map((object) => (state.selectedIds.includes(object.id) ? { ...object, zIndex: maxZ } : object)))
      }
    }),
  sendSelectedBackward: () =>
    set((state) => ({
      objects: sortedByZIndex(state.objects.map((object) => (state.selectedIds.includes(object.id) ? { ...object, zIndex: 0 } : object)))
    })),
  moveSelectedLayer: (direction) =>
    set((state) => {
      if (state.selectedIds.length !== 1) return state
      const selectedId = state.selectedIds[0]
      const ordered = sortedByZIndex(state.objects).map((object, index) => ({ ...object, zIndex: index }))
      const index = ordered.findIndex((object) => object.id === selectedId)
      const target = direction === 'up' ? index + 1 : index - 1
      if (index < 0 || target < 0 || target >= ordered.length) return { objects: ordered }
      const next = [...ordered]
      const [item] = next.splice(index, 1)
      next.splice(target, 0, item)
      return { objects: next.map((object, zIndex) => ({ ...object, zIndex })) }
    }),
  setLayerZIndex: (id, zIndex) =>
    set((state) => {
      const ordered = sortedByZIndex(state.objects).filter((object) => object.id !== id)
      const object = state.objects.find((candidate) => candidate.id === id)
      if (!object) return state
      const target = Math.max(0, Math.min(zIndex, ordered.length))
      ordered.splice(target, 0, object)
      return { objects: ordered.map((item, index) => ({ ...item, zIndex: index })) }
    }),
  groupSelected: () =>
    set((state) => {
      const selected = sortedByZIndex(state.objects.filter((object) => state.selectedIds.includes(object.id) && !object.locked))
      if (selected.length < 2) return state

      const bounds = selected.map(getObjectBounds)
      const x = Math.min(...bounds.map((bound) => bound.x))
      const y = Math.min(...bounds.map((bound) => bound.y))
      const right = Math.max(...bounds.map((bound) => bound.x + bound.width))
      const bottom = Math.max(...bounds.map((bound) => bound.y + bound.height))
      const groupId = crypto.randomUUID()
      const groupZIndex = Math.max(...selected.map((object) => object.zIndex))
      const children = selected.map((object, index) => ({
        ...(structuredClone(object) as CanvasObject),
        x: object.x - x,
        y: object.y - y,
        zIndex: index
      }))
      const group: CanvasObject = {
        id: groupId,
        type: 'group',
        name: `Group ${selected.length}`,
        x,
        y,
        width: Math.max(1, right - x),
        height: Math.max(1, bottom - y),
        rotation: 0,
        opacity: 1,
        locked: false,
        visible: true,
        zIndex: groupZIndex,
        children
      }

      return {
        objects: sortedByZIndex(reflowBoundArrows([...state.objects.filter((object) => !state.selectedIds.includes(object.id)), group])),
        selectedIds: [groupId],
        selectedGuideId: null
      }
    }),
  ungroupSelected: () =>
    set((state) => {
      const selectedGroups = state.objects.filter((object) => state.selectedIds.includes(object.id) && object.type === 'group')
      if (selectedGroups.length === 0) return state
      const groupIds = new Set(selectedGroups.map((group) => group.id))
      const ungrouped = selectedGroups.flatMap((group) =>
        group.type === 'group'
          ? group.children.map((child, index) => ({
              ...(structuredClone(child) as CanvasObject),
              x: group.x + child.x,
              y: group.y + child.y,
              zIndex: group.zIndex + index / 100
            }))
          : []
      )

      return {
        objects: sortedByZIndex(reflowBoundArrows([...state.objects.filter((object) => !groupIds.has(object.id)), ...ungrouped])).map((object, index) => ({ ...object, zIndex: index })),
        selectedIds: ungrouped.map((object) => object.id),
        selectedGuideId: null
      }
    }),
  setToolStyle: (patch) =>
    set((state) => {
      const toolStyle = { ...state.toolStyle, ...patch }
      persistToolStyle(toolStyle)
      return { toolStyle }
    }),
  toggleRulers: () => set((state) => ({ rulersVisible: !state.rulersVisible })),
  setSmartGuidesEnabled: (smartGuidesEnabled) => set({ smartGuidesEnabled }),
  setSmartGuideLines: (smartGuideLines) =>
    set((state) => {
      const unchanged =
        state.smartGuideLines.length === smartGuideLines.length &&
        state.smartGuideLines.every((line, index) => line.orientation === smartGuideLines[index]?.orientation && line.position === smartGuideLines[index]?.position)
      return unchanged ? state : { smartGuideLines }
    }),
  setCursorHint: (cursorHint) => set((state) => (state.cursorHint === cursorHint ? state : { cursorHint })),
  addGuide: (guide) =>
    set((state) => {
      const nextGuide = { ...guide, id: crypto.randomUUID() }
      return { guides: [...state.guides, nextGuide], selectedGuideId: nextGuide.id, selectedIds: [] }
    }),
  updateGuide: (id, patch) =>
    set((state) => ({
      guides: state.guides.map((guide) => (guide.id === id ? { ...guide, ...patch } : guide))
    })),
  deleteSelectedGuide: () =>
    set((state) => ({
      guides: state.guides.filter((guide) => guide.id !== state.selectedGuideId),
      selectedGuideId: null
    }))
}))
