import Konva from 'konva'
import svgpath from 'svgpath'
import type { PathObject } from '@renderer/types/canvas'

export type PathSegment = [string, ...number[]]

export interface NormalizedPath {
  data: string
  offsetX: number
  offsetY: number
  width: number
  height: number
}

export interface PathHandle {
  id: string
  segmentIndex: number
  xIndex: number
  yIndex: number
  kind: 'anchor' | 'control'
  x: number
  y: number
  linkX?: number
  linkY?: number
}

const canonicalPath = (data: string): string => {
  const path = svgpath(data).abs().unshort().unarc()
  path.iterate((segment, _index, x, y) => {
    if (segment[0] === 'H') return [['L', segment[1], y]]
    if (segment[0] === 'V') return [['L', x, segment[1]]]
    return undefined
  })
  return path.round(4).toString()
}

export const pathSegments = (data: string): PathSegment[] => {
  const segments: PathSegment[] = []
  svgpath(canonicalPath(data)).iterate((segment) => {
    segments.push([...segment] as PathSegment)
  })
  return segments
}

export const serializePathSegments = (segments: PathSegment[]): string =>
  segments
    .map((segment) => `${segment[0]}${segment.slice(1).map((value) => (Number.isInteger(value) ? String(value) : Number(value.toFixed(4)))).join(' ')}`)
    .join(' ')

export const normalizePathData = (data: string): NormalizedPath => {
  const canonical = canonicalPath(data)
  const shape = new Konva.Path({ data: canonical })
  const bounds = shape.getClientRect({ skipTransform: true, skipStroke: true, skipShadow: true })
  shape.destroy()
  const width = Math.max(0.001, bounds.width)
  const height = Math.max(0.001, bounds.height)
  return {
    data: svgpath(canonical).translate(-bounds.x, -bounds.y).round(4).toString(),
    offsetX: bounds.x,
    offsetY: bounds.y,
    width,
    height
  }
}

export const pathHandles = (data: string): PathHandle[] => {
  const segments = pathSegments(data)
  const handles: PathHandle[] = []
  let currentX = 0
  let currentY = 0
  let contourX = 0
  let contourY = 0

  segments.forEach((segment, segmentIndex) => {
    const command = segment[0]
    if (command === 'Z') {
      currentX = contourX
      currentY = contourY
      return
    }
    const endpointIndex = command === 'C' ? 5 : command === 'Q' ? 3 : command === 'M' || command === 'L' ? 1 : -1
    if (command === 'C') {
      handles.push({ id: `${segmentIndex}-c1`, segmentIndex, xIndex: 1, yIndex: 2, kind: 'control', x: segment[1], y: segment[2], linkX: currentX, linkY: currentY })
      handles.push({ id: `${segmentIndex}-c2`, segmentIndex, xIndex: 3, yIndex: 4, kind: 'control', x: segment[3], y: segment[4], linkX: segment[5], linkY: segment[6] })
    } else if (command === 'Q') {
      handles.push({ id: `${segmentIndex}-q`, segmentIndex, xIndex: 1, yIndex: 2, kind: 'control', x: segment[1], y: segment[2], linkX: currentX, linkY: currentY })
    }
    if (endpointIndex >= 0) {
      const x = segment[endpointIndex]
      const y = segment[endpointIndex + 1]
      handles.push({ id: `${segmentIndex}-a`, segmentIndex, xIndex: endpointIndex, yIndex: endpointIndex + 1, kind: 'anchor', x, y })
      currentX = x
      currentY = y
      if (command === 'M') {
        contourX = x
        contourY = y
      }
    }
  })
  return handles
}

export const updatePathHandle = (object: PathObject, handle: PathHandle, displayX: number, displayY: number): Partial<PathObject> => {
  const scaleX = object.width / Math.max(0.001, object.sourceWidth)
  const scaleY = object.height / Math.max(0.001, object.sourceHeight)
  const segments = pathSegments(object.data)
  const segment = segments[handle.segmentIndex]
  if (!segment) return {}
  segment[handle.xIndex] = displayX / scaleX
  segment[handle.yIndex] = displayY / scaleY
  const normalized = normalizePathData(serializePathSegments(segments))
  const radians = (object.rotation * Math.PI) / 180
  const localOffsetX = normalized.offsetX * scaleX
  const localOffsetY = normalized.offsetY * scaleY
  return {
    x: object.x + localOffsetX * Math.cos(radians) - localOffsetY * Math.sin(radians),
    y: object.y + localOffsetX * Math.sin(radians) + localOffsetY * Math.cos(radians),
    width: Math.max(1, normalized.width * scaleX),
    height: Math.max(1, normalized.height * scaleY),
    sourceWidth: normalized.width,
    sourceHeight: normalized.height,
    data: normalized.data
  }
}
