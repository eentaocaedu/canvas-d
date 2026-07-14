import { Circle, Group, Line } from 'react-konva'
import { pathHandles, updatePathHandle } from '@renderer/lib/nativePath'
import { useCanvasStore } from '@renderer/store/useCanvasStore'
import { useHistoryStore } from '@renderer/store/useHistoryStore'
import { useWorkspaceStore } from '@renderer/store/useWorkspaceStore'

const PathPointHandles = (): JSX.Element | null => {
  const tool = useCanvasStore((state) => state.tool)
  const selectedIds = useCanvasStore((state) => state.selectedIds)
  const objects = useCanvasStore((state) => state.objects)
  const camera = useCanvasStore((state) => state.camera)
  const guides = useCanvasStore((state) => state.guides)
  const updateObject = useCanvasStore((state) => state.updateObject)
  const pushHistory = useHistoryStore((state) => state.push)
  const markDirty = useWorkspaceStore((state) => state.markDirty)
  const object = selectedIds.length === 1 ? objects.find((candidate) => candidate.id === selectedIds[0] && candidate.type === 'path') : null

  if (!object || object.type !== 'path' || object.locked || (tool !== 'select' && tool !== 'vector')) return null
  const scaleX = object.width / Math.max(0.001, object.sourceWidth)
  const scaleY = object.height / Math.max(0.001, object.sourceHeight)
  const handles = pathHandles(object.data)

  return (
    <Group x={object.x} y={object.y} rotation={object.rotation}>
      {handles.filter((handle) => handle.kind === 'control' && handle.linkX !== undefined && handle.linkY !== undefined).map((handle) => (
        <Line
          key={`line-${handle.id}`}
          points={[handle.x * scaleX, handle.y * scaleY, (handle.linkX ?? 0) * scaleX, (handle.linkY ?? 0) * scaleY]}
          stroke="#ec4899"
          strokeWidth={1 / camera.zoom}
          dash={[4 / camera.zoom, 3 / camera.zoom]}
          listening={false}
        />
      ))}
      {handles.map((handle) => (
        <Circle
          key={handle.id}
          name="path-point-handle"
          x={handle.x * scaleX}
          y={handle.y * scaleY}
          radius={(handle.kind === 'anchor' ? 4.5 : 3.5) / camera.zoom}
          fill={handle.kind === 'anchor' ? '#f8fafc' : '#ec4899'}
          stroke="#ec4899"
          strokeWidth={1.5 / camera.zoom}
          hitStrokeWidth={8 / camera.zoom}
          draggable
          onDragStart={(event) => {
            event.cancelBubble = true
            pushHistory({ camera, objects, guides })
          }}
          onDragMove={(event) => {
            event.cancelBubble = true
            const current = useCanvasStore.getState().objects.find((candidate) => candidate.id === object.id)
            if (current?.type !== 'path') return
            updateObject(object.id, updatePathHandle(current, handle, event.target.x(), event.target.y()))
          }}
          onDragEnd={(event) => {
            event.cancelBubble = true
            markDirty()
          }}
        />
      ))}
    </Group>
  )
}

export default PathPointHandles
