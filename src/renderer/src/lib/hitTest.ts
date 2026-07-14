import type { CanvasObject, Point } from '@renderer/types/canvas'

export const objectContainsPoint = (object: CanvasObject, point: Point): boolean => {
  return point.x >= object.x && point.x <= object.x + object.width && point.y >= object.y && point.y <= object.y + object.height
}

