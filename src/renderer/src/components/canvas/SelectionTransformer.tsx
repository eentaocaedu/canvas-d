import { useEffect, useRef } from 'react'
import { Transformer } from 'react-konva'
import type Konva from 'konva'
import type { Box } from 'konva/lib/shapes/Transformer'
import { snapResizeBox } from '@renderer/lib/snap'
import { measurePointText } from '@renderer/lib/textMetrics'
import { useCanvasStore } from '@renderer/store/useCanvasStore'
import { useHistoryStore } from '@renderer/store/useHistoryStore'
import { useWorkspaceStore } from '@renderer/store/useWorkspaceStore'
import type { CanvasObject, CanvasSnapshot } from '@renderer/types/canvas'

interface SelectionTransformerProps {
  nodes: Map<string, Konva.Group>
  nodesVersion: number
}

const toolCanTransformObject = (tool: string, object: CanvasObject): boolean => {
  if (tool === 'select') return !(object.type === 'arrow' && (object.startBinding || object.endBinding))
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
  return false
}

const scalePoints = (points: number[], scaleX: number, scaleY: number): number[] => points.map((value, index) => value * (index % 2 === 0 ? scaleX : scaleY))

const scaleCanvasObject = (object: CanvasObject, scaleX: number, scaleY: number): CanvasObject => {
  const scaled = {
    ...(structuredClone(object) as CanvasObject),
    x: object.x * scaleX,
    y: object.y * scaleY,
    width: Math.max(1, object.width * scaleX),
    height: Math.max(1, object.height * scaleY)
  } as CanvasObject

  if (scaled.type === 'line' || scaled.type === 'arrow' || scaled.type === 'freehand' || scaled.type === 'vector') {
    scaled.points = scalePoints(scaled.points, scaleX, scaleY)
  }

  if (scaled.type === 'group') {
    scaled.children = scaled.children.map((child) => scaleCanvasObject(child, scaleX, scaleY))
  }

  return scaled
}

const updateFromNode = (object: CanvasObject, node: Konva.Group, tool: string): Partial<CanvasObject> => {
  const scaleX = node.scaleX()
  const scaleY = node.scaleY()
  const width = Math.max(8, object.width * scaleX)
  const height = Math.max(8, object.height * scaleY)

  if (object.type === 'text') {
    const mode = object.textMode ?? 'paragraph'
    if (mode === 'paragraph') {
      return {
        x: node.x(),
        y: node.y(),
        width,
        height,
        rotation: node.rotation()
      }
    }

    const fontScale = Math.max(0.2, (Math.abs(scaleX) + Math.abs(scaleY)) / 2)
    const fontSize = Math.max(4, Math.round(object.fontSize * fontScale))
    const size = measurePointText({
      text: object.text,
      fontFamily: object.fontFamily,
      fontSize,
      fontWeight: object.fontWeight,
      fontStyle: object.fontStyle,
      lineHeight: object.lineHeight,
      letterSpacing: object.letterSpacing
    })
    return {
      x: node.x(),
      y: node.y(),
      width: size.width,
      height: size.height,
      rotation: node.rotation(),
      fontSize
    } as Partial<CanvasObject>
  }

  if (object.type === 'group') {
    return {
      x: node.x(),
      y: node.y(),
      width,
      height,
      rotation: node.rotation(),
      children: object.children.map((child) => scaleCanvasObject(child, scaleX, scaleY))
    } as Partial<CanvasObject>
  }

  const patch: Partial<CanvasObject> = {
    x: node.x(),
    y: node.y(),
    width,
    height,
    rotation: node.rotation()
  }

  if (object.type === 'line' || object.type === 'arrow' || object.type === 'freehand' || object.type === 'vector') {
    return { ...patch, points: scalePoints(object.points, scaleX, scaleY) } as Partial<CanvasObject>
  }

  return patch
}

const patchChangesObject = (object: CanvasObject, patch: Partial<CanvasObject>): boolean =>
  Object.entries(patch).some(([key, value]) => JSON.stringify((object as unknown as Record<string, unknown>)[key]) !== JSON.stringify(value))

const SelectionTransformer = ({ nodes, nodesVersion }: SelectionTransformerProps): JSX.Element => {
  const transformerRef = useRef<Konva.Transformer>(null)
  const transformSnapshotRef = useRef<CanvasSnapshot | null>(null)
  const liveParagraphSizeRef = useRef<Map<string, { width: number; height: number }>>(new Map())
  const tool = useCanvasStore((state) => state.tool)
  const selectedIds = useCanvasStore((state) => state.selectedIds)
  const objects = useCanvasStore((state) => state.objects)
  const guides = useCanvasStore((state) => state.guides)
  const camera = useCanvasStore((state) => state.camera)
  const smartGuidesEnabled = useCanvasStore((state) => state.smartGuidesEnabled)
  const setSmartGuideLines = useCanvasStore((state) => state.setSmartGuideLines)
  const updateObjects = useCanvasStore((state) => state.updateObjects)
  const pushHistory = useHistoryStore((state) => state.push)
  const markDirty = useWorkspaceStore((state) => state.markDirty)
  const selectedObjects = selectedIds.map((id) => objects.find((object) => object.id === id)).filter((object): object is CanvasObject => Boolean(object))
  const isPointText = selectedObjects.length === 1 && selectedObjects[0].type === 'text' && (selectedObjects[0].textMode ?? 'paragraph') === 'point'
  const isLockedImage = selectedObjects.length === 1 && selectedObjects[0].type === 'image' && selectedObjects[0].lockAspectRatio !== false
  const keepRatio = isPointText || isLockedImage

  useEffect(() => {
    const transformer = transformerRef.current
    if (!transformer) return
    if (tool === 'pan') {
      transformer.nodes([])
      transformer.getLayer()?.batchDraw()
      return
    }
    const selectedNodes = selectedIds
      .filter((id) => {
        const object = objects.find((candidate) => candidate.id === id)
        if (!object || object.locked) return false
        return toolCanTransformObject(tool, object)
      })
      .map((id) => nodes.get(id))
      .filter((node): node is Konva.Group => Boolean(node))
    transformer.nodes(selectedNodes)
    transformer.getLayer()?.batchDraw()
  }, [nodes, nodesVersion, objects, selectedIds, tool])

  const handleTransformStart = (): void => {
    transformSnapshotRef.current = { camera, objects, guides }
    liveParagraphSizeRef.current.clear()
    setSmartGuideLines([])
  }

  const handleTransform = (): void => {
    if (selectedObjects.length !== 1) return
    const object = selectedObjects[0]
    if (object.type !== 'text' || (object.textMode ?? 'paragraph') !== 'paragraph') return
    const node = nodes.get(object.id)
    if (!node) return
    const width = Math.max(8, object.width * Math.abs(node.scaleX()))
    const height = Math.max(8, object.height * Math.abs(node.scaleY()))
    node.scale({ x: 1, y: 1 })
    node.size({ width, height })
    const textNode = node.findOne('Text') as Konva.Text | undefined
    textNode?.size({ width, height })
    liveParagraphSizeRef.current.set(object.id, { width, height })
    transformerRef.current?.forceUpdate()
  }

  const handleBoundBox = (oldBox: Box, newBox: Box): Box => {
    if (newBox.width < 8 || newBox.height < 8) return oldBox
    if (!smartGuidesEnabled) return newBox

    const anchor = transformerRef.current?.getActiveAnchor() ?? null
    const snapped = snapResizeBox(
      { x: newBox.x, y: newBox.y, width: newBox.width, height: newBox.height },
      objects,
      guides,
      camera,
      8,
      new Set(selectedIds),
      anchor
    )

    setSmartGuideLines(snapped.lines)

    return {
      ...newBox,
      x: snapped.box.x,
      y: snapped.box.y,
      width: snapped.box.width,
      height: snapped.box.height
    }
  }

  const handleTransformEnd = (): void => {
    const updates = selectedIds
      .map((id) => {
        const node = nodes.get(id)
        const object = objects.find((candidate) => candidate.id === id)
        if (!node || !object || object.locked) return null
        if (!toolCanTransformObject(tool, object)) return null
        const liveParagraphSize = liveParagraphSizeRef.current.get(id)
        const patch = liveParagraphSize
          ? ({ x: node.x(), y: node.y(), width: liveParagraphSize.width, height: liveParagraphSize.height, rotation: node.rotation() } as Partial<CanvasObject>)
          : updateFromNode(object, node, tool)
        node.scaleX(1)
        node.scaleY(1)
        if (!patchChangesObject(object, patch)) return null
        return { id, patch }
      })
      .filter((update): update is { id: string; patch: Partial<CanvasObject> } => Boolean(update))

    if (updates.length > 0) {
      pushHistory(transformSnapshotRef.current ?? { camera, objects, guides })
      updateObjects(updates)
      markDirty()
    }
    transformSnapshotRef.current = null
    liveParagraphSizeRef.current.clear()
    setSmartGuideLines([])
  }

  return (
    <Transformer
      ref={transformerRef}
      rotateEnabled
      ignoreStroke
      anchorSize={8}
      borderStroke="#2563eb"
      anchorStroke="#2563eb"
      anchorFill="#f3f4f6"
      enabledAnchors={
        keepRatio
          ? ['top-left', 'top-right', 'bottom-left', 'bottom-right']
          : ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-center', 'bottom-center']
      }
      keepRatio={keepRatio}
      boundBoxFunc={handleBoundBox}
      onTransformStart={handleTransformStart}
      onTransform={handleTransform}
      onTransformEnd={handleTransformEnd}
    />
  )
}

export default SelectionTransformer
