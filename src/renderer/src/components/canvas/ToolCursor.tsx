import { Circle, Crop, Diamond, Frame, Hand, Hexagon, Image, MousePointer2, MoveDiagonal, MoveDiagonal2, MoveHorizontal, MoveRight, MoveVertical, PenLine, PenTool, RectangleHorizontal, StickyNote, Type } from 'lucide-react'
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useCanvasStore } from '@renderer/store/useCanvasStore'
import type { CanvasCursorHint, CanvasTool } from '@renderer/types/canvas'

interface ToolCursorProps {
  containerRef: RefObject<HTMLElement | null>
  spacePressed: boolean
}

const toolIcons: Record<CanvasTool, JSX.Element> = {
  select: <MousePointer2 size={14} />,
  pan: <Hand size={14} />,
  frame: <Frame size={14} />,
  rect: <RectangleHorizontal size={14} />,
  ellipse: <Circle size={14} />,
  diamond: <Diamond size={14} />,
  polygon: <Hexagon size={14} />,
  note: <StickyNote size={14} />,
  line: <PenLine size={14} />,
  arrow: <MoveRight size={14} />,
  vector: <PenTool size={14} />,
  text: <Type size={14} />,
  freehand: <PenLine size={14} />,
  image: <Image size={14} />,
  crop: <Crop size={14} />
}

const resizeIcons: Record<NonNullable<CanvasCursorHint>, JSX.Element> = {
  'resize-ew': <MoveHorizontal size={22} />,
  'resize-ns': <MoveVertical size={22} />,
  'resize-nesw': <MoveDiagonal size={22} />,
  'resize-nwse': <MoveDiagonal2 size={22} />
}

const ToolCursor = ({ containerRef, spacePressed }: ToolCursorProps): JSX.Element | null => {
  const tool = useCanvasStore((state) => state.tool)
  const cursorHint = useCanvasStore((state) => state.cursorHint)
  const cursorRef = useRef<HTMLDivElement>(null)
  const crosshairRef = useRef<HTMLSpanElement>(null)
  const activeTool = spacePressed ? 'pan' : tool

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const onMouseMove = (event: MouseEvent): void => {
      const target = event.target as HTMLElement | null
      const insideStage = Boolean(target?.closest('.konvajs-content'))
      if (!insideStage) {
        if (cursorRef.current) cursorRef.current.style.display = 'none'
        return
      }

      const bounds = element.getBoundingClientRect()
      if (cursorRef.current) {
        cursorRef.current.style.display = 'block'
        cursorRef.current.style.transform = `translate3d(${event.clientX - bounds.left}px, ${event.clientY - bounds.top}px, 0)`
      }
      crosshairRef.current?.classList.toggle('is-precise', event.getModifierState('CapsLock'))
    }

    const onMouseLeave = (): void => {
      if (cursorRef.current) cursorRef.current.style.display = 'none'
    }
    const onKey = (event: KeyboardEvent): void => crosshairRef.current?.classList.toggle('is-precise', event.getModifierState('CapsLock'))

    element.addEventListener('mousemove', onMouseMove)
    element.addEventListener('mouseleave', onMouseLeave)
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    return () => {
      element.removeEventListener('mousemove', onMouseMove)
      element.removeEventListener('mouseleave', onMouseLeave)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
    }
  }, [containerRef])

  const icon = useMemo(() => toolIcons[activeTool], [activeTool])

  if (cursorHint) {
    return (
      <div ref={cursorRef} className="tool-cursor" style={{ display: 'none' }}>
        <span className="tool-cursor-resize">{resizeIcons[cursorHint]}</span>
      </div>
    )
  }

  return (
    <div ref={cursorRef} className="tool-cursor" style={{ display: 'none' }}>
      <span ref={crosshairRef} className="tool-cursor-crosshair" />
      <span className="tool-cursor-icon">{icon}</span>
    </div>
  )
}

export default ToolCursor
