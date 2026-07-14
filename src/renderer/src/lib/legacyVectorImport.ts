import svgpath from 'svgpath'
import { normalizePathData } from './nativePath'
import type { SvgImportResult } from './svgImport'
import type { CanvasObject, PathObject } from '@renderer/types/canvas'

type Matrix = [number, number, number, number, number, number]
type PaintOperation = 'stroke' | 'closeStroke' | 'fill' | 'eoFill' | 'fillStroke' | 'eoFillStroke' | 'closeFillStroke' | 'closeEOFillStroke'

interface VectorState {
  matrix: Matrix
  fill: string
  stroke: string
  fillOpacity: number
  strokeOpacity: number
  lineWidth: number
  lineCap: PathObject['lineCap']
  lineJoin: PathObject['lineJoin']
  dash: number[]
}

const identity: Matrix = [1, 0, 0, 1, 0, 0]

const multiply = (left: Matrix, right: Matrix): Matrix => [
  left[0] * right[0] + left[2] * right[1],
  left[1] * right[0] + left[3] * right[1],
  left[0] * right[2] + left[2] * right[3],
  left[1] * right[2] + left[3] * right[3],
  left[0] * right[4] + left[2] * right[5] + left[4],
  left[1] * right[4] + left[3] * right[5] + left[5]
]

const cloneState = (state: VectorState): VectorState => ({ ...state, matrix: [...state.matrix], dash: [...state.dash] })
const cleanNumber = (value: number): string => Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)))

const paintWithOpacity = (paint: string, opacity: number): string => {
  if (paint === 'transparent' || opacity <= 0) return 'transparent'
  if (opacity >= 0.999 || !/^#[0-9a-f]{6}$/i.test(paint)) return paint
  const r = Number.parseInt(paint.slice(1, 3), 16)
  const g = Number.parseInt(paint.slice(3, 5), 16)
  const b = Number.parseInt(paint.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${Number(opacity.toFixed(3))})`
}

const linePattern = (dash: number[]): PathObject['strokePattern'] => {
  if (dash.length === 0) return 'solid'
  return dash[0] <= 2 ? 'dotted' : 'dashed'
}

const transformedPathObject = (
  data: string,
  matrix: Matrix,
  state: VectorState,
  paintOp: PaintOperation,
  name: string,
  zIndex: number
): PathObject | null => {
  const strokeOps = new Set<PaintOperation>(['stroke', 'closeStroke', 'fillStroke', 'eoFillStroke', 'closeFillStroke', 'closeEOFillStroke'])
  const fillOps = new Set<PaintOperation>(['fill', 'eoFill', 'fillStroke', 'eoFillStroke', 'closeFillStroke', 'closeEOFillStroke'])
  const closedOps = new Set<PaintOperation>(['closeStroke', 'closeFillStroke', 'closeEOFillStroke'])
  const evenOddOps = new Set<PaintOperation>(['eoFill', 'eoFillStroke', 'closeEOFillStroke'])
  const transformed = svgpath(data).matrix(matrix).round(4).toString() + (closedOps.has(paintOp) ? ' Z' : '')
  try {
    const normalized = normalizePathData(transformed)
    const scale = (Math.hypot(matrix[0], matrix[1]) + Math.hypot(matrix[2], matrix[3])) / 2
    return {
      id: crypto.randomUUID(),
      type: 'path',
      name,
      x: normalized.offsetX,
      y: normalized.offsetY,
      width: normalized.width,
      height: normalized.height,
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
      zIndex,
      data: normalized.data,
      sourceWidth: normalized.width,
      sourceHeight: normalized.height,
      fill: fillOps.has(paintOp) ? paintWithOpacity(state.fill, state.fillOpacity) : 'transparent',
      stroke: strokeOps.has(paintOp) ? paintWithOpacity(state.stroke, state.strokeOpacity) : 'transparent',
      strokeWidth: strokeOps.has(paintOp) ? Math.max(0.25, state.lineWidth * scale) : 0,
      fillRule: evenOddOps.has(paintOp) ? 'evenodd' : 'nonzero',
      lineCap: state.lineCap,
      lineJoin: state.lineJoin,
      strokePattern: linePattern(state.dash)
    }
  } catch {
    return null
  }
}

type EpsStackValue = number | string | number[]

const cmykToHex = (c: number, m: number, y: number, k: number): string => {
  const values = [c, m, y].map((value) => Math.round(255 * (1 - Math.min(1, value)) * (1 - Math.min(1, k))))
  return `#${values.map((value) => value.toString(16).padStart(2, '0')).join('')}`
}

const rgbToHex = (r: number, g: number, b: number): string => `#${[r, g, b].map((value) => Math.round(Math.max(0, Math.min(1, value)) * 255).toString(16).padStart(2, '0')).join('')}`

const epsSourceWithoutResources = (source: string): string => {
  const removable = ['Prolog', 'Setup', 'Resource', 'Binary', 'Data']
  let cleaned = source
  for (const section of removable) cleaned = cleaned.replace(new RegExp(`%%Begin${section}[^\\n]*[\\s\\S]*?%%End${section}[^\\n]*`, 'gi'), '')
  return cleaned
}

const importEps = (bytes: Uint8Array, name: string): SvgImportResult => {
  const source = new TextDecoder('latin1').decode(bytes)
  const boxMatch = source.match(/^%%(?:HiRes)?BoundingBox:\s*([\d+-.]+)\s+([\d+-.]+)\s+([\d+-.]+)\s+([\d+-.]+)/mi)
  if (!boxMatch) throw new Error('O EPS nao possui BoundingBox valido.')
  const [llx, lly, urx, ury] = boxMatch.slice(1).map(Number)
  const width = Math.max(1, urx - llx)
  const height = Math.max(1, ury - lly)
  const pageMatrix: Matrix = [1, 0, 0, -1, -llx, ury]
  const tokens = epsSourceWithoutResources(source)
    .replace(/%[^\r\n]*/g, ' ')
    .match(/\[|\]|\{|\}|\([^)]*\)|\/[^^\s\[\]{}()]+|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?|[^\s\[\]{}()]+/g) ?? []
  const operands: EpsStackValue[] = []
  const arrayMarks: number[] = []
  const objects: CanvasObject[] = []
  const warnings: string[] = []
  let braceDepth = 0
  let currentPath: string[] = []
  let currentX = 0
  let currentY = 0
  let state: VectorState = { matrix: identity, fill: '#000000', stroke: '#000000', fillOpacity: 1, strokeOpacity: 1, lineWidth: 1, lineCap: 'butt', lineJoin: 'miter', dash: [] }
  const states: VectorState[] = []

  const numbers = (count: number): number[] | null => {
    const values = operands.splice(Math.max(0, operands.length - count), count).map(Number)
    return values.length === count && values.every(Number.isFinite) ? values : null
  }
  const paint = (op: PaintOperation, close = false): void => {
    if (close) currentPath.push('Z')
    if (currentPath.length > 0) {
      const object = transformedPathObject(currentPath.join(' '), multiply(pageMatrix, state.matrix), state, op, `${name} - path ${objects.length + 1}`, objects.length + 1)
      if (object) objects.push(object)
    }
    currentPath = []
  }

  for (const token of tokens) {
    if (token === '{') { braceDepth += 1; continue }
    if (token === '}') { braceDepth = Math.max(0, braceDepth - 1); continue }
    if (braceDepth > 0) continue
    if (token === '[') { arrayMarks.push(operands.length); continue }
    if (token === ']') {
      const mark = arrayMarks.pop() ?? operands.length
      const values = operands.splice(mark).map(Number).filter(Number.isFinite)
      operands.push(values)
      continue
    }
    const numeric = Number(token)
    if (Number.isFinite(numeric)) { operands.push(numeric); continue }
    if (token.startsWith('/') || token.startsWith('(')) { operands.push(token); continue }

    const lower = token.toLowerCase()
    if (lower === 'newpath' || token === 'N' || token === 'n') currentPath = []
    else if (lower === 'moveto' || token === 'm') {
      const value = numbers(2); if (value) { [currentX, currentY] = value; currentPath.push(`M${cleanNumber(currentX)} ${cleanNumber(currentY)}`) }
    } else if (lower === 'lineto' || token === 'l' || token === 'L') {
      const value = numbers(2); if (value) { [currentX, currentY] = value; currentPath.push(`L${cleanNumber(currentX)} ${cleanNumber(currentY)}`) }
    } else if (lower === 'curveto' || token === 'c' || token === 'C') {
      const value = numbers(6); if (value) { currentX = value[4]; currentY = value[5]; currentPath.push(`C${value.map(cleanNumber).join(' ')}`) }
    } else if (lower === 'closepath' || token === 'h' || token === 'H') currentPath.push('Z')
    else if (lower === 'stroke' || token === 'S') paint('stroke')
    else if (token === 's') paint('closeStroke', true)
    else if (lower === 'eofill' || token === 'f*') paint('eoFill')
    else if (lower === 'fill' || token === 'f' || token === 'F') paint('fill')
    else if (token === 'B') paint('fillStroke')
    else if (token === 'b') paint('closeFillStroke', true)
    else if (lower === 'setlinewidth' || token === 'w') { const value = numbers(1); if (value) state.lineWidth = Math.max(0.01, value[0]) }
    else if (lower === 'setlinecap' || token === 'J') { const value = numbers(1); if (value) state.lineCap = value[0] === 1 ? 'round' : value[0] === 2 ? 'square' : 'butt' }
    else if (lower === 'setlinejoin' || token === 'j') { const value = numbers(1); if (value) state.lineJoin = value[0] === 1 ? 'round' : value[0] === 2 ? 'bevel' : 'miter' }
    else if (lower === 'setrgbcolor' || token === 'r' || token === 'R') { const value = numbers(3); if (value) { const color = rgbToHex(value[0], value[1], value[2]); if (token === 'R') state.stroke = color; else if (token === 'r') state.fill = color; else state.fill = state.stroke = color } }
    else if (lower === 'setgray' || token === 'g' || token === 'G') { const value = numbers(1); if (value) { const color = rgbToHex(value[0], value[0], value[0]); if (token === 'G') state.stroke = color; else if (token === 'g') state.fill = color; else state.fill = state.stroke = color } }
    else if (lower === 'setcmykcolor' || token === 'k' || token === 'K') { const value = numbers(4); if (value) { const color = cmykToHex(value[0], value[1], value[2], value[3]); if (token === 'K') state.stroke = color; else if (token === 'k') state.fill = color; else state.fill = state.stroke = color } }
    else if (lower === 'setdash' || token === 'd') { const phase = operands.pop(); const pattern = operands.pop(); if (Array.isArray(pattern)) state.dash = pattern }
    else if (lower === 'gsave' || token === 'q') states.push(cloneState(state))
    else if (lower === 'grestore' || token === 'Q') state = states.pop() ?? state
    else if (lower === 'concat' || token === 'cm') { const value = numbers(6); if (value) state.matrix = multiply(state.matrix, value as Matrix) }
    else if (lower === 'translate') { const value = numbers(2); if (value) state.matrix = multiply(state.matrix, [1, 0, 0, 1, value[0], value[1]]) }
    else if (lower === 'scale') { const value = numbers(2); if (value) state.matrix = multiply(state.matrix, [value[0], 0, 0, value[1], 0, 0]) }
    else if (lower === 'rotate') { const value = numbers(1); if (value) { const angle = value[0] * Math.PI / 180; state.matrix = multiply(state.matrix, [Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle), 0, 0]) } }
    else if (lower === 'show' || lower === 'imagemask' || lower === 'image' || lower === 'colorimage') warnings.push('Textos ou imagens PostScript nao foram convertidos; os paths continuam editaveis.')
  }

  if (objects.length === 0) throw new Error('O EPS nao contem paths vetoriais reconhecidos.')
  if (warnings.length > 0) warnings.splice(1)
  return { name, width, height, objects, warnings }
}

export const importLegacyVector = async (bytes: Uint8Array, name: string, extension: string): Promise<SvgImportResult> => {
  const header = new TextDecoder('latin1').decode(bytes.slice(0, 16))
  if (extension.toLowerCase() === '.eps' || header.startsWith('%!PS-Adobe')) return importEps(bytes, name)
  throw new Error('O arquivo nao possui PostScript vetorial reconhecido.')
}
