import { useCallback, useEffect, useRef, useState } from 'react'
import { Arrow, Ellipse, Group, Image as KonvaImage, Line, Path, Rect, Text } from 'react-konva'
import type Konva from 'konva'
import { boundsFromObjects } from '@renderer/lib/bounds'
import { snapBoundsPosition, snapObjectPosition } from '@renderer/lib/snap'
import { getKonvaFontStyle } from '@renderer/lib/textMetrics'
import { dashForStroke, routeArrowPoints } from '@renderer/lib/strokeStyle'
import { useCanvasStore } from '@renderer/store/useCanvasStore'
import { useHistoryStore } from '@renderer/store/useHistoryStore'
import { useWorkspaceStore } from '@renderer/store/useWorkspaceStore'
import type { CanvasObject, CanvasSnapshot, ImageObject, TextObject } from '@renderer/types/canvas'

interface ObjectRendererProps {
  object: CanvasObject
  registerNode: (id: string, node: Konva.Group | null) => void
  getNode?: (id: string) => Konva.Group | null
  onEditText: (id: string) => void
  interactive?: boolean
  navigationActive?: boolean
  editingId?: string | null
}

interface SelectionDragState {
  positions: Array<{ id: string; x: number; y: number }>
  primaryStart: { x: number; y: number }
  bounds: { x: number; y: number; width: number; height: number }
}

const useHtmlImage = (src: string): HTMLImageElement | null => {
  const [image, setImage] = useState<HTMLImageElement | null>(null)

  useEffect(() => {
    if (!src) {
      setImage(null)
      return
    }
    const next = new window.Image()
    next.onload = () => setImage(next)
    next.src = src
    return () => setImage(null)
  }, [src])

  return image
}

const toolMatchesObject = (tool: string, object: CanvasObject): boolean => {
  if (tool === 'text') return object.type === 'text'
  if (tool === 'rect') return object.type === 'rect'
  if (tool === 'ellipse') return object.type === 'ellipse'
  if (tool === 'diamond') return object.type === 'diamond'
  if (tool === 'polygon') return object.type === 'polygon'
  if (tool === 'note') return object.type === 'note'
  if (tool === 'line') return object.type === 'line'
  if (tool === 'arrow') return object.type === 'arrow'
  if (tool === 'freehand') return object.type === 'freehand'
  if (tool === 'vector') return object.type === 'vector' || object.type === 'path'
  if (tool === 'frame') return object.type === 'frame'
  if (tool === 'image') return object.type === 'image'
  if (tool === 'crop') return object.type === 'image'
  return false
}

const polygonPoints = (width: number, height: number, sides: number): number[] => {
  const points: number[] = []
  const count = Math.max(3, Math.round(sides))
  for (let index = 0; index < count; index += 1) {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / count
    points.push(width / 2 + Math.cos(angle) * (width / 2), height / 2 + Math.sin(angle) * (height / 2))
  }
  return points
}

const notePoints = (width: number, height: number, foldSize: number): number[] => {
  const fold = Math.max(0, Math.min(Math.min(width, height) / 2, foldSize))
  return [0, 0, width - fold, 0, width, fold, width, height, 0, height]
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

const hasPositionChange = (positions: Array<{ id: string; x: number; y: number }>, updates: Array<{ id: string; x: number; y: number }>): boolean =>
  updates.some((update) => {
    const previous = positions.find((position) => position.id === update.id)
    return previous ? previous.x !== update.x || previous.y !== update.y : false
  })

const ObjectRenderer = ({ object, registerNode, getNode, onEditText, interactive = true, navigationActive = false, editingId = null }: ObjectRendererProps): JSX.Element | null => {
  const tool = useCanvasStore((state) => state.tool)
  const selectedIds = useCanvasStore((state) => state.selectedIds)
  const setSelectedIds = useCanvasStore((state) => state.setSelectedIds)
  const addObject = useCanvasStore((state) => state.addObject)
  const updateObject = useCanvasStore((state) => state.updateObject)
  const updateObjects = useCanvasStore((state) => state.updateObjects)
  const camera = useCanvasStore((state) => state.camera)
  const objects = useCanvasStore((state) => state.objects)
  const guides = useCanvasStore((state) => state.guides)
  const smartGuidesEnabled = useCanvasStore((state) => state.smartGuidesEnabled)
  const setSmartGuideLines = useCanvasStore((state) => state.setSmartGuideLines)
  const markDirty = useWorkspaceStore((state) => state.markDirty)
  const pushHistory = useHistoryStore((state) => state.push)
  const altDuplicateIdRef = useRef<string | null>(null)
  const selectionDragRef = useRef<SelectionDragState | null>(null)
  const dragSnapshotRef = useRef<CanvasSnapshot | null>(null)
  const selected = selectedIds.includes(object.id)
  const canInteract = !navigationActive && (tool === 'select' || toolMatchesObject(tool, object))
  const canDrag = tool === 'select' && canInteract
  const image = useHtmlImage(object.type === 'image' ? (object as ImageObject).src : '')

  const groupRef = useCallback(
    (node: Konva.Group | null) => {
      if (interactive) registerNode(object.id, node)
    },
    [interactive, object.id, registerNode]
  )

  if (!object.visible) return null

  const selectObject = (evt: Konva.KonvaEventObject<MouseEvent>): void => {
    if (!interactive || !canInteract) return
    evt.cancelBubble = true
    if (evt.evt.shiftKey || evt.evt.ctrlKey || evt.evt.metaKey) {
      setSelectedIds(selected ? selectedIds.filter((id) => id !== object.id) : [...selectedIds, object.id])
    } else {
      setSelectedIds([object.id])
    }
  }

  const handleDragStart = (evt: Konva.KonvaEventObject<DragEvent>): void => {
    if (!interactive) return
    if (evt.evt.altKey && tool === 'select') {
      pushHistory({ camera, objects, guides })
      const duplicate = {
        ...cloneWithFreshIds(object),
        zIndex: Math.max(0, ...objects.map((candidate) => candidate.zIndex)) + 1
      } as CanvasObject
      altDuplicateIdRef.current = duplicate.id
      addObject(duplicate, true)
      return
    }
    if (object.type === 'arrow' && (object.startBinding || object.endBinding)) {
      updateObject(object.id, { startBinding: undefined, endBinding: undefined })
    }
    if (!selected) setSelectedIds([object.id])
    const draggedObjects = selected ? objects.filter((candidate) => selectedIds.includes(candidate.id) && !candidate.locked) : [object]
    const bounds = boundsFromObjects(draggedObjects, 0)
    dragSnapshotRef.current = { camera, objects, guides }
    selectionDragRef.current = bounds
      ? {
          positions: draggedObjects.map((candidate) => ({ id: candidate.id, x: candidate.x, y: candidate.y })),
          primaryStart: { x: object.x, y: object.y },
          bounds
        }
      : null
  }

  const handleDragEnd = (evt: Konva.KonvaEventObject<DragEvent>): void => {
    if (!interactive) return
    const selectionDrag = selectionDragRef.current
    const duplicateId = altDuplicateIdRef.current
    let changed = false
    if (duplicateId) {
      updateObject(duplicateId, { x: evt.target.x(), y: evt.target.y() })
      evt.target.position({ x: object.x, y: object.y })
      altDuplicateIdRef.current = null
      changed = true
    } else if (selectionDrag && selectionDrag.positions.length > 1) {
      const dx = evt.target.x() - selectionDrag.primaryStart.x
      const dy = evt.target.y() - selectionDrag.primaryStart.y
      const updates = selectionDrag.positions.map((position) => ({ id: position.id, x: position.x + dx, y: position.y + dy }))
      changed = hasPositionChange(selectionDrag.positions, updates)
      if (changed && dragSnapshotRef.current) pushHistory(dragSnapshotRef.current)
      updateObjects(updates.map((update) => ({ id: update.id, patch: { x: update.x, y: update.y } as Partial<CanvasObject> })))
    } else {
      changed = object.x !== evt.target.x() || object.y !== evt.target.y()
      if (changed && dragSnapshotRef.current) pushHistory(dragSnapshotRef.current)
      if (changed) updateObject(object.id, { x: evt.target.x(), y: evt.target.y() })
    }
    selectionDragRef.current = null
    dragSnapshotRef.current = null
    setSmartGuideLines([])
    if (changed) markDirty()
  }

  const handleDragMove = (evt: Konva.KonvaEventObject<DragEvent>): void => {
    if (!interactive || tool !== 'select') return
    const selectionDrag = selectionDragRef.current

    if (selectionDrag && selectionDrag.positions.length > 1) {
      const excludeIds = new Set(selectionDrag.positions.map((position) => position.id))
      let dx = evt.target.x() - selectionDrag.primaryStart.x
      let dy = evt.target.y() - selectionDrag.primaryStart.y
      let lines = []

      if (smartGuidesEnabled) {
        const snapped = snapBoundsPosition(
          selectionDrag.bounds,
          { x: selectionDrag.bounds.x + dx, y: selectionDrag.bounds.y + dy },
          objects,
          guides,
          8 / camera.zoom,
          excludeIds
        )
        dx = snapped.x - selectionDrag.bounds.x
        dy = snapped.y - selectionDrag.bounds.y
        lines = snapped.lines
      }

      for (const position of selectionDrag.positions) {
        const node = position.id === object.id ? evt.target : getNode?.(position.id)
        node?.position({ x: position.x + dx, y: position.y + dy })
      }
      setSmartGuideLines(lines)
      return
    }

    if (!smartGuidesEnabled) {
      setSmartGuideLines([])
      return
    }
    const snapped = snapObjectPosition(object, { x: evt.target.x(), y: evt.target.y() }, objects, guides, 8 / camera.zoom)
    evt.target.position({ x: snapped.x, y: snapped.y })
    setSmartGuideLines(snapped.lines)
  }

  const common = {
    width: object.width,
    height: object.height
  }

  let content: JSX.Element | null = null

  if (object.type === 'frame') {
    content = <Rect {...common} fill={object.background} stroke={selected ? '#2563eb' : '#4b5563'} strokeWidth={selected ? 2 : 1} cornerRadius={0} />
  } else if (object.type === 'rect') {
    content = <Rect {...common} fill={object.fill} stroke={object.stroke} strokeWidth={object.strokeWidth} cornerRadius={object.cornerRadii ?? object.radius} />
  } else if (object.type === 'ellipse') {
    content = (
      <Ellipse
        x={object.width / 2}
        y={object.height / 2}
        radiusX={Math.max(1, object.width / 2)}
        radiusY={Math.max(1, object.height / 2)}
        fill={object.fill}
        stroke={object.stroke}
        strokeWidth={object.strokeWidth}
        opacity={object.opacity}
      />
    )
  } else if (object.type === 'diamond') {
    content = <Line points={[object.width / 2, 0, object.width, object.height / 2, object.width / 2, object.height, 0, object.height / 2]} closed fill={object.fill} stroke={object.stroke} strokeWidth={object.strokeWidth} />
  } else if (object.type === 'polygon') {
    content = <Line points={polygonPoints(object.width, object.height, object.sides)} closed fill={object.fill} stroke={object.stroke} strokeWidth={object.strokeWidth} lineJoin="round" />
  } else if (object.type === 'note') {
    const fold = Math.max(0, Math.min(Math.min(object.width, object.height) / 2, object.foldSize))
    content = (
      <>
        <Line points={notePoints(object.width, object.height, fold)} closed fill={object.fill} stroke={object.stroke} strokeWidth={object.strokeWidth} lineJoin="round" />
        {fold > 0 ? <Line points={[object.width - fold, 0, object.width - fold, fold, object.width, fold]} stroke={object.stroke} strokeWidth={object.strokeWidth} /> : null}
      </>
    )
  } else if (object.type === 'text') {
    const text = object as TextObject
    content = (
      <Text
        {...common}
        text={text.text}
        fontFamily={text.fontFamily}
        fontSize={text.fontSize}
        fontStyle={getKonvaFontStyle(text.fontWeight, text.fontStyle)}
        fill={text.fill}
        align={text.align}
        lineHeight={text.lineHeight}
        letterSpacing={text.letterSpacing ?? 0}
        textDecoration={text.textDecoration ?? 'none'}
        wrap={(text.textMode ?? 'paragraph') === 'point' ? 'none' : 'word'}
        verticalAlign="top"
        opacity={editingId === object.id ? 0 : 1}
      />
    )
  } else if (object.type === 'line') {
    content = (
      <>
        <Line points={object.points} stroke="transparent" strokeWidth={Math.max(12, object.strokeWidth + 8)} />
        <Line
          points={object.points}
          stroke={object.stroke}
          strokeWidth={object.strokeWidth}
          lineCap={object.lineCap ?? 'round'}
          dash={dashForStroke(object.strokePattern, object.strokeWidth)}
        />
      </>
    )
  } else if (object.type === 'arrow') {
    content = (
      <>
        <Line points={routeArrowPoints(object.points, object.routing)} stroke="transparent" strokeWidth={Math.max(12, object.strokeWidth + 8)} />
        <Arrow
          points={routeArrowPoints(object.points, object.routing)}
          stroke={object.stroke}
          fill={object.stroke}
          strokeWidth={object.strokeWidth}
          pointerLength={object.pointerLength}
          pointerWidth={object.pointerWidth}
          pointerAtBeginning={object.pointerAtBeginning ?? false}
          pointerAtEnding={object.pointerAtEnding ?? true}
          lineCap={object.lineCap ?? 'round'}
          dash={dashForStroke(object.strokePattern, object.strokeWidth)}
        />
      </>
    )
  } else if (object.type === 'freehand') {
    content = (
      <Line
        points={object.points}
        stroke={object.stroke}
        strokeWidth={object.strokeWidth}
        tension={object.tension}
        lineCap={object.lineCap ?? 'round'}
        lineJoin="round"
        dash={dashForStroke(object.strokePattern, object.strokeWidth)}
      />
    )
  } else if (object.type === 'vector') {
    content = (
      <>
        {!object.closed ? <Line points={object.points} stroke="transparent" strokeWidth={Math.max(12, object.strokeWidth + 8)} /> : null}
        <Line
          points={object.points}
          closed={object.closed}
          fill={object.closed ? object.fill : 'transparent'}
          stroke={object.stroke}
          strokeWidth={object.strokeWidth}
          tension={object.tension}
          lineCap={object.lineCap ?? 'round'}
          lineJoin="round"
          dash={dashForStroke(object.strokePattern, object.strokeWidth)}
        />
      </>
    )
  } else if (object.type === 'path') {
    content = (
      <Path
        data={object.data}
        scaleX={object.width / Math.max(0.001, object.sourceWidth)}
        scaleY={object.height / Math.max(0.001, object.sourceHeight)}
        fill={object.fill}
        stroke={object.stroke}
        strokeWidth={object.strokeWidth / Math.max(0.001, (object.width / object.sourceWidth + object.height / object.sourceHeight) / 2)}
        fillRule={object.fillRule ?? 'nonzero'}
        lineJoin={object.lineJoin ?? 'miter'}
        lineCap={object.lineCap ?? 'butt'}
        dash={dashForStroke(object.strokePattern, object.strokeWidth)}
      />
    )
  } else if (object.type === 'image') {
    content = image ? (
      <KonvaImage
        {...common}
        image={image}
        cropX={object.crop?.x}
        cropY={object.crop?.y}
        cropWidth={object.crop?.width}
        cropHeight={object.crop?.height}
      />
    ) : (
      <Rect {...common} fill="#1f2937" stroke="#4b5563" dash={[6, 4]} />
    )
  } else if (object.type === 'group') {
    content = (
      <>
        <Rect
          width={object.width}
          height={object.height}
          fill="rgba(15, 17, 21, 0.01)"
          stroke={selected ? '#2563eb' : 'transparent'}
          strokeWidth={selected ? 1 : 0}
          dash={selected ? [6, 4] : undefined}
        />
        {[...object.children]
          .sort((a, b) => a.zIndex - b.zIndex)
          .map((child) => (
            <ObjectRenderer
              key={child.id}
              object={child}
              registerNode={() => undefined}
              getNode={getNode}
              onEditText={onEditText}
              interactive={false}
              navigationActive={navigationActive}
              editingId={null}
            />
          ))}
      </>
    )
  }

  return (
    <Group
      id={object.id}
      ref={groupRef}
      x={object.x}
      y={object.y}
      width={object.width}
      height={object.height}
      rotation={object.rotation}
      opacity={object.opacity}
      draggable={interactive && canDrag && !object.locked}
      onClick={selectObject}
      onTap={selectObject}
      onDblClick={() => {
        if (interactive && object.type === 'text') onEditText(object.id)
      }}
      onDblTap={() => {
        if (interactive && object.type === 'text') onEditText(object.id)
      }}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      listening={interactive && canInteract && !object.locked}
    >
      {content}
    </Group>
  )
}

export default ObjectRenderer
