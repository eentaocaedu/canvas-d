import type { ProjectDocument, ProjectMeta } from './project'

declare module '*.svg' {
  const src: string
  export default src
}

declare module '*?url' {
  const src: string
  export default src
}

interface CanvasDExportPayload {
  bytes: Uint8Array
  defaultName?: string
}

interface CanvasDSvgExportPayload {
  content: string
  defaultName?: string
}

interface CanvasDVectorExportPayload extends CanvasDSvgExportPayload {
  format: 'eps'
}

interface CanvasDFileResult<T = unknown> {
  canceled?: boolean
  ok?: boolean
  error?: string
  path?: string
  data?: T
}

interface CanvasDOpenedDocument {
  kind: 'project' | 'svg' | 'vector' | 'image'
  name: string
  extension: string
  project?: ProjectDocument
  content?: string
  dataUrl?: string
  bytes?: Uint8Array
  convertedFrom?: 'eps'
}

declare global {
  interface Window {
    canvasD: {
      saveProject: (projectData: ProjectDocument, path?: string) => Promise<CanvasDFileResult<ProjectDocument>>
      saveProjectAs: (projectData: ProjectDocument) => Promise<CanvasDFileResult<ProjectDocument>>
      openProject: () => Promise<CanvasDFileResult<ProjectDocument>>
      openProjectPath: (path: string) => Promise<CanvasDFileResult<ProjectDocument>>
      openDocument: () => Promise<CanvasDFileResult<CanvasDOpenedDocument>>
      openDocumentPath: (path: string) => Promise<CanvasDFileResult<CanvasDOpenedDocument>>
      chooseSavePath: (defaultName?: string) => Promise<CanvasDFileResult>
      writeDocumentText: (path: string, content: string) => Promise<CanvasDFileResult>
      writeDocumentBytes: (path: string, bytes: Uint8Array) => Promise<CanvasDFileResult>
      convertVectorFile: (name: string, bytes: Uint8Array) => Promise<CanvasDFileResult<string>>
      writeEps: (path: string, svg: string) => Promise<CanvasDFileResult>
      exportPng: (exportPayload: CanvasDExportPayload) => Promise<CanvasDFileResult>
      exportJpeg: (exportPayload: CanvasDExportPayload) => Promise<CanvasDFileResult>
      exportWebp: (exportPayload: CanvasDExportPayload) => Promise<CanvasDFileResult>
      exportSvg: (exportPayload: CanvasDSvgExportPayload) => Promise<CanvasDFileResult>
      exportVector: (exportPayload: CanvasDVectorExportPayload) => Promise<CanvasDFileResult>
      getRecentProjects: () => Promise<ProjectMeta[]>
      listFonts: () => Promise<string[]>
      setRecentProject: (projectMeta: ProjectMeta) => Promise<CanvasDFileResult>
      autosaveProject: (projectId: string, projectData: ProjectDocument) => Promise<CanvasDFileResult>
      writeClipboardText: (text: string) => void
      onOpenSettings: (callback: () => void) => () => void
    }
  }
}

export {}
