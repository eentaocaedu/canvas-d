import type {
  ArrowObject,
  CanvasObject,
  CanvasTool,
  DiamondObject,
  EllipseObject,
  FrameObject,
  FreehandObject,
  ImageObject,
  LineObject,
  NoteObject,
  Point,
  RectObject,
  TextObject,
  PolygonObject,
  VectorObject
} from '@renderer/types/canvas'
import type { ToolStyle } from '@renderer/types/canvas'
import { measurePointText } from './textMetrics'

const defaultStyle: ToolStyle = {
  fill: '#1f2937',
  fillEnabled: true,
  stroke: '#d1d5db',
  strokeEnabled: true,
  strokeWidth: 2,
  radius: 10,
  fontFamily: 'Segoe UI',
  fontSize: 24,
  fontWeight: '500',
  fontStyle: 'normal',
  textFill: '#f3f4f6',
  align: 'left',
  lineHeight: 1.2,
  letterSpacing: 0,
  textDecoration: 'none',
  tension: 0.35,
  pointerLength: 12,
  pointerWidth: 12,
  pointerAtBeginning: false,
  pointerAtEnding: true,
  lineCap: 'round',
  strokePattern: 'solid',
  arrowRouting: 'straight',
  arrowAutoBind: false,
  polygonSides: 6,
  noteFoldSize: 24
}

const base = (type: CanvasObject['type'], point: Point, zIndex: number) => ({
  id: crypto.randomUUID(),
  type,
  name: `${type[0].toUpperCase()}${type.slice(1)}`,
  x: point.x,
  y: point.y,
  width: 120,
  height: 80,
  rotation: 0,
  opacity: 1,
  locked: false,
  visible: true,
  zIndex
})

export const makeFrame = (
  point: Point,
  width: number,
  height: number,
  zIndex: number,
  preset: FrameObject['preset'] = 'custom',
  background = '#111827'
): FrameObject => ({
  ...base('frame', point, zIndex),
  name: 'Frame',
  width,
  height,
  preset,
  background,
  clipContent: false
})

export const makeRect = (point: Point, width: number, height: number, zIndex: number, style: ToolStyle = defaultStyle): RectObject => ({
  ...base('rect', point, zIndex),
  name: 'Rectangle',
  width,
  height,
  radius: style.radius,
  cornerRadii: [style.radius, style.radius, style.radius, style.radius],
  fill: style.fillEnabled ? style.fill : 'transparent',
  stroke: style.strokeEnabled ? style.stroke : 'transparent',
  strokeWidth: style.strokeEnabled ? Math.max(1, style.strokeWidth) : 0
})

export const makeEllipse = (point: Point, width: number, height: number, zIndex: number, style: ToolStyle = defaultStyle): EllipseObject => ({
  ...base('ellipse', point, zIndex),
  name: 'Ellipse',
  width,
  height,
  fill: style.fillEnabled ? style.fill : 'transparent',
  stroke: style.strokeEnabled ? style.stroke : 'transparent',
  strokeWidth: style.strokeEnabled ? Math.max(1, style.strokeWidth) : 0
})

export const makeDiamond = (point: Point, width: number, height: number, zIndex: number, style: ToolStyle = defaultStyle): DiamondObject => ({
  ...base('diamond', point, zIndex),
  name: 'Losango',
  width,
  height,
  fill: style.fillEnabled ? style.fill : 'transparent',
  stroke: style.strokeEnabled ? style.stroke : 'transparent',
  strokeWidth: style.strokeEnabled ? Math.max(1, style.strokeWidth) : 0
})

export const makePolygon = (point: Point, width: number, height: number, zIndex: number, style: ToolStyle = defaultStyle): PolygonObject => ({
  ...base('polygon', point, zIndex),
  name: 'Poligono',
  width,
  height,
  sides: Math.max(3, Math.min(12, Math.round(style.polygonSides))),
  fill: style.fillEnabled ? style.fill : 'transparent',
  stroke: style.strokeEnabled ? style.stroke : 'transparent',
  strokeWidth: style.strokeEnabled ? Math.max(1, style.strokeWidth) : 0
})

export const makeNote = (point: Point, width: number, height: number, zIndex: number, style: ToolStyle = defaultStyle): NoteObject => ({
  ...base('note', point, zIndex),
  name: 'Nota',
  width,
  height,
  foldSize: Math.max(0, Math.min(Math.min(width, height) / 2, style.noteFoldSize)),
  fill: style.fillEnabled ? style.fill : 'transparent',
  stroke: style.strokeEnabled ? style.stroke : 'transparent',
  strokeWidth: style.strokeEnabled ? Math.max(1, style.strokeWidth) : 0
})

export const makeText = (
  point: Point,
  zIndex: number,
  style: ToolStyle = defaultStyle,
  options: { mode?: TextObject['textMode']; width?: number; height?: number } = {}
): TextObject => {
  const text = 'Digite aqui'
  const mode = options.mode ?? 'point'
  const pointSize = measurePointText({
    text,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    fontStyle: style.fontStyle,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing
  })

  return {
    ...base('text', point, zIndex),
    name: mode === 'point' ? 'Texto livre' : 'Texto de paragrafo',
    width: mode === 'point' ? pointSize.width : Math.max(24, options.width ?? 280),
    height: mode === 'point' ? pointSize.height : Math.max(pointSize.height, options.height ?? 96),
    text,
    textMode: mode,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    fontStyle: style.fontStyle,
    fill: style.textFill,
    align: style.align,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
    textDecoration: style.textDecoration
  }
}

export const makeParagraphText = (start: Point, current: Point, zIndex: number, style: ToolStyle = defaultStyle): TextObject => {
  const x = Math.min(start.x, current.x)
  const y = Math.min(start.y, current.y)
  const object = makeText({ x, y }, zIndex, style, {
    mode: 'paragraph',
    width: Math.abs(current.x - start.x),
    height: Math.abs(current.y - start.y)
  })
  return {
    ...object,
    width: Math.max(1, Math.abs(current.x - start.x)),
    height: Math.max(1, Math.abs(current.y - start.y))
  }
}

export const makeLine = (point: Point, points: number[], zIndex: number, style: ToolStyle = defaultStyle): LineObject => ({
  ...base('line', point, zIndex),
  name: 'Line',
  width: Math.abs(points[2] ?? 0),
  height: Math.abs(points[3] ?? 0),
  points,
  stroke: style.strokeEnabled ? style.stroke : 'transparent',
  strokeWidth: style.strokeEnabled ? Math.max(1, style.strokeWidth) : 0,
  lineCap: style.lineCap,
  strokePattern: style.strokePattern
})

export const makeArrow = (point: Point, points: number[], zIndex: number, style: ToolStyle = defaultStyle): ArrowObject => ({
  ...base('arrow', point, zIndex),
  name: 'Arrow',
  width: Math.abs(points[2] ?? 0),
  height: Math.abs(points[3] ?? 0),
  points,
  stroke: style.strokeEnabled ? style.stroke : 'transparent',
  strokeWidth: style.strokeEnabled ? Math.max(1, style.strokeWidth) : 0,
  pointerLength: style.pointerLength,
  pointerWidth: style.pointerWidth,
  pointerAtBeginning: style.pointerAtBeginning,
  pointerAtEnding: style.pointerAtEnding,
  lineCap: style.lineCap,
  strokePattern: style.strokePattern,
  routing: style.arrowRouting
})

export const makeFreehand = (point: Point, points: number[], zIndex: number, style: ToolStyle = defaultStyle): FreehandObject => ({
  ...base('freehand', point, zIndex),
  name: 'Freehand',
  width: 1,
  height: 1,
  points,
  stroke: style.strokeEnabled ? style.stroke : 'transparent',
  strokeWidth: style.strokeEnabled ? Math.max(1, style.strokeWidth) : 0,
  tension: style.tension,
  lineCap: style.lineCap,
  strokePattern: style.strokePattern
})

export const makeVector = (point: Point, points: number[], zIndex: number, style: ToolStyle = defaultStyle, closed = false): VectorObject => ({
  ...base('vector', point, zIndex),
  name: 'Caminho vetorial',
  width: 1,
  height: 1,
  points,
  closed,
  fill: closed && style.fillEnabled ? style.fill : 'transparent',
  stroke: style.strokeEnabled ? style.stroke : 'transparent',
  strokeWidth: style.strokeEnabled ? Math.max(1, style.strokeWidth) : 0,
  tension: 0,
  lineCap: style.lineCap,
  strokePattern: style.strokePattern
})

export const fitVectorToPoints = (object: VectorObject): VectorObject => {
  const xs = object.points.filter((_, index) => index % 2 === 0)
  const ys = object.points.filter((_, index) => index % 2 === 1)
  if (xs.length === 0 || ys.length === 0) return object
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const maxX = Math.max(...xs)
  const maxY = Math.max(...ys)
  return {
    ...object,
    x: object.x + minX,
    y: object.y + minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
    points: object.points.map((value, index) => value - (index % 2 === 0 ? minX : minY))
  }
}

export const makeImage = (point: Point, src: string, naturalWidth: number, naturalHeight: number, zIndex: number, isVector = false): ImageObject => {
  const safeNaturalWidth = Math.max(1, naturalWidth || 640)
  const safeNaturalHeight = Math.max(1, naturalHeight || 480)
  const maxWidth = 480
  const scale = Math.min(1, maxWidth / safeNaturalWidth)
  return {
    ...base('image', point, zIndex),
    name: isVector ? 'Vetor SVG' : 'Image',
    width: Math.max(80, Math.round(safeNaturalWidth * scale)),
    height: Math.max(80, Math.round(safeNaturalHeight * scale)),
    src,
    naturalWidth: safeNaturalWidth,
    naturalHeight: safeNaturalHeight,
    lockAspectRatio: true,
    isVector
  }
}

export const makeObjectForTool = (tool: CanvasTool, start: Point, current: Point, zIndex: number, style: ToolStyle = defaultStyle): CanvasObject | null => {
  const x = Math.min(start.x, current.x)
  const y = Math.min(start.y, current.y)
  const width = Math.abs(current.x - start.x)
  const height = Math.abs(current.y - start.y)
  const point = { x, y }

  if (tool === 'frame') return makeFrame(point, width, height, zIndex, 'custom', style.fillEnabled ? style.fill : 'transparent')
  if (tool === 'rect') return makeRect(point, width, height, zIndex, style)
  if (tool === 'ellipse') return makeEllipse(point, width, height, zIndex, style)
  if (tool === 'diamond') return makeDiamond(point, width, height, zIndex, style)
  if (tool === 'polygon') return makePolygon(point, width, height, zIndex, style)
  if (tool === 'note') return makeNote(point, width, height, zIndex, style)
  if (tool === 'line') return makeLine(start, [0, 0, current.x - start.x, current.y - start.y], zIndex, style)
  if (tool === 'arrow') return makeArrow(start, [0, 0, current.x - start.x, current.y - start.y], zIndex, style)
  return null
}

export const nextObjectZIndex = (objects: CanvasObject[]): number => Math.max(0, ...objects.map((object) => object.zIndex)) + 1
