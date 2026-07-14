import type { Bounds } from './bounds'
import { dashForStroke, routeArrowPoints } from './strokeStyle'
import type { CanvasObject, FrameObject, TextObject } from '@renderer/types/canvas'

interface SvgArea extends Bounds {
  background?: string
  skipId?: string
}

const escapeXml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

const color = (value: string): string => (value === 'transparent' ? 'none' : value)
const points = (values: number[]): string => values.reduce<string[]>((result, value, index) => {
  if (index % 2 === 0) result.push(`${value},${values[index + 1] ?? 0}`)
  return result
}, []).join(' ')

const polygonPoints = (width: number, height: number, sides: number): number[] => {
  const result: number[] = []
  const count = Math.max(3, Math.round(sides))
  for (let index = 0; index < count; index += 1) {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / count
    result.push(width / 2 + Math.cos(angle) * (width / 2), height / 2 + Math.sin(angle) * (height / 2))
  }
  return result
}

const roundedRectPath = (width: number, height: number, radii: [number, number, number, number]): string => {
  const maxRadius = Math.min(width, height) / 2
  const [topLeft, topRight, bottomRight, bottomLeft] = radii.map((radius) => Math.max(0, Math.min(maxRadius, radius)))
  return [
    `M ${topLeft} 0`,
    `H ${width - topRight}`,
    `Q ${width} 0 ${width} ${topRight}`,
    `V ${height - bottomRight}`,
    `Q ${width} ${height} ${width - bottomRight} ${height}`,
    `H ${bottomLeft}`,
    `Q 0 ${height} 0 ${height - bottomLeft}`,
    `V ${topLeft}`,
    `Q 0 0 ${topLeft} 0 Z`
  ].join(' ')
}

const strokeAttributes = (object: { stroke: string; strokeWidth: number; lineCap?: 'butt' | 'round' | 'square'; strokePattern?: 'solid' | 'dashed' | 'dotted' }): string => {
  const dash = dashForStroke(object.strokePattern, object.strokeWidth)
  return `stroke="${escapeXml(color(object.stroke))}" stroke-width="${object.strokeWidth}" stroke-linecap="${object.lineCap ?? 'round'}"${dash.length ? ` stroke-dasharray="${dash.join(' ')}"` : ''}`
}

const objectTransform = (object: CanvasObject, offsetX: number, offsetY: number): string =>
  `translate(${object.x - offsetX} ${object.y - offsetY}) rotate(${object.rotation})`

const wrapText = (object: TextObject): string[] => {
  const paragraphs = object.text.split('\n')
  if ((object.textMode ?? 'paragraph') === 'point') return paragraphs
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) return paragraphs
  context.font = `${object.fontStyle ?? 'normal'} ${object.fontWeight} ${object.fontSize}px "${object.fontFamily}"`
  const lines: string[] = []
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/)
    let line = ''
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word
      const tracking = Math.max(0, candidate.length - 1) * (object.letterSpacing ?? 0)
      if (line && context.measureText(candidate).width + tracking > object.width) {
        lines.push(line)
        line = word
      } else {
        line = candidate
      }
    }
    lines.push(line)
  }
  return lines
}

const textSvg = (object: TextObject, transform: string): string => {
  const lines = wrapText(object)
  const x = object.align === 'center' ? object.width / 2 : object.align === 'right' ? object.width : 0
  const anchor = object.align === 'center' ? 'middle' : object.align === 'right' ? 'end' : 'start'
  const lineStep = object.fontSize * object.lineHeight
  const tspans = lines.map((line, index) => `<tspan x="${x}" dy="${index === 0 ? object.fontSize : lineStep}">${escapeXml(line || ' ')}</tspan>`).join('')
  return `<text transform="${transform}" opacity="${object.opacity}" fill="${escapeXml(color(object.fill))}" font-family="${escapeXml(object.fontFamily)}" font-size="${object.fontSize}" font-weight="${escapeXml(object.fontWeight)}" font-style="${object.fontStyle ?? 'normal'}" letter-spacing="${object.letterSpacing ?? 0}" text-decoration="${object.textDecoration ?? 'none'}" text-anchor="${anchor}">${tspans}</text>`
}

const serializeObject = (object: CanvasObject, offsetX: number, offsetY: number, skipId?: string): string => {
  if (!object.visible || object.id === skipId) return ''
  const transform = objectTransform(object, offsetX, offsetY)
  const opacity = `opacity="${object.opacity}"`

  if (object.type === 'frame') return `<rect transform="${transform}" ${opacity} width="${object.width}" height="${object.height}" fill="${escapeXml(color(object.background))}"/>`
  if (object.type === 'rect') {
    if (object.cornerRadii && new Set(object.cornerRadii).size > 1) {
      return `<path transform="${transform}" ${opacity} d="${roundedRectPath(object.width, object.height, object.cornerRadii)}" fill="${escapeXml(color(object.fill))}" ${strokeAttributes(object)}/>`
    }
    return `<rect transform="${transform}" ${opacity} width="${object.width}" height="${object.height}" rx="${object.cornerRadii?.[0] ?? object.radius}" fill="${escapeXml(color(object.fill))}" ${strokeAttributes(object)}/>`
  }
  if (object.type === 'ellipse') return `<ellipse transform="${transform}" ${opacity} cx="${object.width / 2}" cy="${object.height / 2}" rx="${object.width / 2}" ry="${object.height / 2}" fill="${escapeXml(color(object.fill))}" ${strokeAttributes(object)}/>`
  if (object.type === 'diamond') return `<polygon transform="${transform}" ${opacity} points="${points([object.width / 2, 0, object.width, object.height / 2, object.width / 2, object.height, 0, object.height / 2])}" fill="${escapeXml(color(object.fill))}" ${strokeAttributes(object)}/>`
  if (object.type === 'polygon') return `<polygon transform="${transform}" ${opacity} points="${points(polygonPoints(object.width, object.height, object.sides))}" fill="${escapeXml(color(object.fill))}" ${strokeAttributes(object)} stroke-linejoin="round"/>`
  if (object.type === 'note') {
    const fold = Math.max(0, Math.min(Math.min(object.width, object.height) / 2, object.foldSize))
    const outline = [0, 0, object.width - fold, 0, object.width, fold, object.width, object.height, 0, object.height]
    const crease = fold > 0 ? `<polyline points="${points([object.width - fold, 0, object.width - fold, fold, object.width, fold])}" fill="none" ${strokeAttributes(object)}/>` : ''
    return `<g transform="${transform}" ${opacity}><polygon points="${points(outline)}" fill="${escapeXml(color(object.fill))}" ${strokeAttributes(object)} stroke-linejoin="round"/>${crease}</g>`
  }
  if (object.type === 'text') return textSvg(object, transform)
  if (object.type === 'line') return `<polyline transform="${transform}" ${opacity} points="${points(object.points)}" fill="none" ${strokeAttributes(object)}/>`
  if (object.type === 'arrow') {
    const markerId = `arrow-${object.id.replace(/[^a-zA-Z0-9_-]/g, '')}`
    const routed = routeArrowPoints(object.points, object.routing)
    const marker = `<defs><marker id="${markerId}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="${object.pointerLength}" markerHeight="${object.pointerWidth}" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${escapeXml(color(object.stroke))}"/></marker></defs>`
    const start = object.pointerAtBeginning ? ` marker-start="url(#${markerId})"` : ''
    const end = object.pointerAtEnding ?? true ? ` marker-end="url(#${markerId})"` : ''
    return `${marker}<polyline transform="${transform}" ${opacity} points="${points(routed)}" fill="none" ${strokeAttributes(object)}${start}${end}/>`
  }
  if (object.type === 'freehand' || object.type === 'vector') {
    const tag = object.type === 'vector' && object.closed ? 'polygon' : 'polyline'
    const fill = object.type === 'vector' && object.closed ? color(object.fill) : 'none'
    return `<${tag} transform="${transform}" ${opacity} points="${points(object.points)}" fill="${escapeXml(fill)}" ${strokeAttributes(object)} stroke-linejoin="round"/>`
  }
  if (object.type === 'path') {
    const scaleX = object.width / Math.max(0.001, object.sourceWidth)
    const scaleY = object.height / Math.max(0.001, object.sourceHeight)
    return `<g transform="${transform}" ${opacity}><path transform="scale(${scaleX} ${scaleY})" d="${escapeXml(object.data)}" fill="${escapeXml(color(object.fill))}" fill-rule="${object.fillRule ?? 'nonzero'}" ${strokeAttributes(object)} stroke-linejoin="${object.lineJoin ?? 'miter'}"/></g>`
  }
  if (object.type === 'image') {
    if (object.crop) {
      return `<g transform="${transform}" ${opacity}><svg width="${object.width}" height="${object.height}" viewBox="${object.crop.x} ${object.crop.y} ${object.crop.width} ${object.crop.height}" preserveAspectRatio="none"><image width="${object.naturalWidth}" height="${object.naturalHeight}" href="${escapeXml(object.src)}" preserveAspectRatio="none"/></svg></g>`
    }
    return `<image transform="${transform}" ${opacity} width="${object.width}" height="${object.height}" href="${escapeXml(object.src)}" preserveAspectRatio="none"/>`
  }
  if (object.type === 'group') {
    const children = [...object.children].sort((a, b) => a.zIndex - b.zIndex).map((child) => serializeObject(child, 0, 0)).join('')
    return `<g transform="${transform}" ${opacity}>${children}</g>`
  }
  return ''
}

const exportAreaToSvg = (area: SvgArea, objects: CanvasObject[]): string => {
  const background = area.background ? `<rect width="${area.width}" height="${area.height}" fill="${escapeXml(color(area.background))}"/>` : ''
  const body = [...objects].sort((a, b) => a.zIndex - b.zIndex).map((object) => serializeObject(object, area.x, area.y, area.skipId)).join('')
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${Math.ceil(area.width)}" height="${Math.ceil(area.height)}" viewBox="0 0 ${area.width} ${area.height}">${background}${body}</svg>`
}

export const exportFrameToSvg = (frame: FrameObject, objects: CanvasObject[]): string =>
  exportAreaToSvg({ x: frame.x, y: frame.y, width: frame.width, height: frame.height, background: frame.background, skipId: frame.id }, objects)

export const exportObjectsToSvg = (area: Bounds, objects: CanvasObject[]): string => exportAreaToSvg(area, objects)
