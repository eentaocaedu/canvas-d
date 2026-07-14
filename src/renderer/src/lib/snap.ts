import { getObjectBounds, type Bounds } from './bounds'
import type { Camera, CanvasGuide, CanvasObject, SmartGuideLine } from '@renderer/types/canvas'

interface SnapResult {
  x: number
  y: number
  lines: SmartGuideLine[]
}

interface SnapCandidate {
  position: number
  linePosition?: number
  orientation: 'horizontal' | 'vertical'
}

type ResizeAnchor =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'middle-left'
  | 'middle-right'
  | 'top-center'
  | 'bottom-center'
  | string
  | null

export interface SnapBoxResult {
  box: Bounds
  lines: SmartGuideLine[]
}

const boundsPoints = (bounds: Bounds): { x: number[]; y: number[] } => ({
  x: [bounds.x, bounds.x + bounds.width / 2, bounds.x + bounds.width],
  y: [bounds.y, bounds.y + bounds.height / 2, bounds.y + bounds.height]
})

const collectSnapCandidates = (objects: CanvasObject[], guides: CanvasGuide[], excludeIds = new Set<string>()): SnapCandidate[] => {
  const candidates: SnapCandidate[] = []

  for (const candidate of objects) {
    if (excludeIds.has(candidate.id) || !candidate.visible) continue
    const bounds = getObjectBounds(candidate)
    candidates.push({ orientation: 'vertical', position: bounds.x })
    candidates.push({ orientation: 'vertical', position: bounds.x + bounds.width / 2 })
    candidates.push({ orientation: 'vertical', position: bounds.x + bounds.width })
    candidates.push({ orientation: 'horizontal', position: bounds.y })
    candidates.push({ orientation: 'horizontal', position: bounds.y + bounds.height / 2 })
    candidates.push({ orientation: 'horizontal', position: bounds.y + bounds.height })
  }

  for (const guide of guides) {
    if (!guide.visible) continue
    candidates.push({ orientation: guide.orientation, position: guide.position })
  }

  return candidates
}

const snapBoundsToCandidates = (bounds: Bounds, nextPosition: { x: number; y: number }, candidates: SnapCandidate[], threshold: number): SnapResult => {
  const movingBounds = { ...bounds, x: nextPosition.x, y: nextPosition.y }
  const moving = boundsPoints(movingBounds)
  let dx = 0
  let dy = 0
  let xDistance = threshold
  let yDistance = threshold
  const lines: SmartGuideLine[] = []

  for (const candidate of candidates) {
    if (candidate.orientation === 'vertical') {
      for (const point of moving.x) {
        const distance = Math.abs(candidate.position - point)
        if (distance <= xDistance) {
          xDistance = distance
          dx = candidate.position - point
          lines[0] = { orientation: 'vertical', position: candidate.linePosition ?? candidate.position }
        }
      }
    } else {
      for (const point of moving.y) {
        const distance = Math.abs(candidate.position - point)
        if (distance <= yDistance) {
          yDistance = distance
          dy = candidate.position - point
          lines[1] = { orientation: 'horizontal', position: candidate.linePosition ?? candidate.position }
        }
      }
    }
  }

  return {
    x: nextPosition.x + dx,
    y: nextPosition.y + dy,
    lines: lines.filter(Boolean)
  }
}

export const snapObjectPosition = (
  object: CanvasObject,
  nextPosition: { x: number; y: number },
  objects: CanvasObject[],
  guides: CanvasGuide[],
  threshold: number
): SnapResult => {
  const currentBounds = getObjectBounds(object)
  const movingBounds = getObjectBounds({ ...object, x: nextPosition.x, y: nextPosition.y } as CanvasObject)
  const offset = { x: movingBounds.x - nextPosition.x, y: movingBounds.y - nextPosition.y }
  const snapped = snapBoundsPosition(currentBounds, { x: movingBounds.x, y: movingBounds.y }, objects, guides, threshold, new Set([object.id]))

  return {
    x: snapped.x - offset.x,
    y: snapped.y - offset.y,
    lines: snapped.lines
  }
}

export const snapBoundsPosition = (
  bounds: Bounds,
  nextPosition: { x: number; y: number },
  objects: CanvasObject[],
  guides: CanvasGuide[],
  threshold: number,
  excludeIds = new Set<string>()
): SnapResult => snapBoundsToCandidates(bounds, nextPosition, collectSnapCandidates(objects, guides, excludeIds), threshold)

const toScreenCandidates = (objects: CanvasObject[], guides: CanvasGuide[], camera: Camera, excludeIds: Set<string>): SnapCandidate[] =>
  collectSnapCandidates(objects, guides, excludeIds).map((candidate) => ({
    ...candidate,
    linePosition: candidate.position,
    position: candidate.position * camera.zoom + (candidate.orientation === 'vertical' ? camera.x : camera.y)
  }))

const closestCandidate = (position: number, candidates: SnapCandidate[], orientation: 'horizontal' | 'vertical', threshold: number): SnapCandidate | null => {
  let closest: SnapCandidate | null = null
  let distance = threshold

  for (const candidate of candidates) {
    if (candidate.orientation !== orientation) continue
    const nextDistance = Math.abs(candidate.position - position)
    if (nextDistance <= distance) {
      distance = nextDistance
      closest = candidate
    }
  }

  return closest
}

export const snapResizeBox = (
  newBox: Bounds,
  objects: CanvasObject[],
  guides: CanvasGuide[],
  camera: Camera,
  threshold: number,
  excludeIds: Set<string>,
  anchor: ResizeAnchor
): SnapBoxResult => {
  const candidates = toScreenCandidates(objects, guides, camera, excludeIds)
  const box = { ...newBox }
  const lines: SmartGuideLine[] = []
  const snapLeft = anchor?.includes('left')
  const snapRight = anchor?.includes('right')
  const snapTop = anchor?.includes('top')
  const snapBottom = anchor?.includes('bottom')

  if (snapLeft) {
    const candidate = closestCandidate(box.x, candidates, 'vertical', threshold)
    if (candidate) {
      const right = box.x + box.width
      const nextWidth = right - candidate.position
      if (nextWidth >= 8) {
        box.x = candidate.position
        box.width = nextWidth
        lines.push({ orientation: 'vertical', position: candidate.linePosition ?? candidate.position })
      }
    }
  } else if (snapRight) {
    const candidate = closestCandidate(box.x + box.width, candidates, 'vertical', threshold)
    if (candidate) {
      const nextWidth = candidate.position - box.x
      if (nextWidth >= 8) {
        box.width = nextWidth
        lines.push({ orientation: 'vertical', position: candidate.linePosition ?? candidate.position })
      }
    }
  }

  if (snapTop) {
    const candidate = closestCandidate(box.y, candidates, 'horizontal', threshold)
    if (candidate) {
      const bottom = box.y + box.height
      const nextHeight = bottom - candidate.position
      if (nextHeight >= 8) {
        box.y = candidate.position
        box.height = nextHeight
        lines.push({ orientation: 'horizontal', position: candidate.linePosition ?? candidate.position })
      }
    }
  } else if (snapBottom) {
    const candidate = closestCandidate(box.y + box.height, candidates, 'horizontal', threshold)
    if (candidate) {
      const nextHeight = candidate.position - box.y
      if (nextHeight >= 8) {
        box.height = nextHeight
        lines.push({ orientation: 'horizontal', position: candidate.linePosition ?? candidate.position })
      }
    }
  }

  return { box, lines }
}
