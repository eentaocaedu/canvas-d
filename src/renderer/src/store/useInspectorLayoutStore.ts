import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export const inspectorCardIds = [
  'transform',
  'identity',
  'appearance',
  'typography',
  'connector',
  'path',
  'vector',
  'freehand',
  'image',
  'document',
  'tool',
  'guide',
  'multiAppearance',
  'alignment',
  'layers',
  'actions',
  'canvasActions',
  'export'
] as const

export type InspectorCardId = (typeof inspectorCardIds)[number]

interface InspectorLayoutState {
  width: number
  panelCollapsed: boolean
  collapsedCards: Partial<Record<InspectorCardId, boolean>>
  cardOrder: InspectorCardId[]
  temporaryCard: InspectorCardId | null
  setWidth: (width: number) => void
  setPanelCollapsed: (collapsed: boolean) => void
  setCardCollapsed: (id: InspectorCardId, collapsed: boolean) => void
  moveCard: (source: InspectorCardId, target: InspectorCardId) => void
  openTemporaryCard: (id: InspectorCardId | null) => void
  resetLayout: () => void
}

export const defaultInspectorWidth = 336
export const minInspectorWidth = 280
export const maxInspectorWidth = 560

const clampWidth = (width: number): number => Math.round(Math.min(maxInspectorWidth, Math.max(minInspectorWidth, width)))

const normalizeOrder = (order: InspectorCardId[]): InspectorCardId[] => [
  ...order.filter((id, index) => inspectorCardIds.includes(id) && order.indexOf(id) === index),
  ...inspectorCardIds.filter((id) => !order.includes(id))
]

export const useInspectorLayoutStore = create<InspectorLayoutState>()(
  persist(
    (set) => ({
      width: defaultInspectorWidth,
      panelCollapsed: false,
      collapsedCards: {},
      cardOrder: [...inspectorCardIds],
      temporaryCard: null,
      setWidth: (width) => set({ width: clampWidth(width) }),
      setPanelCollapsed: (panelCollapsed) => set({ panelCollapsed }),
      setCardCollapsed: (id, collapsed) => set((state) => ({ collapsedCards: { ...state.collapsedCards, [id]: collapsed } })),
      moveCard: (source, target) => set((state) => {
        if (source === target) return state
        const order = normalizeOrder(state.cardOrder).filter((id) => id !== source)
        const targetIndex = order.indexOf(target)
        order.splice(targetIndex < 0 ? order.length : targetIndex, 0, source)
        return { cardOrder: order }
      }),
      openTemporaryCard: (temporaryCard) => set({ temporaryCard }),
      resetLayout: () => set({ width: defaultInspectorWidth, panelCollapsed: false, collapsedCards: {}, cardOrder: [...inspectorCardIds], temporaryCard: null })
    }),
    {
      name: 'canvas-d:inspector-layout',
      version: 1,
      storage: createJSONStorage(() => window.localStorage),
      partialize: (state) => ({ width: state.width, panelCollapsed: state.panelCollapsed, collapsedCards: state.collapsedCards, cardOrder: state.cardOrder }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<InspectorLayoutState>
        return {
          ...current,
          ...saved,
          width: clampWidth(saved.width ?? current.width),
          collapsedCards: saved.collapsedCards ?? {},
          cardOrder: normalizeOrder(saved.cardOrder ?? current.cardOrder)
        }
      }
    }
  )
)
