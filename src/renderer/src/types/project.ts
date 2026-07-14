import type { Camera, CanvasGuide, CanvasObject } from './canvas'

export type ProjectCanvasMode = 'infinite' | 'artboard'
export type ProjectUnit = 'px' | 'cm' | 'mm' | 'm'

export interface ProjectSetup {
  mode: ProjectCanvasMode
  unit: ProjectUnit
  width?: number
  height?: number
  pixelWidth?: number
  pixelHeight?: number
  dpi: number
  background: string
}

export interface ProjectDocument {
  version: 1
  id: string
  name: string
  createdAt: string
  updatedAt: string
  setup?: ProjectSetup
  canvas: {
    camera: Camera
    objects: CanvasObject[]
    guides?: CanvasGuide[]
  }
}

export interface ProjectMeta {
  id: string
  name: string
  path: string
  updatedAt: string
}
