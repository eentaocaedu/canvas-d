import type { Camera, Point } from '@renderer/types/canvas'

export const screenToWorld = (point: Point, camera: Camera): Point => ({
  x: (point.x - camera.x) / camera.zoom,
  y: (point.y - camera.y) / camera.zoom
})

export const worldToScreen = (point: Point, camera: Camera): Point => ({
  x: point.x * camera.zoom + camera.x,
  y: point.y * camera.zoom + camera.y
})

export const clampZoom = (zoom: number): number => Math.min(4, Math.max(0.1, zoom))

