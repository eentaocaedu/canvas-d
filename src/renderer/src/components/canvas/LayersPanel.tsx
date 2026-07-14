import { Eye, EyeOff, GripVertical, Layers, Lock, PanelRight, PanelTopOpen, Type, Unlock, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useCanvasStore } from '@renderer/store/useCanvasStore'
import { useHistoryStore } from '@renderer/store/useHistoryStore'
import { useWorkspaceStore } from '@renderer/store/useWorkspaceStore'
import { useAppSettingsStore } from '@renderer/store/useAppSettingsStore'
import type { CanvasObject } from '@renderer/types/canvas'

const layerTitle = (object: CanvasObject): string => {
  if (object.type === 'text') {
    const text = object.text.replace(/\s+/g, ' ').trim()
    return text || 'Texto'
  }
  if (object.type === 'group') return `${object.name} (${object.children.length})`
  return object.name
}

const LayerPreview = ({ object }: { object: CanvasObject }): JSX.Element => {
  if (object.type === 'text') {
    return (
      <span className="layer-preview text-preview" title="Texto">
        <Type size={15} />
      </span>
    )
  }

  if (object.type === 'ellipse') {
    return (
      <span className="layer-preview">
        <span className="h-5 w-5 rounded-full border" style={{ background: object.fill, borderColor: object.stroke, borderWidth: Math.max(1, Math.min(3, object.strokeWidth)) }} />
      </span>
    )
  }

  if (object.type === 'rect') {
    return (
      <span className="layer-preview">
        <span className="h-5 w-6 rounded-sm border" style={{ background: object.fill, borderColor: object.stroke, borderWidth: Math.max(1, Math.min(3, object.strokeWidth)) }} />
      </span>
    )
  }

  if (object.type === 'diamond' || object.type === 'polygon' || object.type === 'note') {
    return (
      <span className="layer-preview">
        <span
          className={`h-5 w-5 border ${object.type === 'diamond' ? 'rotate-45' : object.type === 'polygon' ? 'rounded-full' : 'rounded-sm'}`}
          style={{ background: object.fill, borderColor: object.stroke, borderWidth: Math.max(1, Math.min(3, object.strokeWidth)) }}
        />
      </span>
    )
  }

  if (object.type === 'frame') {
    return (
      <span className="layer-preview">
        <span className="h-5 w-6 rounded-sm border border-slate-500" style={{ background: object.background }} />
      </span>
    )
  }

  if (object.type === 'line' || object.type === 'arrow') {
    return (
      <span className="layer-preview">
        <span className="h-px w-7 rotate-[-20deg]" style={{ background: object.stroke, height: Math.max(2, Math.min(4, object.strokeWidth)) }} />
      </span>
    )
  }

  if (object.type === 'freehand') {
    return (
      <span className="layer-preview">
        <span className="text-base leading-none" style={{ color: object.stroke }}>
          ~
        </span>
      </span>
    )
  }

  if (object.type === 'vector' || object.type === 'path') {
    return (
      <span className="layer-preview">
        <span className="text-base leading-none" style={{ color: object.stroke }}>
          ⌁
        </span>
      </span>
    )
  }

  if (object.type === 'image') {
    return (
      <span className="layer-preview overflow-hidden">
        <img src={object.src} alt="" className="h-full w-full object-cover" />
      </span>
    )
  }

  if (object.type === 'group') {
    return (
      <span className="layer-preview" title="Grupo">
        <Layers size={16} />
      </span>
    )
  }

  return <span className="layer-preview" />
}

interface LayersPanelProps {
  mode?: 'floating' | 'docked'
}

const LayersPanel = ({ mode = 'floating' }: LayersPanelProps): JSX.Element | null => {
  const [open, setOpen] = useState(false)
  const [panelHeight, setPanelHeight] = useState(340)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const resizeStartRef = useRef<{ y: number; height: number } | null>(null)
  const selectionAnchorRef = useRef<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const dropIndexRef = useRef<number | null>(null)
  const dragCleanupRef = useRef<(() => void) | null>(null)
  const suppressClickRef = useRef<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const layersDocked = useAppSettingsStore((state) => state.layersDocked)
  const autoCloseFloatingPanels = useAppSettingsStore((state) => state.autoCloseFloatingPanels)
  const setLayersDocked = useAppSettingsStore((state) => state.setLayersDocked)
  const objects = useCanvasStore((state) => state.objects)
  const selectedIds = useCanvasStore((state) => state.selectedIds)
  const camera = useCanvasStore((state) => state.camera)
  const guides = useCanvasStore((state) => state.guides)
  const setSelectedIds = useCanvasStore((state) => state.setSelectedIds)
  const updateObject = useCanvasStore((state) => state.updateObject)
  const setLayerZIndex = useCanvasStore((state) => state.setLayerZIndex)
  const markDirty = useWorkspaceStore((state) => state.markDirty)
  const pushHistory = useHistoryStore((state) => state.push)

  const layers = useMemo(() => [...objects].sort((a, b) => b.zIndex - a.zIndex), [objects])

  const moveLayerToDisplayIndex = (id: string, displayIndex: number): void => {
    const draggedDisplayIndex = layers.findIndex((layer) => layer.id === id)
    const remainingCount = Math.max(0, layers.length - 1)
    const adjustedDisplayIndex = Math.max(0, Math.min(remainingCount, displayIndex - (draggedDisplayIndex >= 0 && draggedDisplayIndex < displayIndex ? 1 : 0)))
    const targetZIndex = remainingCount - adjustedDisplayIndex
    pushHistory({ camera, objects, guides })
    setLayerZIndex(id, targetZIndex)
    markDirty()
  }

  useEffect(() => () => dragCleanupRef.current?.(), [])

  const setDropTarget = (index: number): void => {
    dropIndexRef.current = index
    setDropIndex(index)
  }

  const updateDropTargetFromPointer = (clientY: number, autoScroll: boolean): void => {
    const scroller = scrollRef.current
    if (!scroller) return
    if (autoScroll) {
      const bounds = scroller.getBoundingClientRect()
      const edge = 52
      if (clientY < bounds.top + edge) scroller.scrollTop -= Math.ceil((bounds.top + edge - clientY) / 2)
      else if (clientY > bounds.bottom - edge) scroller.scrollTop += Math.ceil((clientY - (bounds.bottom - edge)) / 2)
    }
    const rows = Array.from(scroller.querySelectorAll<HTMLElement>('[data-layer-id]'))
    const nextIndex = rows.findIndex((row) => {
      const bounds = row.getBoundingClientRect()
      return clientY < bounds.top + bounds.height / 2
    })
    setDropTarget(nextIndex < 0 ? rows.length : nextIndex)
  }

  const startLayerPointerDrag = (event: React.PointerEvent<HTMLDivElement>, id: string, displayIndex: number): void => {
    if (event.button !== 0 || (event.target as Element).closest('[data-layer-control="true"]')) return
    dragCleanupRef.current?.()
    const pointerId = event.pointerId
    const startX = event.clientX
    const startY = event.clientY
    let active = false
    let lastClientY = startY

    const cleanup = (): void => {
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerup', onPointerUp)
      document.removeEventListener('pointercancel', onPointerCancel)
      document.removeEventListener('wheel', onWheel, true)
      document.body.classList.remove('is-dragging-layer')
      dragCleanupRef.current = null
    }

    const finish = (commit: boolean): void => {
      cleanup()
      if (active && commit && dropIndexRef.current !== null) moveLayerToDisplayIndex(id, dropIndexRef.current)
      if (active) {
        suppressClickRef.current = id
        window.setTimeout(() => {
          if (suppressClickRef.current === id) suppressClickRef.current = null
        }, 0)
      }
      dropIndexRef.current = null
      setDraggedId(null)
      setDropIndex(null)
    }

    const onPointerMove = (moveEvent: PointerEvent): void => {
      if (moveEvent.pointerId !== pointerId) return
      lastClientY = moveEvent.clientY
      if (!active && Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) >= 4) {
        active = true
        document.body.classList.add('is-dragging-layer')
        setDraggedId(id)
        setDropTarget(displayIndex)
      }
      if (!active) return
      moveEvent.preventDefault()
      updateDropTargetFromPointer(lastClientY, true)
    }

    const onWheel = (wheelEvent: WheelEvent): void => {
      if (!active || !scrollRef.current) return
      wheelEvent.preventDefault()
      wheelEvent.stopPropagation()
      const unit = wheelEvent.deltaMode === WheelEvent.DOM_DELTA_LINE ? 30 : wheelEvent.deltaMode === WheelEvent.DOM_DELTA_PAGE ? scrollRef.current.clientHeight : 1
      scrollRef.current.scrollTop += wheelEvent.deltaY * unit
      updateDropTargetFromPointer(lastClientY, false)
    }

    const onPointerUp = (upEvent: PointerEvent): void => {
      if (upEvent.pointerId !== pointerId) return
      if (active) upEvent.preventDefault()
      finish(true)
    }
    const onPointerCancel = (cancelEvent: PointerEvent): void => {
      if (cancelEvent.pointerId === pointerId) finish(false)
    }

    document.addEventListener('pointermove', onPointerMove, { passive: false })
    document.addEventListener('pointerup', onPointerUp, { passive: false })
    document.addEventListener('pointercancel', onPointerCancel)
    document.addEventListener('wheel', onWheel, { capture: true, passive: false })
    dragCleanupRef.current = cleanup
  }

  useEffect(() => {
    if (mode !== 'floating' || !open || !autoCloseFloatingPanels) return
    const closeOnOutsideClick = (event: PointerEvent): void => {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', closeOnOutsideClick)
    return () => window.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [autoCloseFloatingPanels, mode, open])

  const startResize = (event: React.PointerEvent<HTMLDivElement>): void => {
    resizeStartRef.current = { y: event.clientY, height: panelHeight }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const resize = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (!resizeStartRef.current) return
    const delta = event.clientY - resizeStartRef.current.y
    setPanelHeight(Math.max(220, Math.min(680, resizeStartRef.current.height + delta)))
  }

  const stopResize = (event: React.PointerEvent<HTMLDivElement>): void => {
    resizeStartRef.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  if ((mode === 'docked') !== layersDocked) return null
  const docked = mode === 'docked'

  return (
    <div ref={panelRef} className={docked ? 'text-sm' : 'absolute right-4 top-4 z-30 text-sm'}>
      {!docked && !open ? (
        <button className="floating-tool-button" title="Camadas" onClick={() => setOpen(true)}>
          <Layers size={18} />
        </button>
      ) : (
        <section className={docked ? 'layers-docked-shell relative overflow-hidden' : 'relative w-72 overflow-hidden rounded-xl border border-border bg-panel/95 shadow-2xl backdrop-blur'} style={{ height: docked ? 420 : panelHeight }}>
          <header className="flex items-center justify-between border-b border-border px-3 py-2">
            <div className="flex items-center gap-2 font-medium text-white">
              <Layers size={16} />
              Camadas
            </div>
            <div className="flex items-center gap-1">
              <button className="toolbar-button h-7 w-7" onClick={() => { setLayersDocked(!docked); setOpen(false) }} title={docked ? 'Desencaixar camadas' : 'Encaixar em Propriedades'}>
                {docked ? <PanelTopOpen size={15} /> : <PanelRight size={15} />}
              </button>
              {!docked ? <button className="toolbar-button h-7 w-7" onClick={() => setOpen(false)} title="Fechar camadas"><X size={15} /></button> : null}
            </div>
          </header>
          <div
            ref={scrollRef}
            className="overflow-y-auto p-2"
            style={{ height: (docked ? 420 : panelHeight) - 47 }}
          >
            {layers.length === 0 ? (
              <div className="px-2 py-4 text-xs text-muted">Nenhuma camada.</div>
            ) : (
              layers.map((object, displayIndex) => (
                <div
                  key={object.id}
                  data-layer-id={object.id}
                  onPointerDown={(event) => startLayerPointerDrag(event, object.id, displayIndex)}
                  className={`layer-row mb-1 flex items-center gap-2 rounded-lg border px-2 py-1.5 ${
                    draggedId === object.id ? 'is-dragging' : ''
                  } ${dropIndex === displayIndex ? 'has-drop-before' : ''} ${dropIndex === layers.length && displayIndex === layers.length - 1 ? 'has-drop-after' : ''} ${
                    selectedIds.includes(object.id) ? 'border-action bg-blue-950/40' : 'border-transparent bg-[#11151c] hover:border-border'
                  }`}
                >
                  <GripVertical className="layer-drag-grip" size={13} aria-hidden="true" />
                  <button
                    data-layer-control="true"
                    className={`toolbar-button h-7 w-7 shrink-0 ${object.visible ? 'is-active' : 'is-muted'}`}
                    onClick={() => {
                      pushHistory({ camera, objects, guides })
                      updateObject(object.id, { visible: !object.visible })
                      markDirty()
                    }}
                    title="Visibilidade"
                  >
                    {object.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <button
                    data-layer-control="true"
                    className={`toolbar-button h-7 w-7 shrink-0 ${object.locked ? 'is-active' : 'is-muted'}`}
                    onClick={() => {
                      pushHistory({ camera, objects, guides })
                      updateObject(object.id, { locked: !object.locked })
                      markDirty()
                    }}
                    title="Bloquear"
                  >
                    {object.locked ? <Lock size={14} /> : <Unlock size={14} />}
                  </button>
                  <LayerPreview object={object} />
                  <button
                    className="min-w-0 flex-1 text-left"
                    title="Clique para selecionar. Ctrl alterna itens; Shift seleciona um intervalo."
                    onClick={(event) => {
                      if (suppressClickRef.current === object.id) {
                        event.preventDefault()
                        suppressClickRef.current = null
                        return
                      }
                      if (event.shiftKey && selectionAnchorRef.current) {
                        const anchorIndex = layers.findIndex((layer) => layer.id === selectionAnchorRef.current)
                        const currentIndex = layers.findIndex((layer) => layer.id === object.id)
                        if (anchorIndex >= 0 && currentIndex >= 0) {
                          const [start, end] = anchorIndex < currentIndex ? [anchorIndex, currentIndex] : [currentIndex, anchorIndex]
                          const rangeIds = layers.slice(start, end + 1).map((layer) => layer.id)
                          setSelectedIds(event.ctrlKey || event.metaKey ? Array.from(new Set([...selectedIds, ...rangeIds])) : rangeIds)
                        }
                      } else if (event.ctrlKey || event.metaKey) {
                        setSelectedIds(selectedIds.includes(object.id) ? selectedIds.filter((id) => id !== object.id) : [...selectedIds, object.id])
                        selectionAnchorRef.current = object.id
                      } else {
                        setSelectedIds([object.id])
                        selectionAnchorRef.current = object.id
                      }
                    }}
                  >
                    <span className="block truncate text-xs font-medium text-white" title={layerTitle(object)}>
                      {layerTitle(object)}
                    </span>
                    <span className="block text-[10px] uppercase tracking-[0.12em] text-muted">{object.type}</span>
                  </button>
                </div>
              ))
            )}
          </div>
          {draggedId ? <div className="layers-drag-hint">Use a roda do mouse para rolar enquanto arrasta</div> : null}
          {!docked ? <div
            className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize border-t border-border/60 bg-panel/80"
            onPointerDown={startResize}
            onPointerMove={resize}
            onPointerUp={stopResize}
          /> : null}
        </section>
      )}
    </div>
  )
}

export default LayersPanel
