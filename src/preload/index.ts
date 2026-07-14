import { clipboard, contextBridge, ipcRenderer } from 'electron'

const api = {
  saveProject: (projectData: unknown, path?: string) => ipcRenderer.invoke('project:save', { projectData, path }),
  saveProjectAs: (projectData: unknown) => ipcRenderer.invoke('project:saveAs', projectData),
  openProject: () => ipcRenderer.invoke('project:open'),
  openProjectPath: (path: string) => ipcRenderer.invoke('project:openPath', path),
  openDocument: () => ipcRenderer.invoke('document:open'),
  openDocumentPath: (path: string) => ipcRenderer.invoke('document:openPath', path),
  chooseSavePath: (defaultName?: string) => ipcRenderer.invoke('document:chooseSavePath', defaultName),
  writeDocumentText: (path: string, content: string) => ipcRenderer.invoke('document:writeText', { path, content }),
  writeDocumentBytes: (path: string, bytes: Uint8Array) => ipcRenderer.invoke('document:writeBytes', { path, bytes }),
  convertVectorFile: (name: string, bytes: Uint8Array) => ipcRenderer.invoke('vector:convertBuffer', { name, bytes }),
  writeEps: (path: string, svg: string) => ipcRenderer.invoke('vector:writeEps', { path, svg }),
  exportPng: (exportPayload: unknown) => ipcRenderer.invoke('export:png', exportPayload),
  exportJpeg: (exportPayload: unknown) => ipcRenderer.invoke('export:jpeg', exportPayload),
  exportWebp: (exportPayload: unknown) => ipcRenderer.invoke('export:webp', exportPayload),
  exportSvg: (exportPayload: unknown) => ipcRenderer.invoke('export:svg', exportPayload),
  exportVector: (exportPayload: unknown) => ipcRenderer.invoke('export:vector', exportPayload),
  getRecentProjects: () => ipcRenderer.invoke('project:recent:get'),
  listFonts: () => ipcRenderer.invoke('fonts:list'),
  setRecentProject: (projectMeta: unknown) => ipcRenderer.invoke('project:recent:set', projectMeta),
  autosaveProject: (projectId: string, projectData: unknown) =>
    ipcRenderer.invoke('project:autosave', { projectId, projectData }),
  writeClipboardText: (text: string) => clipboard.writeText(text),
  onOpenSettings: (callback: () => void) => {
    const handler = (): void => callback()
    ipcRenderer.on('app:openSettings', handler)
    return () => ipcRenderer.removeListener('app:openSettings', handler)
  }
}

contextBridge.exposeInMainWorld('canvasD', api)
