import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Group, Layer, Line, Rect, Stage } from 'react-konva'
import type Konva from 'konva'
import { boundsIntersect, getObjectBounds, normalizeBounds } from '@renderer/lib/bounds'
import { clampZoom, screenToWorld } from '@renderer/lib/coordinates'
import { fitVectorToPoints, makeFreehand, makeObjectForTool, makeParagraphText, makeText, makeVector, nextObjectZIndex } from '@renderer/lib/objectFactory'
import { importAssetFile } from '@renderer/lib/assetImport'
import { useCanvasStore } from '@renderer/store/useCanvasStore'
import { useHistoryStore } from '@renderer/store/useHistoryStore'
import { useWorkspaceStore } from '@renderer/store/useWorkspaceStore'
import type { CanvasCursorHint, CanvasObject, ImageObject, Point, VectorObject } from '@renderer/types/canvas'
import ObjectRenderer from './ObjectRenderer'
import RectRadiusHandles from './RectRadiusHandles'
import SelectionTransformer from './SelectionTransformer'
import VectorPointHandles from './VectorPointHandles'
import PathPointHandles from './PathPointHandles'

interface InfiniteCanvasProps {
  width: number
  height: number
  spacePressed: boolean
  imageInputRef: RefObject<HTMLInputElement | null>
  onEditText: (id: string) => void
  editingId: string | null
}

const drawingTools = new Set(['frame', 'rect', 'ellipse', 'diamond', 'polygon', 'note', 'line', 'arrow'])
type ActiveInteraction = 'pan' | 'marquee' | 'draw' | 'crop' | null

interface CropDraft {
  imageId: string
  start: Point
  current: Point
}

const maybeSquare = (start: Point, current: Point, shiftKey: boolean): Point => {
  if (!shiftKey) return current
  const dx = current.x - start.x
  const dy = current.y - start.y
  const size = Math.max(Math.abs(dx), Math.abs(dy))
  return { x: start.x + Math.sign(dx || 1) * size, y: start.y + Math.sign(dy || 1) * size }
}

const lockLineAngle = (start: Point, current: Point, shiftKey: boolean): Point => {
  if (!shiftKey) return current
  const dx = current.x - start.x
  const dy = current.y - start.y
  const angle = Math.atan2(dy, dx)
  const distance = Math.hypot(dx, dy)
  const snap = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4)
  return { x: start.x + Math.cos(snap) * distance, y: start.y + Math.sin(snap) * distance }
}

const transformerCursorHint = (target: Konva.Node): CanvasCursorHint => {
  if (target.name().includes('radius-handle')) {
    return target.name().includes('top-right') || target.name().includes('bottom-left') ? 'resize-nesw' : 'resize-nwse'
  }
  if (target.getParent()?.getClassName() !== 'Transformer') return null
  const name = target.name()
  if (name.includes('middle-left') || name.includes('middle-right')) return 'resize-ew'
  if (name.includes('top-center') || name.includes('bottom-center')) return 'resize-ns'
  if (name.includes('top-left') || name.includes('bottom-right')) return 'resize-nwse'
  if (name.includes('top-right') || name.includes('bottom-left')) return 'resize-nesw'
  return null
}

const InfiniteCanvas = ({ width, height, spacePressed, imageInputRef, onEditText, editingId }: InfiniteCanvasProps): JSX.Element => {
  const stageRef = useRef<Konva.Stage>(null)
  const nodesRef = useRef(new Map<string, Konva.Group>())
  const activeInteractionRef = useRef<ActiveInteraction>(null)
  const textDraggedRef = useRef(false)
  const arrowStartBindingRef = useRef<string | undefined>(undefined)
  const [nodesVersion, setNodesVersion] = useState(0)
  const [panStart, setPanStart] = useState<{ pointer: Point; camera: Point } | null>(null)
  const [drawStart, setDrawStart] = useState<Point | null>(null)
  const [previewObject, setPreviewObject] = useState<CanvasObject | null>(null)
  const [vectorDraft, setVectorDraft] = useState<VectorObject | null>(null)
  const [vectorHover, setVectorHover] = useState<Point | null>(null)
  const [cropDraft, setCropDraft] = useState<CropDraft | null>(null)
  const [marquee, setMarquee] = useState<{ start: Point; current: Point; additive: boolean } | null>(null)
  const tool = useCanvasStore((state) => state.tool)
  const toolStyle = useCanvasStore((state) => state.toolStyle)
  const camera = useCanvasStore((state) => state.camera)
  const objects = useCanvasStore((state) => state.objects)
  const guides = useCanvasStore((state) => state.guides)
  const rulersVisible = useCanvasStore((state) => state.rulersVisible)
  const smartGuideLines = useCanvasStore((state) => state.smartGuideLines)
  const selectedGuideId = useCanvasStore((state) => state.selectedGuideId)
  const selectedIds = useCanvasStore((state) => state.selectedIds)
  const setCamera = useCanvasStore((state) => state.setCamera)
  const setMouseWorld = useCanvasStore((state) => state.setMouseWorld)
  const setSelectedIds = useCanvasStore((state) => state.setSelectedIds)
  const setSelectedGuideId = useCanvasStore((state) => state.setSelectedGuideId)
  const setCursorHint = useCanvasStore((state) => state.setCursorHint)
  const setSmartGuideLines = useCanvasStore((state) => state.setSmartGuideLines)
  const updateGuide = useCanvasStore((state) => state.updateGuide)
  const addObject = useCanvasStore((state) => state.addObject)
  const updateObject = useCanvasStore((state) => state.updateObject)
  const pushHistory = useHistoryStore((state) => state.push)
  const markDirty = useWorkspaceStore((state) => state.markDirty)

  const sortedObjects = useMemo(() => [...objects].sort((a, b) => a.zIndex - b.zIndex), [objects])
  const visibleWorldBounds = useMemo(
    () => ({
      left: -camera.x / camera.zoom,
      top: -camera.y / camera.zoom,
      right: (width - camera.x) / camera.zoom,
      bottom: (height - camera.y) / camera.zoom
    }),
    [camera, height, width]
  )

  const getPointer = useCallback((): Point | null => {
    const pointer = stageRef.current?.getPointerPosition()
    return pointer ? { x: pointer.x, y: pointer.y } : null
  }, [])

  const getWorldPointer = useCallback((): Point | null => {
    const pointer = getPointer()
    return pointer ? screenToWorld(pointer, camera) : null
  }, [camera, getPointer])

  const registerNode = useCallback((id: string, node: Konva.Group | null) => {
    if (node) {
      if (nodesRef.current.get(id) === node) return
      nodesRef.current.set(id, node)
      setNodesVersion((version) => version + 1)
    } else {
      if (!nodesRef.current.has(id)) return
      nodesRef.current.delete(id)
      setNodesVersion((version) => version + 1)
    }
  }, [])

  const getNode = useCallback((id: string): Konva.Group | null => nodesRef.current.get(id) ?? null, [])

  const commitObject = (object: CanvasObject): void => {
    pushHistory({ camera, objects, guides })
    addObject(object, true)
    markDirty()
  }

  const findConnectorTarget = (point: Point): CanvasObject | undefined =>
    [...objects]
      .sort((a, b) => b.zIndex - a.zIndex)
      .find((object) => {
        if (!object.visible || object.type === 'frame' || object.type === 'line' || object.type === 'arrow' || object.type === 'freehand' || object.type === 'vector') return false
        const bounds = getObjectBounds(object)
        return point.x >= bounds.x && point.x <= bounds.x + bounds.width && point.y >= bounds.y && point.y <= bounds.y + bounds.height
      })

  const finishVector = (draft: VectorObject, closed = draft.closed): void => {
    if (draft.points.length >= 4) commitObject(fitVectorToPoints({ ...draft, closed, fill: closed && toolStyle.fillEnabled ? toolStyle.fill : 'transparent' }))
    setVectorDraft(null)
    setVectorHover(null)
  }

  const isTransformerTarget = (target: Konva.Node): boolean => {
    const parent = target.getParent()
    return target.getClassName() === 'Transformer' || parent?.getClassName() === 'Transformer'
  }

  const isCanvasControl = (target: Konva.Node): boolean =>
    target.name().includes('radius-handle') || target.name().includes('vector-point-handle') || target.name().includes('path-point-handle') || isTransformerTarget(target)

  const objectForTarget = (target: Konva.Node): CanvasObject | undefined => {
    let node: Konva.Node | null = target
    while (node && node !== stageRef.current) {
      const id = node.id()
      if (id) {
        const object = objects.find((candidate) => candidate.id === id)
        if (object) return object
      }
      node = node.getParent()
    }
    return undefined
  }

  const localPointInImage = (image: ImageObject, world: Point): Point => {
    const radians = (-image.rotation * Math.PI) / 180
    const dx = world.x - image.x
    const dy = world.y - image.y
    return {
      x: Math.max(0, Math.min(image.width, dx * Math.cos(radians) - dy * Math.sin(radians))),
      y: Math.max(0, Math.min(image.height, dx * Math.sin(radians) + dy * Math.cos(radians)))
    }
  }

  const handleMouseDown = (event: Konva.KonvaEventObject<MouseEvent>): void => {
    const pointer = getPointer()
    const world = getWorldPointer()
    if (!pointer || !world) return

    const button = event.evt.button
    const shouldPan = tool === 'pan' || spacePressed || button === 1
    if (shouldPan) {
      event.evt.preventDefault()
      activeInteractionRef.current = 'pan'
      setPanStart({ pointer, camera: { x: camera.x, y: camera.y } })
      return
    }

    if (isCanvasControl(event.target)) return

    const targetIsStage = event.target === event.target.getStage()

    if (tool === 'crop') {
      const targetObject = objectForTarget(event.target)
      if (targetObject?.type !== 'image' || targetObject.locked) return
      const local = localPointInImage(targetObject, world)
      event.evt.preventDefault()
      activeInteractionRef.current = 'crop'
      setSelectedIds([targetObject.id])
      setCropDraft({ imageId: targetObject.id, start: local, current: local })
      setSmartGuideLines([])
      return
    }

    if (tool === 'select') {
      if (targetIsStage) {
        activeInteractionRef.current = 'marquee'
        setMarquee({ start: world, current: world, additive: event.evt.shiftKey || event.evt.ctrlKey || event.evt.metaKey })
      }
      return
    }

    if (tool === 'text') {
      if (!targetIsStage) return
      activeInteractionRef.current = 'draw'
      textDraggedRef.current = false
      setDrawStart(world)
      setPreviewObject(makeText(world, nextObjectZIndex(objects), toolStyle))
      return
    }

    if (tool === 'image') {
      if (!targetIsStage) return
      imageInputRef.current?.click()
      return
    }

    if (tool === 'vector') {
      if (!targetIsStage) return
      if (!vectorDraft) {
        setVectorDraft(makeVector(world, [0, 0], nextObjectZIndex(objects), toolStyle))
        setVectorHover(world)
        return
      }

      const lastIndex = vectorDraft.points.length - 2
      const lastWorld = { x: vectorDraft.x + vectorDraft.points[lastIndex], y: vectorDraft.y + vectorDraft.points[lastIndex + 1] }
      const adjusted = lockLineAngle(lastWorld, world, event.evt.shiftKey)
      const firstWorld = { x: vectorDraft.x + vectorDraft.points[0], y: vectorDraft.y + vectorDraft.points[1] }
      const closePath = vectorDraft.points.length >= 6 && Math.hypot(adjusted.x - firstWorld.x, adjusted.y - firstWorld.y) <= 10 / camera.zoom
      if (closePath) {
        finishVector(vectorDraft, true)
        return
      }

      const local = { x: adjusted.x - vectorDraft.x, y: adjusted.y - vectorDraft.y }
      const repeated = Math.hypot(local.x - vectorDraft.points[lastIndex], local.y - vectorDraft.points[lastIndex + 1]) < 1 / camera.zoom
      const nextDraft = repeated ? vectorDraft : { ...vectorDraft, points: [...vectorDraft.points, local.x, local.y] }
      if (event.evt.detail >= 2) finishVector(nextDraft, false)
      else setVectorDraft(nextDraft)
      return
    }

    if (tool === 'freehand') {
      activeInteractionRef.current = 'draw'
      setDrawStart(world)
      setPreviewObject(makeFreehand(world, [0, 0], nextObjectZIndex(objects), toolStyle))
      return
    }

    if (drawingTools.has(tool)) {
      if (!targetIsStage) return
      activeInteractionRef.current = 'draw'
      setDrawStart(world)
      if (tool === 'arrow' && toolStyle.arrowAutoBind) arrowStartBindingRef.current = findConnectorTarget(world)?.id
      const object = makeObjectForTool(tool, world, world, nextObjectZIndex(objects), toolStyle)
      setPreviewObject(object)
    }
  }

  const handleMouseMove = (event: Konva.KonvaEventObject<MouseEvent>): void => {
    const pointer = getPointer()
    const world = getWorldPointer()
    if (!pointer || !world) return
    setMouseWorld(world)
    setCursorHint(transformerCursorHint(event.target))

    if (tool === 'vector' && vectorDraft) {
      const lastIndex = vectorDraft.points.length - 2
      const lastWorld = { x: vectorDraft.x + vectorDraft.points[lastIndex], y: vectorDraft.y + vectorDraft.points[lastIndex + 1] }
      setVectorHover(lockLineAngle(lastWorld, world, event.evt.shiftKey))
    }

    if (panStart) {
      setCamera({
        ...camera,
        x: panStart.camera.x + pointer.x - panStart.pointer.x,
        y: panStart.camera.y + pointer.y - panStart.pointer.y
      })
      return
    }

    if (marquee) {
      setMarquee({ ...marquee, current: world })
      return
    }

    if (cropDraft) {
      const image = objects.find((object): object is ImageObject => object.id === cropDraft.imageId && object.type === 'image')
      if (image) setCropDraft({ ...cropDraft, current: localPointInImage(image, world) })
      return
    }

    if (drawStart && previewObject) {
      if (tool === 'text' && previewObject.type === 'text') {
        textDraggedRef.current = Math.abs(world.x - drawStart.x) >= 6 || Math.abs(world.y - drawStart.y) >= 6
        setPreviewObject(makeParagraphText(drawStart, world, previewObject.zIndex, toolStyle))
        return
      }

      if (tool === 'freehand' && previewObject.type === 'freehand') {
        setPreviewObject({
          ...previewObject,
          points: [...previewObject.points, world.x - drawStart.x, world.y - drawStart.y]
        })
        return
      }

      const adjusted = tool === 'line' || tool === 'arrow' ? lockLineAngle(drawStart, world, event.evt.shiftKey) : maybeSquare(drawStart, world, event.evt.shiftKey)
      setPreviewObject(makeObjectForTool(tool, drawStart, adjusted, previewObject.zIndex, toolStyle))
    }
  }

  const handleMouseUp = (): void => {
    const interaction = activeInteractionRef.current
    if (!interaction) return
    activeInteractionRef.current = null

    if (interaction === 'pan') {
      markDirty()
      setPanStart(null)
      return
    }

    setPanStart(null)

    if (interaction === 'crop' && cropDraft) {
      const image = objects.find((object): object is ImageObject => object.id === cropDraft.imageId && object.type === 'image')
      if (image) {
        const cropBounds = normalizeBounds(cropDraft.start, cropDraft.current)
        if (cropBounds.width >= 5 && cropBounds.height >= 5) {
          const source = image.crop ?? { x: 0, y: 0, width: image.naturalWidth, height: image.naturalHeight }
          const sourceCrop = {
            x: source.x + (cropBounds.x / image.width) * source.width,
            y: source.y + (cropBounds.y / image.height) * source.height,
            width: (cropBounds.width / image.width) * source.width,
            height: (cropBounds.height / image.height) * source.height
          }
          const radians = (image.rotation * Math.PI) / 180
          pushHistory({ camera, objects, guides })
          updateObject(image.id, {
            x: image.x + cropBounds.x * Math.cos(radians) - cropBounds.y * Math.sin(radians),
            y: image.y + cropBounds.x * Math.sin(radians) + cropBounds.y * Math.cos(radians),
            width: cropBounds.width,
            height: cropBounds.height,
            crop: sourceCrop
          })
          markDirty()
        }
      }
      setCropDraft(null)
      return
    }

    if (interaction === 'marquee' && marquee) {
      const selectionBounds = normalizeBounds(marquee.start, marquee.current)
      if (selectionBounds.width < 5 && selectionBounds.height < 5) {
        if (!marquee.additive) setSelectedIds([])
      } else {
        const idsInArea = objects
          .filter((object) => object.visible && !object.locked && boundsIntersect(selectionBounds, getObjectBounds(object)))
          .map((object) => object.id)
        setSelectedIds(marquee.additive ? Array.from(new Set([...selectedIds, ...idsInArea])) : idsInArea)
      }
      setMarquee(null)
      return
    }

    if (interaction !== 'draw' || !drawStart || !previewObject) return

    if (previewObject.type === 'text') {
      const isParagraph = textDraggedRef.current && previewObject.textMode === 'paragraph'
      const textObject = isParagraph ? previewObject : makeText(drawStart, previewObject.zIndex, toolStyle)
      commitObject(textObject)
      onEditText(textObject.id)
      textDraggedRef.current = false
    } else if (previewObject.type === 'freehand') {
      if (previewObject.points.length > 6) commitObject(previewObject)
    } else if (previewObject.type === 'line' || previewObject.type === 'arrow') {
      const distance = Math.hypot(previewObject.points[2] ?? 0, previewObject.points[3] ?? 0)
      if (distance >= 10) {
        if (previewObject.type === 'arrow') {
          const end = {
            x: previewObject.x + (previewObject.points[previewObject.points.length - 2] ?? 0),
            y: previewObject.y + (previewObject.points[previewObject.points.length - 1] ?? 0)
          }
          commitObject({
            ...previewObject,
            startBinding: toolStyle.arrowAutoBind ? arrowStartBindingRef.current : undefined,
            endBinding: toolStyle.arrowAutoBind ? findConnectorTarget(end)?.id : undefined
          })
        } else {
          commitObject(previewObject)
        }
      }
      arrowStartBindingRef.current = undefined
    } else if (previewObject.width >= 10 && previewObject.height >= 10) {
      commitObject(previewObject)
    }

    setDrawStart(null)
    setPreviewObject(null)
  }

  useEffect(() => {
    const handleWindowMouseUp = (): void => {
      if (activeInteractionRef.current) handleMouseUp()
    }

    window.addEventListener('mouseup', handleWindowMouseUp)
    return () => window.removeEventListener('mouseup', handleWindowMouseUp)
  })

  useEffect(() => {
    if (tool === 'vector') return
    setVectorDraft(null)
    setVectorHover(null)
  }, [tool])

  useEffect(() => {
    if (tool !== 'crop') setCropDraft(null)
  }, [tool])

  useEffect(() => {
    const clearTransientGuides = (): void => setSmartGuideLines([])
    window.addEventListener('mouseup', clearTransientGuides)
    window.addEventListener('pointercancel', clearTransientGuides)
    window.addEventListener('blur', clearTransientGuides)
    window.addEventListener('dragend', clearTransientGuides)
    return () => {
      window.removeEventListener('mouseup', clearTransientGuides)
      window.removeEventListener('pointercancel', clearTransientGuides)
      window.removeEventListener('blur', clearTransientGuides)
      window.removeEventListener('dragend', clearTransientGuides)
    }
  }, [setSmartGuideLines])

  useEffect(() => {
    if (!vectorDraft) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Enter') {
        event.preventDefault()
        finishVector(vectorDraft, false)
      } else if (event.key === 'Escape') {
        setVectorDraft(null)
        setVectorHover(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const handleWheel = (event: Konva.KonvaEventObject<WheelEvent>): void => {
    event.evt.preventDefault()
    const pointer = getPointer()
    if (!pointer) return

    if (event.evt.ctrlKey) {
      const scaleBy = 1.06
      const oldZoom = camera.zoom
      const world = screenToWorld(pointer, camera)
      const direction = event.evt.deltaY > 0 ? -1 : 1
      const zoom = clampZoom(direction > 0 ? oldZoom * scaleBy : oldZoom / scaleBy)
      setCamera({
        x: pointer.x - world.x * zoom,
        y: pointer.y - world.y * zoom,
        zoom
      })
      markDirty()
    } else {
      setCamera({
        ...camera,
        x: camera.x - event.evt.deltaX,
        y: camera.y - event.evt.deltaY
      })
      markDirty()
    }
  }

  const handleImageSelected = (file: File): void => {
    const center = screenToWorld({ x: width / 2, y: height / 2 }, camera)
    void importAssetFile(file, center)
  }

  const vectorPreview =
    vectorDraft && vectorHover
      ? {
          ...vectorDraft,
          points: [...vectorDraft.points, vectorHover.x - vectorDraft.x, vectorHover.y - vectorDraft.y]
        }
      : vectorDraft

  return (
    <>
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onMouseLeave={() => {
          setCursorHint(null)
          setSmartGuideLines([])
        }}
        className="canvas-stage-cursor"
      >
        <Layer>
          <Group x={camera.x} y={camera.y} scaleX={camera.zoom} scaleY={camera.zoom}>
            {sortedObjects.map((object) => (
              <ObjectRenderer
                key={object.id}
                object={object}
                registerNode={registerNode}
                getNode={getNode}
                onEditText={onEditText}
                editingId={editingId}
                navigationActive={tool === 'pan' || spacePressed || Boolean(panStart)}
              />
            ))}
            {previewObject ? (
              <ObjectRenderer object={previewObject} registerNode={() => undefined} getNode={getNode} onEditText={() => undefined} interactive={false} editingId={null} />
            ) : null}
            {previewObject?.type === 'text' && previewObject.textMode === 'paragraph' ? (
              <Rect
                x={previewObject.x}
                y={previewObject.y}
                width={previewObject.width}
                height={previewObject.height}
                fill="rgba(37, 99, 235, 0.08)"
                stroke="#60a5fa"
                strokeWidth={1 / camera.zoom}
                dash={[6 / camera.zoom, 4 / camera.zoom]}
                listening={false}
              />
            ) : null}
            {vectorPreview ? (
              <ObjectRenderer object={vectorPreview} registerNode={() => undefined} getNode={getNode} onEditText={() => undefined} interactive={false} editingId={null} />
            ) : null}
            <RectRadiusHandles />
            <VectorPointHandles />
            <PathPointHandles />
            {cropDraft ? (() => {
              const cropImage = objects.find((object): object is ImageObject => object.id === cropDraft.imageId && object.type === 'image')
              if (!cropImage) return null
              const bounds = normalizeBounds(cropDraft.start, cropDraft.current)
              return (
                <Group x={cropImage.x} y={cropImage.y} rotation={cropImage.rotation} listening={false}>
                  <Rect width={cropImage.width} height={cropImage.height} fill="rgba(2, 6, 23, 0.38)" />
                  <Rect
                    {...bounds}
                    fill="rgba(96, 165, 250, 0.12)"
                    stroke="#60a5fa"
                    strokeWidth={1.5 / camera.zoom}
                    dash={[7 / camera.zoom, 5 / camera.zoom]}
                  />
                </Group>
              )
            })() : null}
            {rulersVisible
              ? guides
                  .filter((guide) => guide.visible)
                  .map((guide) => (
                    <Line
                      key={guide.id}
                      x={guide.orientation === 'vertical' ? guide.position : 0}
                      y={guide.orientation === 'horizontal' ? guide.position : 0}
                      points={
                        guide.orientation === 'vertical'
                          ? [0, visibleWorldBounds.top, 0, visibleWorldBounds.bottom]
                          : [visibleWorldBounds.left, 0, visibleWorldBounds.right, 0]
                      }
                      stroke={selectedGuideId === guide.id ? '#38bdf8' : '#60a5fa'}
                      strokeWidth={(selectedGuideId === guide.id ? 1.5 : 1) / camera.zoom}
                      dash={[6 / camera.zoom, 5 / camera.zoom]}
                      hitStrokeWidth={10 / camera.zoom}
                      draggable={!guide.locked}
                      onClick={(event) => {
                        event.cancelBubble = true
                        setSelectedGuideId(guide.id)
                      }}
                      onDragStart={(event) => {
                        event.cancelBubble = true
                        setSelectedGuideId(guide.id)
                        pushHistory({ camera, objects, guides })
                      }}
                      onDragMove={(event) => {
                        if (guide.orientation === 'vertical') {
                          event.target.y(0)
                        } else {
                          event.target.x(0)
                        }
                      }}
                      onDragEnd={(event) => {
                        const nextPosition = guide.orientation === 'vertical' ? event.target.x() : event.target.y()
                        updateGuide(guide.id, { position: nextPosition })
                        markDirty()
                      }}
                    />
                  ))
              : null}
            {smartGuideLines.map((line, index) => (
              <Line
                key={`${line.orientation}-${line.position}-${index}`}
                points={
                  line.orientation === 'vertical'
                    ? [line.position, visibleWorldBounds.top, line.position, visibleWorldBounds.bottom]
                    : [visibleWorldBounds.left, line.position, visibleWorldBounds.right, line.position]
                }
                stroke="#ff4fd8"
                strokeWidth={1.25 / camera.zoom}
                listening={false}
              />
            ))}
            {marquee ? (
              <Rect
                {...normalizeBounds(marquee.start, marquee.current)}
                fill="rgba(37, 99, 235, 0.12)"
                stroke="#2563eb"
                strokeWidth={1 / camera.zoom}
                dash={[6 / camera.zoom, 4 / camera.zoom]}
                listening={false}
              />
            ) : null}
          </Group>
          <SelectionTransformer nodes={nodesRef.current} nodesVersion={nodesVersion} />
        </Layer>
      </Stage>
      <input
        ref={imageInputRef}
        className="hidden"
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml,.svg,.eps,application/postscript"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) handleImageSelected(file)
          event.currentTarget.value = ''
        }}
      />
    </>
  )
}

export default InfiniteCanvas
