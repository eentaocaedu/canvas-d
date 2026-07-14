import { useCanvasStore } from '@renderer/store/useCanvasStore'
import { useWorkspaceStore } from '@renderer/store/useWorkspaceStore'

const StatusBar = (): JSX.Element => {
  const tool = useCanvasStore((state) => state.tool)
  const selectedIds = useCanvasStore((state) => state.selectedIds)
  const mouseWorld = useCanvasStore((state) => state.mouseWorld)
  const saveState = useWorkspaceStore((state) => state.saveState)

  return (
    <footer className="flex items-center justify-between border-t border-border bg-panel px-3 text-[11px] text-muted">
      <span>Ferramenta: {tool}</span>
      <span>
        X {Math.round(mouseWorld.x)} / Y {Math.round(mouseWorld.y)}
      </span>
      <span>{selectedIds.length} selecionado(s)</span>
      <span>{saveState === 'dirty' ? 'Alterado' : saveState === 'saved' ? 'Salvo' : saveState}</span>
    </footer>
  )
}

export default StatusBar
