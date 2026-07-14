import CanvasViewport from '../canvas/CanvasViewport'
import LeftToolbar from './LeftToolbar'
import RightInspector from './RightInspector'
import StatusBar from './StatusBar'
import TopBar from './TopBar'
import { useEffect } from 'react'
import { useProjectCommands } from '@renderer/hooks/useProjectCommands'
import { useShortcuts } from '@renderer/hooks/useShortcuts'
import { useWorkspaceStore } from '@renderer/store/useWorkspaceStore'
import { useInspectorLayoutStore } from '@renderer/store/useInspectorLayoutStore'

const AppShell = (): JSX.Element => {
  const commands = useProjectCommands()
  const saveState = useWorkspaceStore((state) => state.saveState)
  const autosaveProject = commands.autosaveProject
  const inspectorWidth = useInspectorLayoutStore((state) => state.width)
  const inspectorCollapsed = useInspectorLayoutStore((state) => state.panelCollapsed)

  useShortcuts(commands)

  useEffect(() => {
    if (saveState !== 'dirty') return
    const timer = window.setInterval(() => {
      void autosaveProject()
    }, 10_000)
    return () => window.clearInterval(timer)
  }, [autosaveProject, saveState])

  return (
    <div className="grid h-screen grid-rows-[48px_1fr_28px] overflow-hidden bg-surface text-slate-100">
      <TopBar />
      <div
        className="app-workspace-grid relative grid min-h-0"
        style={{ gridTemplateColumns: `56px minmax(0, 1fr) ${inspectorCollapsed ? 54 : inspectorWidth}px` }}
      >
        <LeftToolbar />
        <CanvasViewport />
        <RightInspector />
      </div>
      <StatusBar />
    </div>
  )
}

export default AppShell
