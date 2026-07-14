import { useRef } from 'react'
import { Circle, Group } from 'react-konva'
import type Konva from 'konva'
import { useCanvasStore } from '@renderer/store/useCanvasStore'
import { useHistoryStore } from '@renderer/store/useHistoryStore'
import { useWorkspaceStore } from '@renderer/store/useWorkspaceStore'

type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

const RectRadiusHandles = (): JSX.Element | null => {
  const draggingCornerRef = useRef<Corner | null>(null)
  const tool = useCanvasStore((state) => state.tool)
  const selectedIds = useCanvasStore((state) => state.selectedIds)
  const objects = useCanvasStore((state) => state.objects)
  const camera = useCanvasStore((state) => state.camera)
  const guides = useCanvasStore((state) => state.guides)
  const updateObject = useCanvasStore((state) => state.updateObject)
  const pushHistory = useHistoryStore((state) => state.push)
  const markDirty = useWorkspaceStore((state) => state.markDirty)
  const object = selectedIds.length === 1 ? objects.find((candidate) => candidate.id === selectedIds[0] && candidate.type === 'rect') : null

  if (!object || object.type !== 'rect' || object.locked || (tool !== 'select' && tool !== 'rect')) return null

  const maxRadius = Math.max(0, Math.min(object.width, object.height) / 2)
  const handleRadius = 4.5 / camera.zoom
  const corners: Corner[] = ['top-left', 'top-right', 'bottom-right', 'bottom-left']
  const radii = object.cornerRadii ?? [object.radius, object.radius, object.radius, object.radius]

  const positionFor = (corner: Corner, inset: number): { x: number; y: number } => ({
    x: corner.includes('right') ? object.width - inset : inset,
    y: corner.includes('bottom') ? object.height - inset : inset
  })

  const radiusFromNode = (corner: Corner, node: Konva.Circle): number => {
    const horizontal = corner.includes('right') ? object.width - node.x() : node.x()
    const vertical = corner.includes('bottom') ? object.height - node.y() : node.y()
    return clamp(Math.min(horizontal, vertical), 0, maxRadius)
  }

  return (
    <Group x={object.x} y={object.y} rotation={object.rotation}>
      {corners.map((corner, cornerIndex) => {
        const actualRadius = clamp(radii[cornerIndex] ?? object.radius, 0, maxRadius)
        const visibleInset = draggingCornerRef.current === corner ? actualRadius : clamp(Math.max(actualRadius, 12 / camera.zoom), 0, maxRadius)
        return (
        <Circle
          key={corner}
          name={`radius-handle ${corner}`}
          {...positionFor(corner, visibleInset)}
          radius={handleRadius}
          fill="#f8fafc"
          stroke="#2563eb"
          strokeWidth={1.5 / camera.zoom}
          draggable
          hitStrokeWidth={8 / camera.zoom}
          onDragStart={(event) => {
            event.cancelBubble = true
            draggingCornerRef.current = corner
            pushHistory({ camera, objects, guides })
          }}
          onDragMove={(event) => {
            event.cancelBubble = true
            const radius = radiusFromNode(corner, event.target as Konva.Circle)
            event.target.position(positionFor(corner, radius))
            if (event.evt.shiftKey) {
              const nextRadii = [...radii] as [number, number, number, number]
              nextRadii[cornerIndex] = radius
              updateObject(object.id, { cornerRadii: nextRadii, radius: Math.max(...nextRadii) })
            } else {
              updateObject(object.id, { radius, cornerRadii: [radius, radius, radius, radius] })
            }
          }}
          onDragEnd={(event) => {
            event.cancelBubble = true
            draggingCornerRef.current = null
            markDirty()
          }}
        />
        )
      })}
    </Group>
  )
}

export default RectRadiusHandles
