import { FileText, Infinity as InfinityIcon, LayoutTemplate, Maximize2, Monitor, RotateCw, Smartphone, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { convertUnitValue, displayUnitValue, projectPresets, toPixels } from '@renderer/lib/projectSetup'
import { useProjectCommands } from '@renderer/hooks/useProjectCommands'
import { useWorkspaceStore } from '@renderer/store/useWorkspaceStore'
import type { ProjectCanvasMode, ProjectSetup, ProjectUnit } from '@renderer/types/project'
import NumberInput from '@renderer/components/controls/NumberInput'

interface DialogSettings {
  mode: ProjectCanvasMode
  unit: ProjectUnit
  width: number
  height: number
  dpi: number
  background: string
  presetId: string | null
}

const defaultSettings: DialogSettings = {
  mode: 'infinite',
  unit: 'px',
  width: 1920,
  height: 1080,
  dpi: 96,
  background: '#ffffff',
  presetId: 'full-hd'
}

const settingsKey = 'canvas-d:new-project-settings'
const units: Array<{ id: ProjectUnit; label: string }> = [
  { id: 'px', label: 'Pixels' },
  { id: 'cm', label: 'Centimetros' },
  { id: 'mm', label: 'Milimetros' },
  { id: 'm', label: 'Metros' }
]

const readSettings = (): DialogSettings => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(settingsKey) ?? '') as Partial<DialogSettings>
    if ((parsed.mode === 'infinite' || parsed.mode === 'artboard') && units.some((unit) => unit.id === parsed.unit)) {
      return { ...defaultSettings, ...parsed }
    }
  } catch {
    // Start with safe defaults when the persisted choice is unavailable.
  }
  return defaultSettings
}

const NewProjectDialog = (): JSX.Element | null => {
  const open = useWorkspaceStore((state) => state.newProjectDialogOpen)
  const setOpen = useWorkspaceStore((state) => state.setNewProjectDialogOpen)
  const { createConfiguredProject } = useProjectCommands()
  const [name, setName] = useState('Untitled Canvas')
  const [settings, setSettings] = useState<DialogSettings>(defaultSettings)

  useEffect(() => {
    if (!open) return
    setName('Untitled Canvas')
    setSettings(readSettings())
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, setOpen])

  const pixelSize = useMemo(() => ({
    width: Math.max(1, Math.round(toPixels(settings.width, settings.unit, settings.dpi))),
    height: Math.max(1, Math.round(toPixels(settings.height, settings.unit, settings.dpi)))
  }), [settings.dpi, settings.height, settings.unit, settings.width])
  const validSize = Number.isFinite(pixelSize.width) && Number.isFinite(pixelSize.height) && pixelSize.width <= 50_000 && pixelSize.height <= 50_000 && settings.width > 0 && settings.height > 0

  if (!open) return null

  const changeUnit = (unit: ProjectUnit): void => {
    setSettings((current) => ({
      ...current,
      unit,
      width: convertUnitValue(current.width, current.unit, unit, current.dpi),
      height: convertUnitValue(current.height, current.unit, unit, current.dpi),
      presetId: null
    }))
  }

  const choosePreset = (presetId: string): void => {
    const preset = projectPresets.find((candidate) => candidate.id === presetId)
    if (!preset) return
    setSettings((current) => ({ ...current, mode: 'artboard', presetId, unit: preset.unit, width: preset.width, height: preset.height, dpi: preset.dpi }))
  }

  const submit = (): void => {
    if (settings.mode === 'artboard' && !validSize) return
    const setup: ProjectSetup = settings.mode === 'infinite'
      ? { mode: 'infinite', unit: 'px', dpi: 96, background: 'transparent' }
      : {
          mode: 'artboard',
          unit: settings.unit,
          width: displayUnitValue(settings.width, settings.unit),
          height: displayUnitValue(settings.height, settings.unit),
          pixelWidth: pixelSize.width,
          pixelHeight: pixelSize.height,
          dpi: Math.max(1, Math.round(settings.dpi)),
          background: settings.background
        }
    window.localStorage.setItem(settingsKey, JSON.stringify(settings))
    createConfiguredProject(name, setup)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm" onMouseDown={(event) => {
      if (event.target === event.currentTarget) setOpen(false)
    }}>
      <section role="dialog" aria-modal="true" aria-label="Configurar novo projeto" className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-panel shadow-2xl">
        <header className="flex items-start justify-between border-b border-border px-6 py-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-action">Novo documento</p>
            <h1 className="mt-1 text-2xl font-semibold text-white">Como voce quer comecar?</h1>
            <p className="mt-1 text-sm text-muted">Use o canvas infinito ou crie uma prancheta pronta para tela, vetor ou impressao.</p>
          </div>
          <button className="toolbar-button h-9 w-9" title="Fechar" onClick={() => setOpen(false)}><X size={18} /></button>
        </header>

        <div className="overflow-y-auto px-6 py-5">
          <label className="block">
            <span className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-muted">Nome do projeto</span>
            <input aria-label="Nome do projeto" autoFocus className="inspector-input w-full max-w-lg" value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => {
              if (event.key === 'Enter' && (settings.mode === 'infinite' || validSize)) submit()
            }} />
          </label>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <button className={`rounded-xl border p-4 text-left transition ${settings.mode === 'infinite' ? 'border-action bg-blue-950/35' : 'border-border bg-surface hover:border-slate-600'}`} onClick={() => setSettings((current) => ({ ...current, mode: 'infinite' }))}>
              <span className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/20 text-blue-300"><InfinityIcon size={22} /></span>
                <span><span className="block text-sm font-semibold text-white">Canvas infinito</span><span className="block text-xs text-muted">Mapas mentais, fluxos e exploracao livre</span></span>
              </span>
            </button>
            <button className={`rounded-xl border p-4 text-left transition ${settings.mode === 'artboard' ? 'border-action bg-blue-950/35' : 'border-border bg-surface hover:border-slate-600'}`} onClick={() => setSettings((current) => ({ ...current, mode: 'artboard' }))}>
              <span className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600/20 text-violet-300"><LayoutTemplate size={21} /></span>
                <span><span className="block text-sm font-semibold text-white">Prancheta com tamanho</span><span className="block text-xs text-muted">Layouts, vetores, imagens e impressao</span></span>
              </span>
            </button>
          </div>

          {settings.mode === 'artboard' ? (
            <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <div>
                <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-muted"><Maximize2 size={14} /> Tamanhos rapidos</div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {projectPresets.map((preset) => {
                    const Icon = preset.id === 'mobile' ? Smartphone : preset.unit === 'px' ? Monitor : FileText
                    return (
                      <button key={preset.id} className={`rounded-xl border p-3 text-left ${settings.presetId === preset.id ? 'border-action bg-blue-950/30' : 'border-border bg-surface hover:border-slate-600'}`} onClick={() => choosePreset(preset.id)}>
                        <Icon size={16} className="mb-2 text-slate-300" />
                        <span className="block text-xs font-semibold text-white">{preset.label}</span>
                        <span className="block text-[10px] text-muted">{preset.width} x {preset.height} {preset.unit}</span>
                      </button>
                    )
                  })}
                </div>

                <div className="mt-5 rounded-xl border border-border bg-surface/60 p-4">
                  <div className="grid grid-cols-4 gap-2">
                    {units.map((unit) => <button key={unit.id} className={`compact-button ${settings.unit === unit.id ? 'is-active' : ''}`} onClick={() => changeUnit(unit.id)}>{unit.label}</button>)}
                  </div>
                  <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-end gap-3">
                    <label className="text-xs text-muted">Largura<NumberInput ariaLabel="Largura" className="inspector-input mt-1 w-full" value={settings.width} min={0.001} step={settings.unit === 'px' ? 1 : settings.unit === 'm' ? 0.001 : 0.1} live onCommit={(width) => setSettings((current) => ({ ...current, width, presetId: null }))} /></label>
                    <button className="toolbar-button mb-0.5 h-9 w-9" title="Trocar orientacao" onClick={() => setSettings((current) => ({ ...current, width: current.height, height: current.width, presetId: null }))}><RotateCw size={16} /></button>
                    <label className="text-xs text-muted">Altura<NumberInput ariaLabel="Altura" className="inspector-input mt-1 w-full" value={settings.height} min={0.001} step={settings.unit === 'px' ? 1 : settings.unit === 'm' ? 0.001 : 0.1} live onCommit={(height) => setSettings((current) => ({ ...current, height, presetId: null }))} /></label>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-surface/60 p-4">
                  <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Resolucao</div>
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {[72, 96, 150, 300].map((dpi) => <button key={dpi} className={`compact-button ${settings.dpi === dpi ? 'is-active' : ''}`} onClick={() => setSettings((current) => ({ ...current, dpi }))}>{dpi}</button>)}
                  </div>
                  <label className="mt-3 block text-xs text-muted">DPI<NumberInput ariaLabel="DPI" className="inspector-input mt-1 w-full" value={settings.dpi} min={1} max={1200} step={1} live onCommit={(dpi) => setSettings((current) => ({ ...current, dpi }))} /></label>
                  <p className="mt-2 text-[10px] leading-4 text-muted">DPI converte centimetros, milimetros e metros em pixels para exportacao raster.</p>
                </div>

                <div className="rounded-xl border border-border bg-surface/60 p-4">
                  <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Fundo da prancheta</div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {[['transparent', 'Transparente'], ['#ffffff', 'Branco'], ['#0f172a', 'Escuro']].map(([color, label]) => <button key={color} className={`compact-button ${settings.background === color ? 'is-active' : ''}`} onClick={() => setSettings((current) => ({ ...current, background: color }))}>{label}</button>)}
                  </div>
                  <label className="mt-3 flex items-center justify-between text-xs text-muted">Cor personalizada<input aria-label="Cor de fundo" type="color" value={settings.background === 'transparent' ? '#ffffff' : settings.background} onChange={(event) => setSettings((current) => ({ ...current, background: event.target.value }))} /></label>
                </div>

                <div className={`rounded-xl border p-4 ${validSize ? 'border-blue-900/70 bg-blue-950/20' : 'border-red-900/70 bg-red-950/20'}`}>
                  <div className="text-xs text-muted">Tamanho de saida</div>
                  <div className="mt-1 text-xl font-semibold text-white">{pixelSize.width.toLocaleString('pt-BR')} x {pixelSize.height.toLocaleString('pt-BR')} px</div>
                  <div className="mt-1 text-[10px] text-muted">{settings.width} x {settings.height} {settings.unit} · {settings.dpi} DPI</div>
                  {!validSize ? <p className="mt-2 text-xs text-red-300">Cada lado deve resultar entre 1 e 50.000 pixels.</p> : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-xl border border-border bg-surface/60 p-5">
              <div className="flex items-center gap-3"><InfinityIcon className="text-blue-300" /><div><div className="text-sm font-medium text-white">Espaco sem limites</div><div className="text-xs text-muted">Nenhuma prancheta inicial. Voce pode adicionar frames de qualquer tamanho depois.</div></div></div>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-border bg-surface/40 px-6 py-4">
          <span className="text-xs text-muted">As configuracoes ficam salvas para o proximo projeto.</span>
          <div className="flex gap-2"><button className="compact-button px-4" onClick={() => setOpen(false)}>Cancelar</button><button className="inline-flex h-9 items-center gap-2 rounded-lg bg-action px-5 text-xs font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50" disabled={settings.mode === 'artboard' && !validSize} onClick={submit}>{settings.mode === 'infinite' ? <InfinityIcon size={16} /> : <LayoutTemplate size={16} />}{settings.mode === 'infinite' ? 'Criar canvas infinito' : 'Criar prancheta'}</button></div>
        </footer>
      </section>
    </div>
  )
}

export default NewProjectDialog
