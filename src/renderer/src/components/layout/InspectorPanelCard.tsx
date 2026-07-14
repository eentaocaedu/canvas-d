import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight, GripVertical } from 'lucide-react'
import { useInspectorLayoutStore, type InspectorCardId } from '@renderer/store/useInspectorLayoutStore'

interface InspectorPanelCardProps {
  id: InspectorCardId
  title: string
  icon: ReactNode
  accessory?: ReactNode
  className?: string
  children: ReactNode
}

const dragMime = 'application/x-canvas-d-inspector-card'

const InspectorPanelCard = ({ id, title, icon, accessory, className = '', children }: InspectorPanelCardProps): JSX.Element => {
  const collapsed = useInspectorLayoutStore((state) => Boolean(state.collapsedCards[id]))
  const order = useInspectorLayoutStore((state) => state.cardOrder.indexOf(id))
  const temporaryCard = useInspectorLayoutStore((state) => state.temporaryCard)
  const setCardCollapsed = useInspectorLayoutStore((state) => state.setCardCollapsed)
  const moveCard = useInspectorLayoutStore((state) => state.moveCard)
  const [dragging, setDragging] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  return (
    <section
      data-inspector-card={id}
      className={`inspector-card inspector-sortable-card ${temporaryCard === id ? 'is-temporary-target' : ''} ${collapsed ? 'is-collapsed' : ''} ${dragging ? 'is-dragging' : ''} ${dragOver ? 'is-drag-over' : ''} ${className}`}
      style={{ order: order < 0 ? 999 : order }}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes(dragMime)) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        event.preventDefault()
        const source = event.dataTransfer.getData(dragMime) as InspectorCardId
        setDragOver(false)
        if (source) moveCard(source, id)
      }}
    >
      <div
        className="inspector-card-header"
        draggable
        title="Arraste para reordenar"
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData(dragMime, id)
          setDragging(true)
        }}
        onDragEnd={() => {
          setDragging(false)
          setDragOver(false)
        }}
      >
        <GripVertical className="inspector-card-grip" size={14} />
        <span className="inspector-card-icon">{icon}</span>
        <h3>{title}</h3>
        {accessory ? <span className="inspector-card-accessory">{accessory}</span> : null}
        <button
          type="button"
          className="inspector-card-toggle"
          aria-label={`${collapsed ? 'Expandir' : 'Recolher'} ${title}`}
          title={`${collapsed ? 'Expandir' : 'Recolher'} ${title}`}
          onClick={() => setCardCollapsed(id, !collapsed)}
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
        </button>
      </div>
      {!collapsed ? <div className="inspector-card-content">{children}</div> : null}
    </section>
  )
}

export default InspectorPanelCard
