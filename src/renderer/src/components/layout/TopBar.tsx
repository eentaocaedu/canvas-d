import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Braces, ChevronDown, FileCode2, FileImage, FilePlus2, FolderOpen, Image as ImageIcon, Save, SaveAll, Settings } from 'lucide-react'
import { useProjectCommands } from '@renderer/hooks/useProjectCommands'
import { useWorkspaceStore } from '@renderer/store/useWorkspaceStore'
import appIcon from '@renderer/assets/app-icon.svg'
import { useAppSettingsStore } from '@renderer/store/useAppSettingsStore'

const saveStateLabel = { idle: 'Pronto', dirty: 'Alterado', saving: 'Salvando', saved: 'Salvo', error: 'Erro' } as const

interface MenuItemProps {
  icon: ReactNode
  label: string
  detail?: string
  shortcut?: string
  onClick: () => void
}

const MenuItem = ({ icon, label, detail, shortcut, onClick }: MenuItemProps): JSX.Element => (
  <button className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-slate-800" onClick={onClick}>
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-slate-200">{icon}</span>
    <span className="min-w-0 flex-1">
      <span className="block text-xs font-medium text-white">{label}</span>
      {detail ? <span className="block truncate text-[10px] text-muted">{detail}</span> : null}
    </span>
    {shortcut ? <kbd className="rounded border border-border bg-[#11151c] px-1.5 py-0.5 text-[9px] text-muted">{shortcut}</kbd> : null}
  </button>
)

const TopBar = (): JSX.Element => {
  const project = useWorkspaceStore((state) => state.project)
  const projectPath = useWorkspaceStore((state) => state.projectPath)
  const saveState = useWorkspaceStore((state) => state.saveState)
  const { camera, newProject, loadProject, saveProject, saveProjectAs, exportSelectedFrame, exportSelectedSvg, exportSelectedVector } = useProjectCommands()
  const setSettingsOpen = useAppSettingsStore((state) => state.setSettingsOpen)
  const [openMenu, setOpenMenu] = useState<'file' | 'export' | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const extension = projectPath?.match(/\.([^.\\/]+)$/)?.[1]?.toUpperCase() ?? 'PCANVAS'

  useEffect(() => {
    const close = (event: PointerEvent): void => {
      if (!menuRef.current?.contains(event.target as Node)) setOpenMenu(null)
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [])

  const run = (action: () => void): void => {
    setOpenMenu(null)
    action()
  }

  return (
    <header className="relative z-50 flex items-center justify-between border-b border-border bg-panel px-3" ref={menuRef}>
      <div className="flex min-w-0 items-center gap-3">
        <img src={appIcon} alt="" className="h-8 w-8 rounded-lg border border-border bg-surface p-0.5" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="max-w-64 truncate text-sm font-semibold text-white">{project?.name ?? 'Canvas D'}</span>
            <span className="rounded-md border border-border bg-surface px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-slate-300">{extension}</span>
          </div>
          <div className="max-w-[460px] truncate text-[10px] text-muted" title={projectPath ?? 'Documento ainda nao salvo'}>
            {projectPath ?? 'Documento ainda nao salvo'}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative">
          <button className={`compact-button h-8 px-3 ${openMenu === 'file' ? 'is-active' : ''}`} onClick={() => setOpenMenu(openMenu === 'file' ? null : 'file')}>
            Arquivo <ChevronDown size={13} />
          </button>
          {openMenu === 'file' ? (
            <div className="absolute right-0 top-10 w-80 rounded-xl border border-border bg-panel p-2 shadow-2xl">
              <div className="px-2 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Documento</div>
              <MenuItem icon={<FilePlus2 size={15} />} label="Novo projeto" detail="Cria um canvas editavel vazio" shortcut="Ctrl N" onClick={() => run(newProject)} />
              <MenuItem icon={<FolderOpen size={15} />} label="Abrir arquivo" detail="PCanvas, SVG, EPS, WebP, PNG ou JPEG" shortcut="Ctrl O" onClick={() => run(() => void loadProject())} />
              <div className="my-1 border-t border-border" />
              <MenuItem icon={<Save size={15} />} label="Salvar" detail="Atualiza o documento aberto" shortcut="Ctrl S" onClick={() => run(() => void saveProject())} />
              <MenuItem icon={<SaveAll size={15} />} label="Salvar como..." detail="PCanvas, SVG, EPS, WebP, PNG ou JPEG" shortcut="Ctrl Shift S" onClick={() => run(() => void saveProjectAs())} />
              <div className="my-1 border-t border-border" />
              <MenuItem icon={<Settings size={15} />} label="Configuracoes" detail="Tema, interface, canvas e paineis" shortcut="Ctrl ," onClick={() => run(() => setSettingsOpen(true))} />
            </div>
          ) : null}
        </div>

        <div className="relative">
          <button className={`compact-button h-8 px-3 ${openMenu === 'export' ? 'is-active' : ''}`} onClick={() => setOpenMenu(openMenu === 'export' ? null : 'export')}>
            Exportar <ChevronDown size={13} />
          </button>
          {openMenu === 'export' ? (
            <div className="absolute right-0 top-10 w-80 rounded-xl border border-border bg-panel p-2 shadow-2xl">
              <div className="px-2 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Vetor</div>
              <MenuItem icon={<FileCode2 size={15} />} label="SVG editavel" detail="Preserva shapes, paths, grupos e texto" shortcut="Ctrl Shift E" onClick={() => run(() => void exportSelectedSvg())} />
              <MenuItem icon={<Braces size={15} />} label="EPS vetorial" detail="PostScript escalavel para intercambio" onClick={() => run(() => void exportSelectedVector('eps'))} />
              <div className="my-1 border-t border-border" />
              <div className="px-2 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Imagem</div>
              <MenuItem icon={<ImageIcon size={15} />} label="PNG" detail="Tamanho exato da prancheta e DPI do projeto" onClick={() => run(() => void exportSelectedFrame(1, 'png'))} />
              <MenuItem icon={<FileImage size={15} />} label="JPEG" detail="Tamanho exato, fundo branco e qualidade 92%" onClick={() => run(() => void exportSelectedFrame(1, 'jpeg'))} />
              <MenuItem icon={<FileImage size={15} />} label="WebP" detail="Tamanho exato, DPI e arquivo compacto" onClick={() => run(() => void exportSelectedFrame(1, 'webp'))} />
            </div>
          ) : null}
        </div>

        <button className="inline-flex h-8 items-center gap-2 rounded-lg bg-action px-3 text-xs font-medium text-white hover:bg-blue-500" onClick={() => void saveProject()} title="Salvar (Ctrl+S)">
          <Save size={14} />
          Salvar
        </button>
        <div className="ml-1 rounded-lg border border-border bg-surface px-2 py-1 text-[10px] text-muted">{Math.round(camera.zoom * 100)}%</div>
        <div className={`rounded-lg border px-2 py-1 text-[10px] ${saveState === 'dirty' ? 'border-amber-600/60 bg-amber-950/30 text-amber-300' : saveState === 'error' ? 'border-red-600/60 bg-red-950/30 text-red-300' : 'border-border bg-surface text-muted'}`}>
          {saveStateLabel[saveState]}
        </div>
      </div>
    </header>
  )
}

export default TopBar
