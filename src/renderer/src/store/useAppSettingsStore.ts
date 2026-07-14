import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export type AppTheme = 'midnight' | 'graphite' | 'oled' | 'light' | 'sand'
export type InterfaceDensity = 'compact' | 'comfortable'
export type GridStyle = 'dots' | 'lines' | 'none'

interface AppSettingsState {
  theme: AppTheme
  density: InterfaceDensity
  gridStyle: GridStyle
  reducedMotion: boolean
  autoCloseFloatingPanels: boolean
  layersDocked: boolean
  settingsOpen: boolean
  setTheme: (theme: AppTheme) => void
  setDensity: (density: InterfaceDensity) => void
  setGridStyle: (gridStyle: GridStyle) => void
  setReducedMotion: (reducedMotion: boolean) => void
  setAutoCloseFloatingPanels: (autoCloseFloatingPanels: boolean) => void
  setLayersDocked: (layersDocked: boolean) => void
  setSettingsOpen: (settingsOpen: boolean) => void
  resetSettings: () => void
}

export const useAppSettingsStore = create<AppSettingsState>()(
  persist(
    (set) => ({
      theme: 'midnight',
      density: 'comfortable',
      gridStyle: 'dots',
      reducedMotion: false,
      autoCloseFloatingPanels: true,
      layersDocked: false,
      settingsOpen: false,
      setTheme: (theme) => set({ theme }),
      setDensity: (density) => set({ density }),
      setGridStyle: (gridStyle) => set({ gridStyle }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
      setAutoCloseFloatingPanels: (autoCloseFloatingPanels) => set({ autoCloseFloatingPanels }),
      setLayersDocked: (layersDocked) => set({ layersDocked }),
      setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
      resetSettings: () => set({ theme: 'midnight', density: 'comfortable', gridStyle: 'dots', reducedMotion: false, autoCloseFloatingPanels: true, layersDocked: false })
    }),
    {
      name: 'canvas-d:app-settings',
      version: 1,
      storage: createJSONStorage(() => window.localStorage),
      partialize: ({ settingsOpen: _settingsOpen, ...settings }) => settings
    }
  )
)
