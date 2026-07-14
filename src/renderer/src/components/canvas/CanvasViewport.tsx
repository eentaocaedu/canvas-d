import { useCallback, useEffect, useRef, useState } from 'react'
import { internalClipboardMarker } from '@renderer/lib/clipboard'
import { screenToWorld } from '@renderer/lib/coordinates'
import { importAssetFile, isCanvasAssetFile, isUnsupportedAiFile } from '@renderer/lib/assetImport'
import { useCanvasStore } from '@renderer/store/useCanvasStore'
import { useHistoryStore } from '@renderer/store/useHistoryStore'
import { useWorkspaceStore } from '@renderer/store/useWorkspaceStore'
import type { Point } from '@renderer/types/canvas'
import GridLayer from './GridLayer'
import InfiniteCanvas from './InfiniteCanvas'
import LayersPanel from './LayersPanel'
import RulersOverlay from './RulersOverlay'
import TextEditorOverlay from './TextEditorOverlay'
import ToolCursor from './ToolCursor'

const isEditableTarget = (target: EventTarget | null): boolean => {
  return target instanceof Element && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
}

const hasDraggedFiles = (dataTransfer: DataTransfer): boolean => Array.from(dataTransfer.types).includes('Files')

const CanvasViewport = (): JSX.Element => {
  const containerRef = useRef<HTMLElement>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const [size, setSize] = useState({ width: 1, height: 1 })
  const [spacePressed, setSpacePressed] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const camera = useCanvasStore((state) => state.camera)
  const tool = useCanvasStore((state) => state.tool)

  const worldFromClientPoint = useCallback((clientX: number, clientY: number): Point | null => {
    const bounds = containerRef.current?.getBoundingClientRect()
    if (!bounds) return null
    return screenToWorld({ x: clientX - bounds.left, y: clientY - bounds.top }, useCanvasStore.getState().camera)
  }, [])

  const viewportCenterWorld = useCallback((): Point => screenToWorld({ x: size.width / 2, y: size.height / 2 }, useCanvasStore.getState().camera), [size.height, size.width])

  const importImageFile = useCallback((file: File, point: Point): void => {
    void importAssetFile(file, point)
  }, [])

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: Math.max(1, Math.floor(entry.contentRect.width)),
        height: Math.max(1, Math.floor(entry.contentRect.height))
      })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null
      if (target?.tagName === 'TEXTAREA' || target?.tagName === 'INPUT') return
      if (event.code === 'Space') {
        event.preventDefault()
        setSpacePressed(true)
      }
    }

    const onKeyUp = (event: KeyboardEvent): void => {
      if (event.code === 'Space') setSpacePressed(false)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  useEffect(() => {
    const onPaste = (event: ClipboardEvent): void => {
      if (isEditableTarget(event.target)) return
      const clipboard = event.clipboardData
      if (!clipboard) return
      const canvas = useCanvasStore.getState()
      const clipboardText = clipboard.getData('text/plain')

      if (clipboardText === internalClipboardMarker && canvas.clipboard.length > 0) {
        event.preventDefault()
        useHistoryStore.getState().push({ camera: canvas.camera, objects: canvas.objects, guides: canvas.guides })
        canvas.pasteClipboard()
        useWorkspaceStore.getState().markDirty()
        return
      }

      const itemFiles = Array.from(clipboard.items)
        .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
        .map((item) => item.getAsFile())
        .filter((file): file is File => Boolean(file))
      const clipboardFiles = Array.from(clipboard.files).filter(isCanvasAssetFile)
      const imageFiles = [...clipboardFiles, ...itemFiles].filter((file, index, list) => list.findIndex((candidate) => candidate.name === file.name && candidate.size === file.size) === index)

      if (imageFiles.length > 0) {
        event.preventDefault()
        const mouseWorld = useCanvasStore.getState().mouseWorld
        const basePoint = Number.isFinite(mouseWorld.x) && Number.isFinite(mouseWorld.y) ? mouseWorld : viewportCenterWorld()
        imageFiles.forEach((file, index) => importImageFile(file, { x: basePoint.x + index * 24, y: basePoint.y + index * 24 }))
        return
      }

      if (canvas.clipboard.length > 0) {
        event.preventDefault()
        useHistoryStore.getState().push({ camera: canvas.camera, objects: canvas.objects, guides: canvas.guides })
        canvas.pasteClipboard()
        useWorkspaceStore.getState().markDirty()
      }
    }

    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [importImageFile, viewportCenterWorld])

  useEffect(() => {
    const onWindowDragOver = (event: DragEvent): void => {
      if (!event.dataTransfer || !hasDraggedFiles(event.dataTransfer)) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'
    }

    const onWindowDrop = (event: DragEvent): void => {
      if (!event.dataTransfer || !hasDraggedFiles(event.dataTransfer)) return
      event.preventDefault()
      const droppedFiles = Array.from(event.dataTransfer.files)
      if (droppedFiles.some(isUnsupportedAiFile)) {
        window.alert('Arquivos AI proprietarios nao sao abertos diretamente. No Illustrator, exporte como SVG para preservar vetores e grupos e arraste o SVG para o Canvas D.')
      }
      const files = droppedFiles.filter(isCanvasAssetFile)
      if (files.length === 0) return
      const basePoint = worldFromClientPoint(event.clientX, event.clientY) ?? viewportCenterWorld()
      files.forEach((file, index) => importImageFile(file, { x: basePoint.x + index * 24, y: basePoint.y + index * 24 }))
    }

    window.addEventListener('dragover', onWindowDragOver)
    window.addEventListener('drop', onWindowDrop)
    return () => {
      window.removeEventListener('dragover', onWindowDragOver)
      window.removeEventListener('drop', onWindowDrop)
    }
  }, [importImageFile, viewportCenterWorld, worldFromClientPoint])

  return (
    <main ref={containerRef} className="relative min-h-0 overflow-hidden bg-surface">
      <GridLayer camera={camera} />
      <InfiniteCanvas
        width={size.width}
        height={size.height}
        spacePressed={spacePressed}
        imageInputRef={imageInputRef}
        onEditText={setEditingId}
        editingId={editingId}
      />
      <RulersOverlay width={size.width} height={size.height} camera={camera} />
      <TextEditorOverlay editingId={editingId} onClose={() => setEditingId(null)} />
      <ToolCursor containerRef={containerRef} spacePressed={spacePressed} />
      <LayersPanel />
      <div className="pointer-events-none absolute left-4 top-4 rounded-md border border-border bg-panel/80 px-2 py-1 text-[11px] text-muted">
        {tool.toUpperCase()} · {Math.round(camera.zoom * 100)}%
      </div>
    </main>
  )
}

export default CanvasViewport
