import type { CanvasTool } from '@renderer/types/canvas'

export const toolShortcuts: Record<string, CanvasTool> = {
  v: 'select',
  h: 'pan',
  f: 'frame',
  r: 'rect',
  o: 'ellipse',
  d: 'diamond',
  u: 'polygon',
  n: 'note',
  l: 'line',
  a: 'arrow',
  b: 'vector',
  t: 'text',
  p: 'freehand',
  i: 'image',
  c: 'crop'
}
