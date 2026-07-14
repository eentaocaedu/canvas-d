import type { Camera, CanvasGuide, CanvasObject } from '@renderer/types/canvas'
import type { ProjectDocument } from '@renderer/types/project'

export const buildProjectDocument = (project: ProjectDocument, camera: Camera, objects: CanvasObject[], guides: CanvasGuide[] = []): ProjectDocument => ({
  ...project,
  updatedAt: new Date().toISOString(),
  canvas: {
    camera,
    objects,
    guides
  }
})
