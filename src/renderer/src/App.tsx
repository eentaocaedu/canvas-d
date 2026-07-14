import { useEffect } from 'react'
import AppShell from './components/layout/AppShell'
import WorkspaceHome from './components/workspace/WorkspaceHome'
import NewProjectDialog from './components/workspace/NewProjectDialog'
import SettingsDialog from './components/settings/SettingsDialog'
import { useWorkspaceStore } from './store/useWorkspaceStore'
import { useAppSettingsStore } from './store/useAppSettingsStore'

const App = (): JSX.Element => {
  const project = useWorkspaceStore((state) => state.project)
  const setRecentProjects = useWorkspaceStore((state) => state.setRecentProjects)
  const theme = useAppSettingsStore((state) => state.theme)
  const density = useAppSettingsStore((state) => state.density)
  const gridStyle = useAppSettingsStore((state) => state.gridStyle)
  const reducedMotion = useAppSettingsStore((state) => state.reducedMotion)
  const setSettingsOpen = useAppSettingsStore((state) => state.setSettingsOpen)

  useEffect(() => {
    void window.canvasD.getRecentProjects().then(setRecentProjects)
  }, [setRecentProjects])

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    root.dataset.density = density
    root.dataset.grid = gridStyle
    root.classList.toggle('reduce-motion', reducedMotion)
  }, [density, gridStyle, reducedMotion, theme])

  useEffect(() => window.canvasD.onOpenSettings(() => setSettingsOpen(true)), [setSettingsOpen])

  return (
    <>
      {project ? <AppShell /> : <WorkspaceHome />}
      <NewProjectDialog />
      <SettingsDialog />
    </>
  )
}

export default App
