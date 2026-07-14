import type { CanvasObject } from '@renderer/types/canvas'

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

export const normalizeBounds = (start: { x: number; y: number }, end: { x: number; y: number }): Bounds => ({
  x: Math.min(start.x, end.x),
  y: Math.min(start.y, end.y),
  width: Math.abs(end.x - start.x),
  height: Math.abs(end.y - start.y)
})

const pointsBounds = (object: CanvasObject): Bounds | null => {
  if (!(object.type === 'line' || object.type === 'arrow' || object.type === 'freehand' || object.type === 'vector') || object.points.length < 2) return null

  const xs: number[] = []
  const ys: number[] = []
  for (let index = 0; index < object.points.length; index += 2) {
    xs.push(object.points[index])
    ys.push(object.points[index + 1] ?? 0)
  }

  const padding = object.strokeWidth / 2 + 4
  const minX = Math.min(...xs) - padding
  const minY = Math.min(...ys) - padding
  const maxX = Math.max(...xs) + padding
  const maxY = Math.max(...ys) + padding
  return { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) }
}

const rotateLocalPoint = (x: number, y: number, degrees: number): { x: number; y: number } => {
  if (degrees === 0) return { x, y }
  const radians = (degrees * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return { x: x * cos - y * sin, y: x * sin + y * cos }
}

const objectBoundsFromLocal = (object: CanvasObject, local: Bounds): Bounds => {
  const corners = [
    rotateLocalPoint(local.x, local.y, object.rotation),
    rotateLocalPoint(local.x + local.width, local.y, object.rotation),
    rotateLocalPoint(local.x + local.width, local.y + local.height, object.rotation),
    rotateLocalPoint(local.x, local.y + local.height, object.rotation)
  ]
  const xs = corners.map((point) => object.x + point.x)
  const ys = corners.map((point) => object.y + point.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const maxX = Math.max(...xs)
  const maxY = Math.max(...ys)
  return { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) }
}

export const getObjectBounds = (object: CanvasObject): Bounds => {
  const local = pointsBounds(object) ?? { x: 0, y: 0, width: Math.max(1, object.width), height: Math.max(1, object.height) }
  return objectBoundsFromLocal(object, local)
}

export const boundsIntersect = (a: Bounds, b: Bounds): boolean =>
  a.x <= b.x + b.width && a.x + a.width >= b.x && a.y <= b.y + b.height && a.y + a.height >= b.y

export const boundsFromObjects = (objects: CanvasObject[], padding = 24): Bounds | null => {
  const visible = objects.filter((object) => object.visible)
  if (visible.length === 0) return null

  const bounds = visible.map(getObjectBounds)
  const minX = Math.min(...bounds.map((bound) => bound.x)) - padding
  const minY = Math.min(...bounds.map((bound) => bound.y)) - padding
  const maxX = Math.max(...bounds.map((bound) => bound.x + bound.width)) + padding
  const maxY = Math.max(...bounds.map((bound) => bound.y + bound.height)) + padding

  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY)
  }
}
