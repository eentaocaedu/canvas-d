import { app, dialog, ipcMain } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'

export interface FileResult<T = unknown> {
  canceled?: boolean
  ok?: boolean
  error?: string
  path?: string
  data?: T
}

interface ProjectMeta {
  id: string
  name: string
  path: string
  updatedAt: string
}

const recentProjectsPath = (): string => join(app.getPath('userData'), 'recent-projects.json')
const autosaveDir = (): string => join(app.getPath('userData'), 'autosave')

const normalizeProjectName = (filePath: string): string => basename(filePath, '.pcanvas')

const withFileProjectName = (projectData: unknown, targetPath: string): unknown => {
  if (!projectData || typeof projectData !== 'object' || Array.isArray(projectData)) return projectData
  return {
    ...projectData,
    name: normalizeProjectName(targetPath)
  }
}

const saveProjectToPath = async (projectData: unknown, targetPath: string): Promise<FileResult> => {
  const data = withFileProjectName(projectData, targetPath)
  await writeFile(targetPath, JSON.stringify(data, null, 2), 'utf8')
  const document = data as { id?: string; name?: string; updatedAt?: string }
  await upsertRecentProject({
    id: document.id ?? targetPath,
    name: document.name ?? normalizeProjectName(targetPath),
    path: targetPath,
    updatedAt: document.updatedAt ?? new Date().toISOString()
  })

  return { ok: true, path: targetPath, data }
}

const openProjectFromPath = async (path: string): Promise<FileResult> => {
  const data = withFileProjectName(JSON.parse(await readFile(path, 'utf8')), path)
  const document = data as { id?: string; name?: string; updatedAt?: string }
  await upsertRecentProject({
    id: document.id ?? path,
    name: document.name ?? normalizeProjectName(path),
    path,
    updatedAt: document.updatedAt ?? new Date().toISOString()
  })

  return { ok: true, path, data }
}

const readRecentProjects = async (): Promise<ProjectMeta[]> => {
  try {
    const raw = await readFile(recentProjectsPath(), 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const writeRecentProjects = async (projects: ProjectMeta[]): Promise<void> => {
  await mkdir(dirname(recentProjectsPath()), { recursive: true })
  await writeFile(recentProjectsPath(), JSON.stringify(projects.slice(0, 12), null, 2), 'utf8')
}

const upsertRecentProject = async (meta: ProjectMeta): Promise<void> => {
  const current = await readRecentProjects()
  await writeRecentProjects([meta, ...current.filter((project) => project.path !== meta.path)])
}

export const registerFileSystemIpc = (): void => {
  ipcMain.handle('project:save', async (_event, payload: { projectData: unknown; path?: string }): Promise<FileResult> => {
    try {
      const targetPath = payload.path
      if (!targetPath) {
        return { ok: false, error: 'No path supplied for save.' }
      }

      return await saveProjectToPath(payload.projectData, targetPath)
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Unable to save project.' }
    }
  })

  ipcMain.handle('project:saveAs', async (_event, projectData: unknown): Promise<FileResult> => {
    const result = await dialog.showSaveDialog({
      title: 'Save Canvas D project',
      defaultPath: 'Untitled.pcanvas',
      filters: [{ name: 'Canvas D Project', extensions: ['pcanvas'] }]
    })

    if (result.canceled || !result.filePath) return { canceled: true }
    try {
      return await saveProjectToPath(projectData, result.filePath)
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Unable to save project.' }
    }
  })

  ipcMain.handle('project:open', async (): Promise<FileResult> => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Open Canvas D project',
        properties: ['openFile'],
        filters: [{ name: 'Canvas D Project', extensions: ['pcanvas'] }]
      })

      if (result.canceled || result.filePaths.length === 0) return { canceled: true }
      return await openProjectFromPath(result.filePaths[0])
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Unable to open project.' }
    }
  })

  ipcMain.handle('project:openPath', async (_event, path: string): Promise<FileResult> => {
    try {
      return await openProjectFromPath(path)
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Unable to open recent project.' }
    }
  })

  ipcMain.handle('project:recent:get', async (): Promise<ProjectMeta[]> => readRecentProjects())

  ipcMain.handle('project:recent:set', async (_event, meta: ProjectMeta): Promise<FileResult> => {
    try {
      await upsertRecentProject(meta)
      return { ok: true }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Unable to update recent projects.' }
    }
  })

  ipcMain.handle('project:autosave', async (_event, payload: { projectId: string; projectData: unknown }): Promise<FileResult> => {
    try {
      await mkdir(autosaveDir(), { recursive: true })
      const path = join(autosaveDir(), `${payload.projectId}.pcanvas`)
      await writeFile(path, JSON.stringify(payload.projectData, null, 2), 'utf8')
      return { ok: true, path }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Unable to autosave project.' }
    }
  })
}
