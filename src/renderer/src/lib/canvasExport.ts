import Konva from 'konva'
import type { Bounds } from './bounds'
import type { CanvasObject, FrameObject, ImageObject } from '@renderer/types/canvas'
import { getKonvaFontStyle } from './textMetrics'
import { dashForStroke, routeArrowPoints } from './strokeStyle'
import { withRasterDpi } from './rasterMetadata'

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new window.Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Unable to load image for export.'))
    image.src = src
  })

interface ExportArea extends Bounds {
  background?: string
  skipId?: string
}

export type RasterExportFormat = 'png' | 'jpeg' | 'webp'

const polygonPoints = (width: number, height: number, sides: number): number[] => {
  const points: number[] = []
  const count = Math.max(3, Math.round(sides))
  for (let index = 0; index < count; index += 1) {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / count
    points.push(width / 2 + Math.cos(angle) * (width / 2), height / 2 + Math.sin(angle) * (height / 2))
  }
  return points
}

const placeChildInGroup = (group: CanvasObject & { type: 'group' }, child: CanvasObject): CanvasObject => {
  const radians = (group.rotation * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return {
    ...(structuredClone(child) as CanvasObject),
    x: group.x + child.x * cos - child.y * sin,
    y: group.y + child.x * sin + child.y * cos,
    rotation: group.rotation + child.rotation,
    opacity: group.opacity * child.opacity
  } as CanvasObject
}

const drawObject = async (layer: Konva.Layer, object: CanvasObject, area: ExportArea): Promise<void> => {
  if (!object.visible || object.id === area.skipId) return

  const common = {
    x: object.x - area.x,
    y: object.y - area.y,
    width: object.width,
    height: object.height,
    rotation: object.rotation,
    opacity: object.opacity
  }

  if (object.type === 'rect') {
    layer.add(new Konva.Rect({ ...common, cornerRadius: object.cornerRadii ?? object.radius, fill: object.fill, stroke: object.stroke, strokeWidth: object.strokeWidth }))
  } else if (object.type === 'ellipse') {
    layer.add(
      new Konva.Ellipse({
        ...common,
        x: object.x - area.x + object.width / 2,
        y: object.y - area.y + object.height / 2,
        radiusX: object.width / 2,
        radiusY: object.height / 2,
        fill: object.fill,
        stroke: object.stroke,
        strokeWidth: object.strokeWidth
      })
    )
  } else if (object.type === 'diamond') {
    layer.add(
      new Konva.Line({
        x: object.x - area.x,
        y: object.y - area.y,
        points: [object.width / 2, 0, object.width, object.height / 2, object.width / 2, object.height, 0, object.height / 2],
        closed: true,
        fill: object.fill,
        stroke: object.stroke,
        strokeWidth: object.strokeWidth,
        rotation: object.rotation,
        opacity: object.opacity
      })
    )
  } else if (object.type === 'polygon') {
    layer.add(
      new Konva.Line({
        x: object.x - area.x,
        y: object.y - area.y,
        points: polygonPoints(object.width, object.height, object.sides),
        closed: true,
        fill: object.fill,
        stroke: object.stroke,
        strokeWidth: object.strokeWidth,
        rotation: object.rotation,
        opacity: object.opacity,
        lineJoin: 'round'
      })
    )
  } else if (object.type === 'note') {
    const fold = Math.max(0, Math.min(Math.min(object.width, object.height) / 2, object.foldSize))
    layer.add(
      new Konva.Line({
        x: object.x - area.x,
        y: object.y - area.y,
        points: [0, 0, object.width - fold, 0, object.width, fold, object.width, object.height, 0, object.height],
        closed: true,
        fill: object.fill,
        stroke: object.stroke,
        strokeWidth: object.strokeWidth,
        rotation: object.rotation,
        opacity: object.opacity,
        lineJoin: 'round'
      })
    )
    if (fold > 0) {
      layer.add(
        new Konva.Line({
          x: object.x - area.x,
          y: object.y - area.y,
          points: [object.width - fold, 0, object.width - fold, fold, object.width, fold],
          stroke: object.stroke,
          strokeWidth: object.strokeWidth,
          rotation: object.rotation,
          opacity: object.opacity
        })
      )
    }
  } else if (object.type === 'text') {
    layer.add(
      new Konva.Text({
        ...common,
        text: object.text,
        fontFamily: object.fontFamily,
        fontSize: object.fontSize,
        fontStyle: getKonvaFontStyle(object.fontWeight, object.fontStyle),
        fill: object.fill,
        align: object.align,
        lineHeight: object.lineHeight,
        letterSpacing: object.letterSpacing ?? 0,
        textDecoration: object.textDecoration ?? 'none',
        wrap: (object.textMode ?? 'paragraph') === 'point' ? 'none' : 'word'
      })
    )
  } else if (object.type === 'line') {
    layer.add(
      new Konva.Line({
        x: object.x - area.x,
        y: object.y - area.y,
        points: object.points,
        stroke: object.stroke,
        strokeWidth: object.strokeWidth,
        lineCap: object.lineCap ?? 'round',
        dash: dashForStroke(object.strokePattern, object.strokeWidth)
      })
    )
  } else if (object.type === 'arrow') {
    layer.add(
      new Konva.Arrow({
        x: object.x - area.x,
        y: object.y - area.y,
        points: routeArrowPoints(object.points, object.routing),
        stroke: object.stroke,
        fill: object.stroke,
        strokeWidth: object.strokeWidth,
        pointerLength: object.pointerLength,
        pointerWidth: object.pointerWidth,
        pointerAtBeginning: object.pointerAtBeginning ?? false,
        pointerAtEnding: object.pointerAtEnding ?? true,
        lineCap: object.lineCap ?? 'round',
        dash: dashForStroke(object.strokePattern, object.strokeWidth)
      })
    )
  } else if (object.type === 'freehand') {
    layer.add(
      new Konva.Line({
        x: object.x - area.x,
        y: object.y - area.y,
        points: object.points,
        stroke: object.stroke,
        strokeWidth: object.strokeWidth,
        tension: object.tension,
        lineCap: object.lineCap ?? 'round',
        lineJoin: 'round',
        dash: dashForStroke(object.strokePattern, object.strokeWidth)
      })
    )
  } else if (object.type === 'vector') {
    layer.add(
      new Konva.Line({
        x: object.x - area.x,
        y: object.y - area.y,
        points: object.points,
        closed: object.closed,
        fill: object.closed ? object.fill : 'transparent',
        stroke: object.stroke,
        strokeWidth: object.strokeWidth,
        tension: object.tension,
        lineCap: object.lineCap ?? 'round',
        lineJoin: 'round',
        dash: dashForStroke(object.strokePattern, object.strokeWidth),
        rotation: object.rotation,
        opacity: object.opacity
      })
    )
  } else if (object.type === 'path') {
    const scaleX = object.width / Math.max(0.001, object.sourceWidth)
    const scaleY = object.height / Math.max(0.001, object.sourceHeight)
    layer.add(
      new Konva.Path({
        x: object.x - area.x,
        y: object.y - area.y,
        data: object.data,
        scaleX,
        scaleY,
        fill: object.fill,
        stroke: object.stroke,
        strokeWidth: object.strokeWidth / Math.max(0.001, (scaleX + scaleY) / 2),
        fillRule: object.fillRule ?? 'nonzero',
        lineJoin: object.lineJoin ?? 'miter',
        lineCap: object.lineCap ?? 'butt',
        dash: dashForStroke(object.strokePattern, object.strokeWidth),
        rotation: object.rotation,
        opacity: object.opacity
      })
    )
  } else if (object.type === 'image') {
    const image = await loadImage((object as ImageObject).src)
    layer.add(
      new Konva.Image({
        ...common,
        image,
        cropX: object.crop?.x,
        cropY: object.crop?.y,
        cropWidth: object.crop?.width,
        cropHeight: object.crop?.height
      })
    )
  } else if (object.type === 'frame') {
    layer.add(new Konva.Rect({ ...common, fill: object.background, stroke: '#4b5563', strokeWidth: 1 }))
  } else if (object.type === 'group') {
    const children = [...object.children].sort((a, b) => a.zIndex - b.zIndex)
    for (const child of children) {
      await drawObject(layer, placeChildInGroup(object, child), area)
    }
  }
}

const exportAreaToBytes = async (area: ExportArea, objects: CanvasObject[], pixelRatio: 1 | 2 | 3, format: RasterExportFormat, dpi = 96): Promise<Uint8Array> => {
  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.left = '-10000px'
  container.style.top = '-10000px'
  document.body.appendChild(container)

  const stage = new Konva.Stage({ container, width: Math.ceil(area.width), height: Math.ceil(area.height) })
  const layer = new Konva.Layer()
  stage.add(layer)
  const exportBackground = format === 'jpeg' && (!area.background || area.background === 'transparent') ? '#ffffff' : area.background
  if (exportBackground) {
    layer.add(new Konva.Rect({ x: 0, y: 0, width: area.width, height: area.height, fill: exportBackground }))
  }

  try {
    const sorted = [...objects].sort((a, b) => a.zIndex - b.zIndex)
    for (const object of sorted) {
      await drawObject(layer, object, area)
    }

    layer.draw()
    const canvas = stage.toCanvas({
      x: 0,
      y: 0,
      width: area.width,
      height: area.height,
      pixelRatio
    })
    const mimeType = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png'
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => (result ? resolve(result) : reject(new Error('O canvas nao conseguiu codificar a imagem exportada.'))), mimeType, format === 'png' ? undefined : 0.92)
    })
    return withRasterDpi(new Uint8Array(await blob.arrayBuffer()), format, dpi, canvas.width, canvas.height)
  } finally {
    stage.destroy()
    container.remove()
  }
}

export const exportFrameToBytes = async (frame: FrameObject, objects: CanvasObject[], pixelRatio: 1 | 2 | 3, format: RasterExportFormat = 'png', dpi = 96): Promise<Uint8Array> =>
  exportAreaToBytes(
    {
      x: frame.x,
      y: frame.y,
      width: frame.width,
      height: frame.height,
      background: frame.background,
      skipId: frame.id
    },
    objects,
    pixelRatio,
    format,
    dpi
  )

export const exportObjectsToBytes = async (area: Bounds, objects: CanvasObject[], pixelRatio: 1 | 2 | 3, format: RasterExportFormat = 'png', dpi = 96): Promise<Uint8Array> =>
  exportAreaToBytes(area, objects, pixelRatio, format, dpi)
