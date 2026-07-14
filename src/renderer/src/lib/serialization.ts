import type { ProjectDocument } from '@renderer/types/project'

export const createNewProject = (name = 'Untitled Canvas'): ProjectDocument => {
  const now = new Date().toISOString()

  return {
    version: 1,
    id: crypto.randomUUID(),
    name,
    createdAt: now,
    updatedAt: now,
    canvas: {
      camera: { x: 0, y: 0, zoom: 1 },
      objects: [],
      guides: []
    }
  }
}

export const validateProjectDocument = (value: unknown): value is ProjectDocument => {
  const document = value as Partial<ProjectDocument>
  return Boolean(document && document.version === 1 && document.id && document.name && document.canvas)
}
