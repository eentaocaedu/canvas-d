import { importSvgDocument } from './svgImport'
import { pathSegments } from './nativePath'
import type { CanvasObject, GroupObject, PathObject, TextObject } from '@renderer/types/canvas'

type Matrix = [number, number, number, number, number, number]

const multiply = (left: Matrix, right: Matrix): Matrix => [
  left[0] * right[0] + left[2] * right[1], left[1] * right[0] + left[3] * right[1],
  left[0] * right[2] + left[2] * right[3], left[1] * right[2] + left[3] * right[3],
  left[0] * right[4] + left[2] * right[5] + left[4], left[1] * right[4] + left[3] * right[5] + left[5]
]

const transform = (matrix: Matrix, x: number, y: number): [number, number] => [matrix[0] * x + matrix[2] * y + matrix[4], matrix[1] * x + matrix[3] * y + matrix[5]]
const number = (value: number): string => Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)))

const rgb = (paint: string): [number, number, number] => {
  if (paint === 'transparent' || paint === 'none') return [0, 0, 0]
  const hex = paint.match(/^#([0-9a-f]{6})/i)?.[1]
  if (hex) return [0, 2, 4].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255) as [number, number, number]
  const match = paint.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i)
  if (match) return [Number(match[1]) / 255, Number(match[2]) / 255, Number(match[3]) / 255]
  return [0, 0, 0]
}

const objectMatrix = (object: CanvasObject, parent: Matrix): Matrix => {
  const angle = object.rotation * Math.PI / 180
  return multiply(parent, [Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle), object.x, object.y])
}

const pathCommands = (object: PathObject, matrix: Matrix): string[] => {
  const result: string[] = ['newpath']
  let currentX = 0
  let currentY = 0
  for (const segment of pathSegments(object.data)) {
    const command = segment[0]
    if (command === 'M' || command === 'L') {
      const point = transform(matrix, segment[1], segment[2])
      result.push(`${number(point[0])} ${number(point[1])} ${command === 'M' ? 'moveto' : 'lineto'}`)
      currentX = segment[1]; currentY = segment[2]
    } else if (command === 'C') {
      const first = transform(matrix, segment[1], segment[2])
      const second = transform(matrix, segment[3], segment[4])
      const end = transform(matrix, segment[5], segment[6])
      result.push(`${first.map(number).join(' ')} ${second.map(number).join(' ')} ${end.map(number).join(' ')} curveto`)
      currentX = segment[5]; currentY = segment[6]
    } else if (command === 'Q') {
      const c1 = [currentX + (2 / 3) * (segment[1] - currentX), currentY + (2 / 3) * (segment[2] - currentY)]
      const c2 = [segment[3] + (2 / 3) * (segment[1] - segment[3]), segment[4] + (2 / 3) * (segment[2] - segment[4])]
      const first = transform(matrix, c1[0], c1[1]); const second = transform(matrix, c2[0], c2[1]); const end = transform(matrix, segment[3], segment[4])
      result.push(`${first.map(number).join(' ')} ${second.map(number).join(' ')} ${end.map(number).join(' ')} curveto`)
      currentX = segment[3]; currentY = segment[4]
    } else if (command === 'Z') result.push('closepath')
  }
  return result
}

const escapePostScript = (value: string): string => value.replace(/([\\()])/g, '\\$1').replace(/[\r\n]+/g, ' ')

const serializeText = (object: TextObject, matrix: Matrix): string[] => {
  const point = transform(matrix, 0, object.fontSize)
  const fill = rgb(object.fill)
  return [
    'gsave', `${fill.map(number).join(' ')} setrgbcolor`,
    `/Helvetica findfont ${number(object.fontSize)} scalefont setfont`,
    `${number(point[0])} ${number(point[1])} moveto (${escapePostScript(object.text)}) show`, 'grestore'
  ]
}

const serializeObject = (object: CanvasObject, parent: Matrix, result: string[], warnings: Set<string>): void => {
  if (!object.visible) return
  const local = objectMatrix(object, parent)
  if (object.type === 'group') {
    for (const child of [...(object as GroupObject).children].sort((a, b) => a.zIndex - b.zIndex)) serializeObject(child, local, result, warnings)
    return
  }
  if (object.type === 'text') { result.push(...serializeText(object, local)); return }
  if (object.type === 'image') { warnings.add('Imagens raster incorporadas nao fazem parte do EPS vetorial.'); return }
  if (object.type !== 'path') return
  const scaleX = object.width / Math.max(0.001, object.sourceWidth)
  const scaleY = object.height / Math.max(0.001, object.sourceHeight)
  const pathMatrix = multiply(local, [scaleX, 0, 0, scaleY, 0, 0])
  const commands = pathCommands(object, pathMatrix)
  const hasFill = object.fill !== 'transparent' && object.fill !== 'none'
  const hasStroke = object.stroke !== 'transparent' && object.stroke !== 'none' && object.strokeWidth > 0
  result.push('gsave', ...commands)
  if (hasFill && hasStroke) {
    result.push('gsave', `${rgb(object.fill).map(number).join(' ')} setrgbcolor`, object.fillRule === 'evenodd' ? 'eofill' : 'fill', 'grestore')
    result.push(`${rgb(object.stroke).map(number).join(' ')} setrgbcolor`, `${number(object.strokeWidth)} setlinewidth`, object.lineCap === 'round' ? '1 setlinecap' : object.lineCap === 'square' ? '2 setlinecap' : '0 setlinecap', object.lineJoin === 'round' ? '1 setlinejoin' : object.lineJoin === 'bevel' ? '2 setlinejoin' : '0 setlinejoin', 'stroke')
  } else if (hasFill) result.push(`${rgb(object.fill).map(number).join(' ')} setrgbcolor`, object.fillRule === 'evenodd' ? 'eofill' : 'fill')
  else if (hasStroke) result.push(`${rgb(object.stroke).map(number).join(' ')} setrgbcolor`, `${number(object.strokeWidth)} setlinewidth`, 'stroke')
  result.push('grestore')
}

export const svgToEps = async (svg: string, title: string): Promise<{ content: string; warnings: string[] }> => {
  const imported = await importSvgDocument(svg, title)
  const lines = [
    '%!PS-Adobe-3.0 EPSF-3.0', `%%Title: ${title.replace(/[\r\n]/g, ' ')}`,
    `%%BoundingBox: 0 0 ${Math.ceil(imported.width)} ${Math.ceil(imported.height)}`, '%%LanguageLevel: 2', '%%Pages: 1', '%%EndComments'
  ]
  const warnings = new Set(imported.warnings)
  const flip: Matrix = [1, 0, 0, -1, 0, imported.height]
  for (const object of [...imported.objects].sort((a, b) => a.zIndex - b.zIndex)) serializeObject(object, flip, lines, warnings)
  lines.push('showpage', '%%EOF')
  return { content: lines.join('\n'), warnings: [...warnings] }
}
