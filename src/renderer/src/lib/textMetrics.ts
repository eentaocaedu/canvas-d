import Konva from 'konva'

interface TextMetricsOptions {
  text: string
  width?: number
  fontFamily: string
  fontSize: number
  fontWeight: string
  fontStyle?: 'normal' | 'italic'
  lineHeight: number
  letterSpacing?: number
}

export const getKonvaFontStyle = (fontWeight: string, fontStyle: 'normal' | 'italic' = 'normal'): string =>
  `${fontStyle} ${fontWeight}`

const createTextNode = (options: TextMetricsOptions): Konva.Text =>
  new Konva.Text({
    text: options.text || ' ',
    width: options.width,
    fontFamily: options.fontFamily,
    fontSize: options.fontSize,
    fontStyle: getKonvaFontStyle(options.fontWeight, options.fontStyle),
    lineHeight: options.lineHeight,
    letterSpacing: options.letterSpacing ?? 0,
    wrap: 'word'
  })

export const measurePointText = (options: TextMetricsOptions): { width: number; height: number } => {
  const node = createTextNode(options)
  return {
    width: Math.max(8, Math.ceil(node.width()) + 2),
    height: Math.max(8, Math.ceil(node.height()) + 2)
  }
}

export const measureParagraphTextHeight = (options: TextMetricsOptions & { width: number }): number => {
  const node = createTextNode({ ...options, width: Math.max(8, options.width) })
  return Math.max(8, Math.ceil(node.height()) + 2)
}

export const estimateTextHeight = (text: string, width: number, fontSize: number, lineHeight: number): number =>
  measureParagraphTextHeight({
    text,
    width,
    fontFamily: 'Segoe UI',
    fontSize,
    fontWeight: '400',
    lineHeight
  })
