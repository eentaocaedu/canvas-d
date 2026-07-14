import { useEffect } from 'react'
import { internalClipboardMarker } from '@renderer/lib/clipboard'
import { boundsFromObjects } from '@renderer/lib/bounds'
import { clampZoom } from '@renderer/lib/coordinates'
import { toolShortcuts } from '@renderer/lib/shortcuts'
import { useCanvasStore } from '@renderer/store/useCanvasStore'
import { useHistoryStore } from '@renderer/store/useHistoryStore'
import { useWorkspaceStore } from '@renderer/store/useWorkspaceStore'

interface ShortcutCommands {
  newProject: () => void
  loadProject: () => void
  saveProject: () => void
  saveProjectAs: () => void
  exportSelectedFrame: () => void
  exportSelectedSvg: () => void
}

const isEditableTarget = (target: EventTarget | null): boolean => {
  return target instanceof Element && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
}

export const useShortcuts = ({ newProject, loadProject, saveProject, saveProjectAs, exportSelectedFrame, exportSelectedSvg }: ShortcutCommands): void => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Tab') {
        event.preventDefault()
        return
      }

      if (isEditableTarget(event.target)) return
      const canvas = useCanvasStore.getState()
      const history = useHistoryStore.getState()
      const workspace = useWorkspaceStore.getState()
      const key = event.key.toLowerCase()

      if (event.ctrlKey || event.metaKey) {
        if (key === 's' && event.shiftKey) {
          event.preventDefault()
          void saveProjectAs()
        } else if (key === 's') {
          event.preventDefault()
          void saveProject()
        } else if (key === 'o') {
          event.preventDefault()
          void loadProject()
        } else if (key === 'n') {
          event.preventDefault()
          newProject()
        } else if (key === 'e' && event.shiftKey) {
          event.preventDefault()
          void exportSelectedSvg()
        } else if (key === 'e') {
          event.preventDefault()
          void exportSelectedFrame()
        } else if (key === 'r') {
          event.preventDefault()
          canvas.toggleRulers()
        } else if (key === 'd') {
          event.preventDefault()
          if (canvas.selectedIds.length > 0) {
            history.push({ camera: canvas.camera, objects: canvas.objects, guides: canvas.guides })
            canvas.duplicateSelected()
            workspace.markDirty()
          }
        } else if (key === 'g' && event.shiftKey) {
          event.preventDefault()
          history.push({ camera: canvas.camera, objects: canvas.objects, guides: canvas.guides })
          canvas.ungroupSelected()
          workspace.markDirty()
        } else if (key === 'g') {
          event.preventDefault()
          history.push({ camera: canvas.camera, objects: canvas.objects, guides: canvas.guides })
          canvas.groupSelected()
          workspace.markDirty()
        } else if (key === 'c') {
          event.preventDefault()
          if (canvas.selectedIds.length > 0) {
            canvas.copySelected()
            window.canvasD.writeClipboardText(internalClipboardMarker)
          }
        } else if (key === 'a') {
          event.preventDefault()
          canvas.selectAll()
        } else if (key === 'z') {
          event.preventDefault()
          const snapshot = event.shiftKey
            ? history.redo({ camera: canvas.camera, objects: canvas.objects, guides: canvas.guides })
            : history.undo({ camera: canvas.camera, objects: canvas.objects, guides: canvas.guides })
          if (snapshot) {
            canvas.setCanvas({ ...snapshot, camera: canvas.camera }, { preserveSelection: true })
            workspace.markDirty()
          }
        } else if (key === '0') {
          event.preventDefault()
          canvas.setCamera({ x: 0, y: 0, zoom: 1 })
          workspace.markDirty()
        } else if (key === '1') {
          event.preventDefault()
          canvas.setCamera({ ...canvas.camera, zoom: 1 })
          workspace.markDirty()
        } else if (key === '2') {
          event.preventDefault()
          const selected = canvas.objects.filter((object) => canvas.selectedIds.includes(object.id) && object.visible)
          const targetObjects = selected.length > 0 ? selected : canvas.objects.filter((object) => object.visible)
          const bounds = boundsFromObjects(targetObjects, 40)
          if (bounds) {
            const viewportWidth = Math.max(320, window.innerWidth - 356)
            const viewportHeight = Math.max(240, window.innerHeight - 76)
            const zoom = clampZoom(Math.min(viewportWidth / bounds.width, viewportHeight / bounds.height, 2))
            canvas.setCamera({
              x: (viewportWidth - bounds.width * zoom) / 2 - bounds.x * zoom,
              y: (viewportHeight - bounds.height * zoom) / 2 - bounds.y * zoom,
              zoom
            })
            workspace.markDirty()
          }
        } else if (key === '+' || key === '=') {
          event.preventDefault()
          canvas.setCamera({ ...canvas.camera, zoom: clampZoom(canvas.camera.zoom * 1.1) })
          workspace.markDirty()
        } else if (key === '-') {
          event.preventDefault()
          canvas.setCamera({ ...canvas.camera, zoom: clampZoom(canvas.camera.zoom / 1.1) })
          workspace.markDirty()
        }
        return
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        if (canvas.selectedGuideId) {
          history.push({ camera: canvas.camera, objects: canvas.objects, guides: canvas.guides })
          canvas.deleteSelectedGuide()
          workspace.markDirty()
        } else if (canvas.selectedIds.length > 0) {
          history.push({ camera: canvas.camera, objects: canvas.objects, guides: canvas.guides })
          canvas.deleteSelected()
          workspace.markDirty()
        }
      } else if (event.key === 'Escape') {
        canvas.clearSelection()
      } else if (event.key.startsWith('Arrow') && canvas.selectedIds.length > 0) {
        event.preventDefault()
        const distance = event.shiftKey ? 10 : 1
        const dx = event.key === 'ArrowLeft' ? -distance : event.key === 'ArrowRight' ? distance : 0
        const dy = event.key === 'ArrowUp' ? -distance : event.key === 'ArrowDown' ? distance : 0
        const selected = canvas.objects.filter((object) => canvas.selectedIds.includes(object.id) && !object.locked)
        if (selected.length > 0) {
          history.pushCoalesced(`nudge:${selected.map((object) => object.id).join(',')}`, { camera: canvas.camera, objects: canvas.objects, guides: canvas.guides }, 500)
          canvas.updateObjects(selected.map((object) => ({ id: object.id, patch: { x: object.x + dx, y: object.y + dy } as Partial<typeof object> })))
          workspace.markDirty()
        }
      } else if (toolShortcuts[key]) {
        canvas.setTool(toolShortcuts[key])
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [exportSelectedFrame, exportSelectedSvg, loadProject, newProject, saveProject, saveProjectAs])
}
