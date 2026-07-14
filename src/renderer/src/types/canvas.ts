export type CanvasTool =
  | 'select'
  | 'pan'
  | 'frame'
  | 'rect'
  | 'ellipse'
  | 'diamond'
  | 'polygon'
  | 'note'
  | 'line'
  | 'arrow'
  | 'vector'
  | 'text'
  | 'freehand'
  | 'image'
  | 'crop'
export type CanvasCursorHint = 'resize-ew' | 'resize-ns' | 'resize-nesw' | 'resize-nwse' | null

export interface Camera {
  x: number
  y: number
  zoom: number
}

export interface CanvasSnapshot {
  camera: Camera
  objects: CanvasObject[]
  guides?: CanvasGuide[]
}

export interface BaseObject {
  id: string
  type: string
  name: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  locked: boolean
  visible: boolean
  zIndex: number
}

export type FillableObject = FrameObject | RectObject | EllipseObject | DiamondObject | PolygonObject | NoteObject | VectorObject | PathObject | TextObject
export type StrokedObject = RectObject | EllipseObject | DiamondObject | PolygonObject | NoteObject | LineObject | ArrowObject | VectorObject | PathObject | FreehandObject

export interface FrameObject extends BaseObject {
  type: 'frame'
  preset: 'desktop' | 'mobile' | 'tablet' | 'instagram' | 'custom'
  background: string
  clipContent: boolean
}

export interface RectObject extends BaseObject {
  type: 'rect'
  radius: number
  cornerRadii?: [number, number, number, number]
  fill: string
  stroke: string
  strokeWidth: number
}

export interface EllipseObject extends BaseObject {
  type: 'ellipse'
  fill: string
  stroke: string
  strokeWidth: number
}

export interface DiamondObject extends BaseObject {
  type: 'diamond'
  fill: string
  stroke: string
  strokeWidth: number
}

export interface PolygonObject extends BaseObject {
  type: 'polygon'
  sides: number
  fill: string
  stroke: string
  strokeWidth: number
}

export interface NoteObject extends BaseObject {
  type: 'note'
  foldSize: number
  fill: string
  stroke: string
  strokeWidth: number
}

export interface TextObject extends BaseObject {
  type: 'text'
  text: string
  textMode?: 'point' | 'paragraph'
  fontFamily: string
  fontSize: number
  fontWeight: string
  fontStyle?: 'normal' | 'italic'
  fill: string
  align: 'left' | 'center' | 'right' | 'justify'
  lineHeight: number
  letterSpacing?: number
  textDecoration?: 'none' | 'underline' | 'line-through'
}

export interface LineObject extends BaseObject {
  type: 'line'
  points: number[]
  stroke: string
  strokeWidth: number
  lineCap?: 'butt' | 'round' | 'square'
  strokePattern?: 'solid' | 'dashed' | 'dotted'
}

export interface ArrowObject extends BaseObject {
  type: 'arrow'
  points: number[]
  stroke: string
  strokeWidth: number
  pointerLength: number
  pointerWidth: number
  pointerAtBeginning?: boolean
  pointerAtEnding?: boolean
  lineCap?: 'butt' | 'round' | 'square'
  strokePattern?: 'solid' | 'dashed' | 'dotted'
  routing?: 'straight' | 'elbow'
  startBinding?: string
  endBinding?: string
}

export interface ImageObject extends BaseObject {
  type: 'image'
  src: string
  naturalWidth: number
  naturalHeight: number
  lockAspectRatio?: boolean
  isVector?: boolean
  crop?: {
    x: number
    y: number
    width: number
    height: number
  }
}

export interface FreehandObject extends BaseObject {
  type: 'freehand'
  points: number[]
  stroke: string
  strokeWidth: number
  tension: number
  lineCap?: 'butt' | 'round' | 'square'
  strokePattern?: 'solid' | 'dashed' | 'dotted'
}

export interface VectorObject extends BaseObject {
  type: 'vector'
  points: number[]
  closed: boolean
  fill: string
  stroke: string
  strokeWidth: number
  tension: number
  lineCap?: 'butt' | 'round' | 'square'
  strokePattern?: 'solid' | 'dashed' | 'dotted'
}

export interface PathObject extends BaseObject {
  type: 'path'
  data: string
  sourceWidth: number
  sourceHeight: number
  fill: string
  stroke: string
  strokeWidth: number
  fillRule?: 'nonzero' | 'evenodd'
  lineJoin?: 'miter' | 'round' | 'bevel'
  lineCap?: 'butt' | 'round' | 'square'
  strokePattern?: 'solid' | 'dashed' | 'dotted'
}

export interface GroupObject extends BaseObject {
  type: 'group'
  children: CanvasObject[]
}

export type CanvasObject =
  | FrameObject
  | RectObject
  | EllipseObject
  | DiamondObject
  | PolygonObject
  | NoteObject
  | TextObject
  | LineObject
  | ArrowObject
  | ImageObject
  | FreehandObject
  | VectorObject
  | PathObject
  | GroupObject

export interface Point {
  x: number
  y: number
}

export interface ToolStyle {
  fill: string
  fillEnabled: boolean
  stroke: string
  strokeEnabled: boolean
  strokeWidth: number
  radius: number
  fontFamily: string
  fontSize: number
  fontWeight: string
  fontStyle: 'normal' | 'italic'
  textFill: string
  align: 'left' | 'center' | 'right' | 'justify'
  lineHeight: number
  letterSpacing: number
  textDecoration: 'none' | 'underline' | 'line-through'
  tension: number
  pointerLength: number
  pointerWidth: number
  pointerAtBeginning: boolean
  pointerAtEnding: boolean
  lineCap: 'butt' | 'round' | 'square'
  strokePattern: 'solid' | 'dashed' | 'dotted'
  arrowRouting: 'straight' | 'elbow'
  arrowAutoBind: boolean
  polygonSides: number
  noteFoldSize: number
}

export interface CanvasGuide {
  id: string
  orientation: 'horizontal' | 'vertical'
  position: number
  locked: boolean
  visible: boolean
}

export interface SmartGuideLine {
  orientation: 'horizontal' | 'vertical'
  position: number
}
