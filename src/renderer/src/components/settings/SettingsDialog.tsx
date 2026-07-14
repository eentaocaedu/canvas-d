import { useEffect } from 'react'
import { Grid3X3, Layers3, Palette, RotateCcw, SlidersHorizontal, X } from 'lucide-react'
import { useAppSettingsStore, type AppTheme } from '@renderer/store/useAppSettingsStore'
import { useInspectorLayoutStore } from '@renderer/store/useInspectorLayoutStore'

const themeOptions: Array<{ id: AppTheme; name: string; description: string; colors: string[] }> = [
  { id: 'midnight', name: 'Midnight azul', description: 'O visual atual, escuro e azulado.', colors: ['#0f1115', '#171a21', '#2563eb'] },
  { id: 'graphite', name: 'Grafite', description: 'Cinzas neutros com destaque violeta.', colors: ['#111111', '#1c1c1f', '#7c3aed'] },
  { id: 'oled', name: 'OLED preto', description: 'Preto absoluto e contraste elevado.', colors: ['#000000', '#090909', '#22c55e'] },
  { id: 'light', name: 'Light frio', description: 'Interface clara, limpa e azul.', colors: ['#eef2f7', '#ffffff', '#2563eb'] },
  { id: 'sand', name: 'Light areia', description: 'Claro quente com destaque terracota.', colors: ['#f2eee6', '#fffaf2', '#c2410c'] }
]

const SettingsDialog = (): JSX.Element | null => {
  const open = useAppSettingsStore((state) => state.settingsOpen)
  const theme = useAppSettingsStore((state) => state.theme)
  const density = useAppSettingsStore((state) => state.density)
  const gridStyle = useAppSettingsStore((state) => state.gridStyle)
  const reducedMotion = useAppSettingsStore((state) => state.reducedMotion)
  const autoClose = useAppSettingsStore((state) => state.autoCloseFloatingPanels)
  const layersDocked = useAppSettingsStore((state) => state.layersDocked)
  const setOpen = useAppSettingsStore((state) => state.setSettingsOpen)
  const setTheme = useAppSettingsStore((state) => state.setTheme)
  const setDensity = useAppSettingsStore((state) => state.setDensity)
  const setGridStyle = useAppSettingsStore((state) => state.setGridStyle)
  const setReducedMotion = useAppSettingsStore((state) => state.setReducedMotion)
  const setAutoClose = useAppSettingsStore((state) => state.setAutoCloseFloatingPanels)
  const setLayersDocked = useAppSettingsStore((state) => state.setLayersDocked)
  const resetSettings = useAppSettingsStore((state) => state.resetSettings)
  const resetInspectorLayout = useInspectorLayoutStore((state) => state.resetLayout)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, setOpen])

  if (!open) return null

  return (
    <div className="settings-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) setOpen(false)
    }}>
      <section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header className="settings-header">
          <div>
            <span className="inspector-eyebrow">Canvas D</span>
            <h2 id="settings-title">Configuracoes</h2>
          </div>
          <button type="button" className="toolbar-button h-8 w-8" title="Fechar configuracoes" onClick={() => setOpen(false)}><X size={17} /></button>
        </header>

        <div className="settings-scroll">
          <section className="settings-section">
            <div className="settings-section-title"><Palette size={17} /><div><h3>Tema</h3><p>Aparencia geral salva para todos os projetos.</p></div></div>
            <div className="settings-theme-grid">
              {themeOptions.map((option) => (
                <button key={option.id} type="button" className={`settings-theme-card ${theme === option.id ? 'is-active' : ''}`} onClick={() => setTheme(option.id)}>
                  <span className="settings-theme-swatches">{option.colors.map((color) => <i key={color} style={{ background: color }} />)}</span>
                  <strong>{option.name}</strong>
                  <small>{option.description}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="settings-section settings-two-columns">
            <div>
              <div className="settings-section-title"><SlidersHorizontal size={17} /><div><h3>Interface</h3><p>Espacamento e movimento.</p></div></div>
              <label className="settings-field">
                <span>Densidade</span>
                <select className="inspector-input" value={density} onChange={(event) => setDensity(event.target.value as 'compact' | 'comfortable')}>
                  <option value="comfortable">Confortavel</option>
                  <option value="compact">Compacta</option>
                </select>
              </label>
              <label className="settings-check"><input type="checkbox" checked={reducedMotion} onChange={(event) => setReducedMotion(event.target.checked)} /><span>Reduzir animacoes</span></label>
            </div>
            <div>
              <div className="settings-section-title"><Grid3X3 size={17} /><div><h3>Canvas</h3><p>Visual da grade de trabalho.</p></div></div>
              <label className="settings-field">
                <span>Grade</span>
                <select className="inspector-input" value={gridStyle} onChange={(event) => setGridStyle(event.target.value as 'dots' | 'lines' | 'none')}>
                  <option value="dots">Pontos</option>
                  <option value="lines">Linhas</option>
                  <option value="none">Sem grade</option>
                </select>
              </label>
            </div>
          </section>

          <section className="settings-section">
            <div className="settings-section-title"><Layers3 size={17} /><div><h3>Paineis</h3><p>Comportamento das camadas e propriedades.</p></div></div>
            <label className="settings-check"><input type="checkbox" checked={autoClose} onChange={(event) => setAutoClose(event.target.checked)} /><span>Fechar paineis flutuantes ao clicar fora</span></label>
            <label className="settings-check"><input type="checkbox" checked={layersDocked} onChange={(event) => setLayersDocked(event.target.checked)} /><span>Manter Camadas encaixado em Propriedades</span></label>
            <button type="button" className="compact-button mt-3" onClick={resetInspectorLayout}><RotateCcw size={14} /> Restaurar largura e ordem do painel</button>
          </section>
        </div>

        <footer className="settings-footer">
          <button type="button" className="compact-button" onClick={() => { resetSettings(); resetInspectorLayout() }}><RotateCcw size={14} /> Restaurar tudo</button>
          <button type="button" className="compact-button is-active" onClick={() => setOpen(false)}>Concluido</button>
        </footer>
      </section>
    </div>
  )
}

export default SettingsDialog
