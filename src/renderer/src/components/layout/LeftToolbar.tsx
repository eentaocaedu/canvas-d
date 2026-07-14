import { Circle, Crop, Diamond, Frame, Hand, Hexagon, Image, MousePointer2, MoveRight, PenLine, PenTool, RectangleHorizontal, StickyNote, Type } from 'lucide-react'
import type { CanvasTool } from '@renderer/types/canvas'
import { useCanvasStore } from '@renderer/store/useCanvasStore'

const tools: Array<{ id: CanvasTool; label: string; icon: JSX.Element }> = [
  { id: 'select', label: 'Selecionar (V)', icon: <MousePointer2 size={18} /> },
  { id: 'pan', label: 'Mover canvas (H)', icon: <Hand size={18} /> },
  { id: 'frame', label: 'Frame (F)', icon: <Frame size={18} /> },
  { id: 'rect', label: 'Retangulo (R)', icon: <RectangleHorizontal size={18} /> },
  { id: 'ellipse', label: 'Elipse (O)', icon: <Circle size={18} /> },
  { id: 'diamond', label: 'Losango (D)', icon: <Diamond size={18} /> },
  { id: 'polygon', label: 'Poligono (U)', icon: <Hexagon size={18} /> },
  { id: 'note', label: 'Nota (N)', icon: <StickyNote size={18} /> },
  { id: 'line', label: 'Linha (L)', icon: <PenLine size={18} /> },
  { id: 'arrow', label: 'Seta (A)', icon: <MoveRight size={18} /> },
  { id: 'vector', label: 'Caminho vetorial (B)', icon: <PenTool size={18} /> },
  { id: 'text', label: 'Texto (T)', icon: <Type size={18} /> },
  { id: 'freehand', label: 'Desenho livre (P)', icon: <PenLine size={18} /> },
  { id: 'image', label: 'Imagem (I)', icon: <Image size={18} /> },
  { id: 'crop', label: 'Recortar imagem (C)', icon: <Crop size={18} /> }
]

const LeftToolbar = (): JSX.Element => {
  const activeTool = useCanvasStore((state) => state.tool)
  const setTool = useCanvasStore((state) => state.setTool)

  return (
    <aside className="flex min-h-0 flex-col items-center gap-1 overflow-y-auto border-r border-border bg-panel py-2">
      {tools.map((tool) => (
        <button
          key={tool.id}
          className={`toolbar-button h-10 w-10 ${activeTool === tool.id ? 'is-active' : ''}`}
          onClick={() => setTool(tool.id)}
          title={tool.label}
        >
          {tool.icon}
        </button>
      ))}
    </aside>
  )
}

export default LeftToolbar
