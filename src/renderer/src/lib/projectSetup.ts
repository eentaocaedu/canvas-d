import type { ProjectUnit } from '@renderer/types/project'

export interface ProjectPreset {
  id: string
  label: string
  detail: string
  unit: ProjectUnit
  width: number
  height: number
  dpi: number
}

export const projectPresets: ProjectPreset[] = [
  { id: 'full-hd', label: 'Full HD', detail: 'Tela e apresentacao', unit: 'px', width: 1920, height: 1080, dpi: 96 },
  { id: 'desktop', label: 'Desktop', detail: 'Layout para web', unit: 'px', width: 1440, height: 1024, dpi: 96 },
  { id: 'mobile', label: 'Mobile', detail: 'Interface de celular', unit: 'px', width: 390, height: 844, dpi: 96 },
  { id: 'instagram', label: 'Instagram', detail: 'Post vertical', unit: 'px', width: 1080, height: 1350, dpi: 96 },
  { id: 'a4', label: 'A4', detail: 'Impressao em 300 DPI', unit: 'mm', width: 210, height: 297, dpi: 300 },
  { id: 'a3', label: 'A3', detail: 'Impressao em 300 DPI', unit: 'mm', width: 297, height: 420, dpi: 300 },
  { id: 'business-card', label: 'Cartao', detail: '90 x 50 mm', unit: 'mm', width: 90, height: 50, dpi: 300 }
]

export const toPixels = (value: number, unit: ProjectUnit, dpi: number): number => {
  if (unit === 'px') return value
  if (unit === 'cm') return value * dpi / 2.54
  if (unit === 'mm') return value * dpi / 25.4
  return value * dpi / 0.0254
}

export const fromPixels = (pixels: number, unit: ProjectUnit, dpi: number): number => {
  if (unit === 'px') return pixels
  if (unit === 'cm') return pixels * 2.54 / dpi
  if (unit === 'mm') return pixels * 25.4 / dpi
  return pixels * 0.0254 / dpi
}

export const displayUnitValue = (value: number, unit: ProjectUnit): number =>
  unit === 'px' ? Math.round(value) : Number(value.toFixed(unit === 'm' ? 4 : 2))

export const convertUnitValue = (value: number, from: ProjectUnit, to: ProjectUnit, dpi: number): number =>
  displayUnitValue(fromPixels(toPixels(value, from, dpi), to, dpi), to)
