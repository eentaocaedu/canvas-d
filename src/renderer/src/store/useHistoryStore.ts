import { create } from 'zustand'
import type { CanvasSnapshot } from '@renderer/types/canvas'

interface HistoryState {
  past: CanvasSnapshot[]
  future: CanvasSnapshot[]
  coalescedKey: string | null
  coalescedAt: number
  push: (snapshot: CanvasSnapshot) => void
  pushCoalesced: (key: string, snapshot: CanvasSnapshot, windowMs?: number) => void
  undo: (current: CanvasSnapshot) => CanvasSnapshot | null
  redo: (current: CanvasSnapshot) => CanvasSnapshot | null
  clear: () => void
}

const cloneSnapshot = (snapshot: CanvasSnapshot): CanvasSnapshot => structuredClone(snapshot) as CanvasSnapshot
const snapshotContentKey = (snapshot: CanvasSnapshot): string => JSON.stringify({ objects: snapshot.objects, guides: snapshot.guides ?? [] })
const sameContent = (a: CanvasSnapshot, b: CanvasSnapshot): boolean => snapshotContentKey(a) === snapshotContentKey(b)

export const useHistoryStore = create<HistoryState>((set) => ({
  past: [],
  future: [],
  coalescedKey: null,
  coalescedAt: 0,
  push: (snapshot) =>
    set((state) => {
      const previous = state.past.at(-1)
      if (previous && sameContent(previous, snapshot)) {
        return { future: [], coalescedKey: null, coalescedAt: 0 }
      }

      return { past: [...state.past, cloneSnapshot(snapshot)].slice(-50), future: [], coalescedKey: null, coalescedAt: 0 }
    }),
  pushCoalesced: (key, snapshot, windowMs = 1500) => {
    const now = Date.now()
    set((state) => {
      if (state.coalescedKey === key && now - state.coalescedAt <= windowMs) {
        return { coalescedAt: now }
      }
      const previous = state.past.at(-1)
      if (previous && sameContent(previous, snapshot)) {
        return { future: [], coalescedKey: key, coalescedAt: now }
      }

      return {
        past: [...state.past, cloneSnapshot(snapshot)].slice(-50),
        future: [],
        coalescedKey: key,
        coalescedAt: now
      }
    })
  },
  undo: (current) => {
    const state = useHistoryStore.getState()
    let previousIndex = state.past.length - 1
    while (previousIndex >= 0 && sameContent(state.past[previousIndex], current)) {
      previousIndex -= 1
    }
    const previous = state.past[previousIndex]
    if (!previous) {
      if (previousIndex < state.past.length - 1) {
        set({ past: [], coalescedKey: null, coalescedAt: 0 })
      }
      return null
    }
    set({
      past: state.past.slice(0, previousIndex),
      future: [cloneSnapshot(current), ...state.future].slice(0, 50),
      coalescedKey: null,
      coalescedAt: 0
    })
    return cloneSnapshot(previous)
  },
  redo: (current) => {
    const state = useHistoryStore.getState()
    const nextIndex = state.future.findIndex((snapshot) => !sameContent(snapshot, current))
    const next = state.future[nextIndex]
    if (!next) return null
    set({
      past: [...state.past, cloneSnapshot(current)].slice(-50),
      future: state.future.slice(nextIndex + 1),
      coalescedKey: null,
      coalescedAt: 0
    })
    return cloneSnapshot(next)
  },
  clear: () => set({ past: [], future: [], coalescedKey: null, coalescedAt: 0 })
}))
