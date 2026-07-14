import { Circle, Group } from 'react-konva'
import { fitVectorToPoints } from '@renderer/lib/objectFactory'
import { useCanvasStore } from '@renderer/store/useCanvasStore'
import { useHistoryStore } from '@renderer/store/useHistoryStore'
import { useWorkspaceStore } from '@renderer/store/useWorkspaceStore'

const VectorPointHandles = (): JSX.Element | null => {
  const tool = useCanvasStore((state) => state.tool)
  const selectedIds = useCanvasStore((state) => state.selectedIds)
  const objects = useCanvasStore((state) => state.objects)
  const camera = useCanvasStore((state) => state.camera)
  const guides = useCanvasStore((state) => state.guides)
  const updateObject = useCanvasStore((state) => state.updateObject)
  const pushHistory = useHistoryStore((state) => state.push)
  const markDirty = useWorkspaceStore((state) => state.markDirty)
  const object = selectedIds.length === 1 ? objects.find((candidate) => candidate.id === selectedIds[0] && candidate.type === 'vector') : null

  if (!object || object.type !== 'vector' || object.locked || (tool !== 'select' && tool !== 'vector')) return null

  const pointCount = Math.floor(object.points.length / 2)

  return (
    <Group x={object.x} y={object.y} rotation={object.rotation}>
      {Array.from({ length: pointCount }, (_, index) => {
        const pointIndex = index * 2
        return (
          <Circle
            key={`${object.id}-${index}`}
            name="vector-point-handle"
            x={object.points[pointIndex]}
            y={object.points[pointIndex + 1]}
            radius={4.5 / camera.zoom}
            fill="#f8fafc"
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
              if (current?.type !== 'vector') return
              const nextPoints = [...current.points]
              nextPoints[pointIndex] = event.target.x()
              nextPoints[pointIndex + 1] = event.target.y()
              updateObject(object.id, { points: nextPoints })
            }}
            onDragEnd={(event) => {
              event.cancelBubble = true
              const current = useCanvasStore.getState().objects.find((candidate) => candidate.id === object.id)
              if (current?.type === 'vector') updateObject(object.id, fitVectorToPoints(current))
              markDirty()
            }}
            onDblClick={(event) => {
              event.cancelBubble = true
              if (pointCount <= 2) return
              pushHistory({ camera, objects, guides })
              const nextPoints = object.points.filter((_, valueIndex) => valueIndex !== pointIndex && valueIndex !== pointIndex + 1)
              updateObject(object.id, fitVectorToPoints({ ...object, points: nextPoints }))
              markDirty()
            }}
          />
        )
      })}
    </Group>
  )
}

export default VectorPointHandles
