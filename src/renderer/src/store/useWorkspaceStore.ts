import { create } from 'zustand'
import type { ProjectDocument, ProjectMeta } from '@renderer/types/project'

interface WorkspaceState {
  project: ProjectDocument | null
  projectPath: string | null
  recentProjects: ProjectMeta[]
  saveState: 'idle' | 'dirty' | 'saving' | 'saved' | 'error'
  newProjectDialogOpen: boolean
  setProject: (project: ProjectDocument | null, path?: string | null, saveState?: WorkspaceState['saveState']) => void
  setProjectPath: (path: string | null) => void
  setRecentProjects: (projects: ProjectMeta[]) => void
  setSaveState: (state: WorkspaceState['saveState']) => void
  setNewProjectDialogOpen: (open: boolean) => void
  markDirty: () => void
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  project: null,
  projectPath: null,
  recentProjects: [],
  saveState: 'idle',
  newProjectDialogOpen: false,
  setProject: (project, path = null, saveState = project ? 'saved' : 'idle') => set({ project, projectPath: path, saveState }),
  setProjectPath: (projectPath) => set({ projectPath }),
  setRecentProjects: (recentProjects) => set({ recentProjects }),
  setSaveState: (saveState) => set({ saveState }),
  setNewProjectDialogOpen: (newProjectDialogOpen) => set({ newProjectDialogOpen }),
  markDirty: () => set((state) => ({ saveState: state.project ? 'dirty' : state.saveState }))
}))
