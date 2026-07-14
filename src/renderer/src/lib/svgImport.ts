import svgpath from 'svgpath'
import { getObjectBounds } from './bounds'
import { normalizePathData } from './nativePath'
import { measurePointText } from './textMetrics'
import type { CanvasObject, GroupObject, ImageObject, PathObject, TextObject } from '@renderer/types/canvas'

export interface SvgImportResult {
  name: string
  width: number
  height: number
  objects: CanvasObject[]
  warnings: string[]
}

const numberAttr = (element: Element, name: string, fallback = 0): number => {
  const value = Number.parseFloat(element.getAttribute(name) ?? '')
  return Number.isFinite(value) ? value : fallback
}

const pointsAttr = (element: Element): number[] =>
  (element.getAttribute('points') ?? '')
    .trim()
    .split(/[\s,]+/)
    .map(Number)
    .filter(Number.isFinite)

const geometryPath = (element: Element): string | null => {
  const tag = element.tagName.toLowerCase()
  if (tag === 'path') return element.getAttribute('d') || null
  if (tag === 'line') return `M${numberAttr(element, 'x1')} ${numberAttr(element, 'y1')}L${numberAttr(element, 'x2')} ${numberAttr(element, 'y2')}`
  if (tag === 'polyline' || tag === 'polygon') {
    const values = pointsAttr(element)
    if (values.length < 4) return null
    const pairs: string[] = []
    for (let index = 0; index < values.length; index += 2) pairs.push(`${values[index]} ${values[index + 1] ?? 0}`)
    return `M${pairs.join('L')}${tag === 'polygon' ? 'Z' : ''}`
  }
  if (tag === 'circle' || tag === 'ellipse') {
    const cx = numberAttr(element, 'cx')
    const cy = numberAttr(element, 'cy')
    const rx = tag === 'circle' ? numberAttr(element, 'r') : numberAttr(element, 'rx')
    const ry = tag === 'circle' ? rx : numberAttr(element, 'ry')
    if (rx <= 0 || ry <= 0) return null
    return `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`
  }
  if (tag === 'rect') {
    const x = numberAttr(element, 'x')
    const y = numberAttr(element, 'y')
    const width = numberAttr(element, 'width')
    const height = numberAttr(element, 'height')
    if (width <= 0 || height <= 0) return null
    const radius = Math.max(0, Math.min(Math.min(width, height) / 2, numberAttr(element, 'rx', numberAttr(element, 'ry'))))
    if (radius === 0) return `M${x} ${y}H${x + width}V${y + height}H${x}Z`
    return `M${x + radius} ${y}H${x + width - radius}A${radius} ${radius} 0 0 1 ${x + width} ${y + radius}V${y + height - radius}A${radius} ${radius} 0 0 1 ${x + width - radius} ${y + height}H${x + radius}A${radius} ${radius} 0 0 1 ${x} ${y + height - radius}V${y + radius}A${radius} ${radius} 0 0 1 ${x + radius} ${y}Z`
  }
  return null
}

const rgbaPaint = (paint: string, opacity: number): string => {
  if (!paint || paint === 'none' || opacity <= 0) return 'transparent'
  if (opacity >= 0.999) return paint
  const match = paint.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i)
  return match ? `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${opacity})` : paint
}

const resolvedPaint = (root: SVGSVGElement, paint: string, warnings: string[]): string => {
  if (!paint.startsWith('url(')) return paint
  const id = paint.match(/#([^)'"\s]+)/)?.[1]
  const definition = id ? root.querySelector(`#${CSS.escape(id)}`) : null
  const firstStop = definition?.querySelector('stop')
  if (firstStop) {
    warnings.push(`Gradiente ${id ?? ''} foi convertido para uma cor editavel.`)
    return getComputedStyle(firstStop).stopColor || firstStop.getAttribute('stop-color') || '#000000'
  }
  warnings.push(`Paint server ${id ?? paint} nao pode ser convertido e foi removido.`)
  return 'transparent'
}

const matrixArray = (matrix: DOMMatrix | SVGMatrix | null): number[] =>
  matrix ? [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f] : [1, 0, 0, 1, 0, 0]

const transformPoint = (matrix: DOMMatrix | SVGMatrix | null, x: number, y: number): { x: number; y: number } =>
  matrix ? { x: matrix.a * x + matrix.c * y + matrix.e, y: matrix.b * x + matrix.d * y + matrix.f } : { x, y }

const sanitizeSvg = (root: SVGSVGElement): void => {
  root.querySelectorAll('script, foreignObject').forEach((element) => element.remove())
  root.querySelectorAll('*').forEach((element) => {
    for (const attribute of Array.from(element.attributes)) {
      if (attribute.name.toLowerCase().startsWith('on')) element.removeAttribute(attribute.name)
    }
  })
}

const loadImageSize = (src: string): Promise<{ width: number; height: number }> =>
  new Promise((resolve, reject) => {
    const image = new window.Image()
    image.onload = () => resolve({ width: Math.max(1, image.naturalWidth), height: Math.max(1, image.naturalHeight) })
    image.onerror = () => reject(new Error('Nao foi possivel carregar uma imagem incorporada no SVG.'))
    image.src = src
  })

export const importSvgDocument = async (source: string, fallbackName = 'SVG importado'): Promise<SvgImportResult> => {
  const parsed = new DOMParser().parseFromString(source, 'image/svg+xml')
  if (parsed.querySelector('parsererror') || parsed.documentElement.tagName.toLowerCase() !== 'svg') throw new Error('O arquivo SVG e invalido ou esta malformado.')
  const parsedRoot = parsed.documentElement as unknown as SVGSVGElement
  sanitizeSvg(parsedRoot)

  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:-100000px;top:-100000px;opacity:0;pointer-events:none'
  const root = document.importNode(parsedRoot, true) as SVGSVGElement
  const rawViewBox = root.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number) ?? []
  const viewBox = rawViewBox.length === 4 && rawViewBox.every(Number.isFinite) ? rawViewBox : null
  const width = Math.max(1, viewBox?.[2] ?? numberAttr(root, 'width', 1000))
  const height = Math.max(1, viewBox?.[3] ?? numberAttr(root, 'height', 1000))
  if (!viewBox) root.setAttribute('viewBox', `0 0 ${width} ${height}`)
  root.setAttribute('width', String(width))
  root.setAttribute('height', String(height))
  host.appendChild(root)
  document.body.appendChild(host)

  const warnings: string[] = []
  let zIndex = 1

  const makePath = (element: SVGGraphicsElement, pathData: string): PathObject | null => {
    const computed = getComputedStyle(element)
    if (computed.display === 'none' || computed.visibility === 'hidden') return null
    const transformed = svgpath(pathData).matrix(matrixArray(element.getCTM())).round(4).toString()
    const normalized = normalizePathData(transformed)
    const scale = matrixArray(element.getCTM())
    const strokeScale = (Math.hypot(scale[0], scale[1]) + Math.hypot(scale[2], scale[3])) / 2 || 1
    const fillOpacity = Number.parseFloat(computed.fillOpacity || '1') * Number.parseFloat(computed.opacity || '1')
    const strokeOpacity = Number.parseFloat(computed.strokeOpacity || '1') * Number.parseFloat(computed.opacity || '1')
    return {
      id: crypto.randomUUID(),
      type: 'path',
      name: element.getAttribute('aria-label') || element.id || element.tagName.toLowerCase(),
      x: normalized.offsetX,
      y: normalized.offsetY,
      width: normalized.width,
      height: normalized.height,
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
      zIndex: zIndex++,
      data: normalized.data,
      sourceWidth: normalized.width,
      sourceHeight: normalized.height,
      fill: rgbaPaint(resolvedPaint(root, computed.fill, warnings), Number.isFinite(fillOpacity) ? fillOpacity : 1),
      stroke: rgbaPaint(resolvedPaint(root, computed.stroke, warnings), Number.isFinite(strokeOpacity) ? strokeOpacity : 1),
      strokeWidth: Math.max(0, Number.parseFloat(computed.strokeWidth || '0') * strokeScale),
      fillRule: computed.fillRule === 'evenodd' ? 'evenodd' : 'nonzero',
      lineCap: computed.strokeLinecap === 'round' || computed.strokeLinecap === 'square' ? computed.strokeLinecap : 'butt',
      lineJoin: computed.strokeLinejoin === 'round' || computed.strokeLinejoin === 'bevel' ? computed.strokeLinejoin : 'miter',
      strokePattern: computed.strokeDasharray && computed.strokeDasharray !== 'none' ? 'dashed' : 'solid'
    }
  }

  const convertElement = async (element: Element): Promise<CanvasObject | null> => {
    const tag = element.tagName.toLowerCase()
    if (tag === 'defs' || tag === 'style' || tag === 'title' || tag === 'desc' || tag === 'metadata' || tag === 'clippath' || tag === 'mask') return null
    if (tag === 'g' || tag === 'svg' || tag === 'a' || tag === 'symbol') {
      const children = (await Promise.all(Array.from(element.children).map(convertElement))).filter((object): object is CanvasObject => Boolean(object))
      if (children.length === 0) return null
      const childBounds = children.map(getObjectBounds)
      const x = Math.min(...childBounds.map((bounds) => bounds.x))
      const y = Math.min(...childBounds.map((bounds) => bounds.y))
      const right = Math.max(...childBounds.map((bounds) => bounds.x + bounds.width))
      const bottom = Math.max(...childBounds.map((bounds) => bounds.y + bounds.height))
      const group: GroupObject = {
        id: crypto.randomUUID(),
        type: 'group',
        name: element.getAttribute('aria-label') || element.id || 'Grupo SVG',
        x,
        y,
        width: Math.max(1, right - x),
        height: Math.max(1, bottom - y),
        rotation: 0,
        opacity: 1,
        locked: false,
        visible: true,
        zIndex: zIndex++,
        children: children.map((child, index) => ({ ...child, x: child.x - x, y: child.y - y, zIndex: index }))
      }
      return group
    }

    if (tag === 'text' || tag === 'tspan') {
      const graphic = element as SVGGraphicsElement
      const computed = getComputedStyle(element)
      const fontSize = Math.max(1, Number.parseFloat(computed.fontSize || '16'))
      const matrix = graphic.getCTM()
      const start = transformPoint(matrix, numberAttr(element, 'x'), numberAttr(element, 'y'))
      const text = element.textContent ?? ''
      const fontScale = matrix ? Math.hypot(matrix.a, matrix.b) : 1
      const finalFontSize = fontSize * fontScale
      const size = measurePointText({ text, fontFamily: computed.fontFamily || 'Segoe UI', fontSize: finalFontSize, fontWeight: computed.fontWeight || '400', fontStyle: computed.fontStyle === 'italic' ? 'italic' : 'normal', lineHeight: 1.2 })
      const object: TextObject = {
        id: crypto.randomUUID(), type: 'text', name: element.id || 'Texto SVG', x: start.x, y: start.y - finalFontSize,
        width: size.width, height: size.height, rotation: matrix ? (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI : 0,
        opacity: Number.parseFloat(computed.opacity || '1'), locked: false, visible: true, zIndex: zIndex++, text, textMode: 'point',
        fontFamily: computed.fontFamily || 'Segoe UI', fontSize: finalFontSize, fontWeight: computed.fontWeight || '400',
        fontStyle: computed.fontStyle === 'italic' ? 'italic' : 'normal', fill: resolvedPaint(root, computed.fill, warnings), align: 'left', lineHeight: 1.2
      }
      return object
    }

    if (tag === 'image') {
      const graphic = element as SVGGraphicsElement
      const href = element.getAttribute('href') || element.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || ''
      if (!href.startsWith('data:')) {
        warnings.push('Uma imagem externa do SVG foi ignorada; incorpore a imagem no arquivo para importa-la.')
        return null
      }
      const size = await loadImageSize(href)
      const x = numberAttr(element, 'x')
      const y = numberAttr(element, 'y')
      const width = Math.max(1, numberAttr(element, 'width', size.width))
      const height = Math.max(1, numberAttr(element, 'height', size.height))
      const topLeft = transformPoint(graphic.getCTM(), x, y)
      const bottomRight = transformPoint(graphic.getCTM(), x + width, y + height)
      const object: ImageObject = {
        id: crypto.randomUUID(), type: 'image', name: element.id || 'Imagem SVG', x: Math.min(topLeft.x, bottomRight.x), y: Math.min(topLeft.y, bottomRight.y),
        width: Math.max(1, Math.abs(bottomRight.x - topLeft.x)), height: Math.max(1, Math.abs(bottomRight.y - topLeft.y)), rotation: 0,
        opacity: Number.parseFloat(getComputedStyle(element).opacity || '1'), locked: false, visible: true, zIndex: zIndex++, src: href,
        naturalWidth: size.width, naturalHeight: size.height, lockAspectRatio: true
      }
      return object
    }

    if (tag === 'use') {
      const href = element.getAttribute('href') || element.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || ''
      const referenced = href.startsWith('#') ? root.querySelector(href) : null
      const data = referenced ? geometryPath(referenced) : null
      return data ? makePath(element as SVGGraphicsElement, data) : null
    }

    const data = geometryPath(element)
    return data ? makePath(element as SVGGraphicsElement, data) : null
  }

  try {
    const objects = (await Promise.all(Array.from(root.children).map(convertElement))).filter((object): object is CanvasObject => Boolean(object))
    if (objects.length === 0) throw new Error('Nenhum elemento vetorial editavel foi encontrado no SVG.')
    return {
      name: root.getAttribute('aria-label') || root.querySelector('title')?.textContent?.trim() || fallbackName,
      width,
      height,
      objects: objects.map((object, index) => ({ ...object, zIndex: index + 1 })),
      warnings: Array.from(new Set(warnings))
    }
  } finally {
    host.remove()
  }
}
