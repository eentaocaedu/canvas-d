import { useEffect, useMemo, useRef, useState } from 'react'
import { screenToWorld } from '@renderer/lib/coordinates'
import { useCanvasStore } from '@renderer/store/useCanvasStore'
import { useWorkspaceStore } from '@renderer/store/useWorkspaceStore'
import type { Camera, CanvasGuide } from '@renderer/types/canvas'

interface RulersOverlayProps {
  width: number
  height: number
  camera: Camera
}

const RULER_SIZE = 24

const RulersOverlay = ({ width, height, camera }: RulersOverlayProps): JSX.Element | null => {
  const rootRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState<CanvasGuide['orientation'] | null>(null)
  const [preview, setPreview] = useState<{ x: number; y: number } | null>(null)
  const rulersVisible = useCanvasStore((state) => state.rulersVisible)
  const addGuide = useCanvasStore((state) => state.addGuide)
  const markDirty = useWorkspaceStore((state) => state.markDirty)

  const horizontalTicks = useMemo(() => {
    const ticks: Array<{ x: number; label: number; major: boolean }> = []
    const worldStart = screenToWorld({ x: RULER_SIZE, y: 0 }, camera).x
    const worldEnd = screenToWorld({ x: width, y: 0 }, camera).x
    const step = camera.zoom < 0.35 ? 500 : camera.zoom < 0.75 ? 200 : 100
    const start = Math.floor(worldStart / step) * step
    for (let value = start; value <= worldEnd + step; value += step) {
      ticks.push({ x: value * camera.zoom + camera.x, label: value, major: value % (step * 2) === 0 })
    }
    return ticks
  }, [camera, width])

  const verticalTicks = useMemo(() => {
    const ticks: Array<{ y: number; label: number; major: boolean }> = []
    const worldStart = screenToWorld({ x: 0, y: RULER_SIZE }, camera).y
    const worldEnd = screenToWorld({ x: 0, y: height }, camera).y
    const step = camera.zoom < 0.35 ? 500 : camera.zoom < 0.75 ? 200 : 100
    const start = Math.floor(worldStart / step) * step
    for (let value = start; value <= worldEnd + step; value += step) {
      ticks.push({ y: value * camera.zoom + camera.y, label: value, major: value % (step * 2) === 0 })
    }
    return ticks
  }, [camera, height])

  useEffect(() => {
    if (!dragging) return

    const onPointerMove = (event: PointerEvent): void => {
      const bounds = rootRef.current?.getBoundingClientRect()
      if (!bounds) return
      setPreview({
        x: Math.max(0, Math.min(width, event.clientX - bounds.left)),
        y: Math.max(0, Math.min(height, event.clientY - bounds.top))
      })
    }

    const onPointerUp = (event: PointerEvent): void => {
      const bounds = rootRef.current?.getBoundingClientRect()
      if (!bounds) return
      const x = event.clientX - bounds.left
      const y = event.clientY - bounds.top
      if (dragging === 'horizontal' && y > RULER_SIZE) {
        addGuide({ orientation: 'horizontal', position: screenToWorld({ x: 0, y }, camera).y, locked: false, visible: true })
        markDirty()
      }
      if (dragging === 'vertical' && x > RULER_SIZE) {
        addGuide({ orientation: 'vertical', position: screenToWorld({ x, y: 0 }, camera).x, locked: false, visible: true })
        markDirty()
      }
      setDragging(null)
      setPreview(null)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [addGuide, camera, dragging, height, markDirty, width])

  if (!rulersVisible) return null

  return (
    <div ref={rootRef} className="pointer-events-none absolute inset-0 z-20 text-[10px] text-muted">
      <div className="pointer-events-auto absolute left-0 top-0 h-6 w-6 border-b border-r border-border bg-panel" />
      <div
        className="pointer-events-auto absolute left-6 right-0 top-0 h-6 cursor-row-resize border-b border-border bg-panel/95"
        onPointerDown={(event) => {
          setDragging('horizontal')
          setPreview({ x: event.clientX, y: RULER_SIZE })
        }}
      >
        {horizontalTicks.map((tick) => (
          <div key={tick.label} className="absolute top-0 h-full" style={{ left: tick.x - RULER_SIZE }}>
            <div className={`absolute bottom-0 w-px bg-border ${tick.major ? 'h-4' : 'h-2'}`} />
            {tick.major ? <span className="absolute left-1 top-1">{tick.label}</span> : null}
          </div>
        ))}
      </div>
      <div
        className="pointer-events-auto absolute bottom-0 left-0 top-6 w-6 cursor-col-resize border-r border-border bg-panel/95"
        onPointerDown={(event) => {
          setDragging('vertical')
          setPreview({ x: RULER_SIZE, y: event.clientY })
        }}
      >
        {verticalTicks.map((tick) => (
          <div key={tick.label} className="absolute left-0 w-full" style={{ top: tick.y - RULER_SIZE }}>
            <div className={`absolute right-0 h-px bg-border ${tick.major ? 'w-4' : 'w-2'}`} />
            {tick.major ? (
              <span className="absolute left-1 top-1 origin-top-left rotate-90 whitespace-nowrap">{tick.label}</span>
            ) : null}
          </div>
        ))}
      </div>
      {dragging && preview ? (
        <>
          <div
            className="pointer-events-none absolute bg-sky-400/60"
            style={
              dragging === 'horizontal'
                ? { left: RULER_SIZE, right: 0, top: preview.y, height: 1 }
                : { top: RULER_SIZE, bottom: 0, left: preview.x, width: 1 }
            }
          />
          <div className="pointer-events-none absolute left-8 top-8 rounded-md border border-border bg-panel px-2 py-1">Solte no canvas para criar guia</div>
        </>
      ) : null}
    </div>
  )
}

export default RulersOverlay
