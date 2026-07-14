import { FolderOpen, Plus } from 'lucide-react'
import { useProjectCommands } from '@renderer/hooks/useProjectCommands'
import { useWorkspaceStore } from '@renderer/store/useWorkspaceStore'

const WorkspaceHome = (): JSX.Element => {
  const recentProjects = useWorkspaceStore((state) => state.recentProjects)
  const { newProject, loadProject } = useProjectCommands()

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-6 text-slate-100">
      <section className="w-full max-w-3xl">
        <div className="mb-10">
          <p className="mb-2 text-sm uppercase tracking-[0.24em] text-muted">Local desktop canvas</p>
          <h1 className="text-5xl font-semibold tracking-normal text-white">Canvas D</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-muted">Canvas local para wireframes, mapas e ideias visuais.</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button className="inline-flex items-center gap-2 rounded-lg bg-action px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500" onClick={newProject}>
            <Plus size={18} />
            Novo projeto
          </button>
          <button className="inline-flex items-center gap-2 rounded-lg border border-border bg-panel px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800" onClick={() => void loadProject()}>
            <FolderOpen size={18} />
            Abrir projeto
          </button>
        </div>

        <div className="mt-12">
          <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-muted">Recentes</h2>
          <div className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border bg-panel">
            {recentProjects.length === 0 ? (
              <div className="px-4 py-6 text-sm text-muted">Nenhum projeto recente.</div>
            ) : (
              recentProjects.map((project) => (
                <button key={project.path} className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-800" onClick={() => void loadProject(project.path)}>
                  <span>
                    <span className="block text-sm font-medium text-white">{project.name}</span>
                    <span className="block truncate text-xs text-muted">{project.path}</span>
                  </span>
                  <span className="text-xs text-muted">{new Date(project.updatedAt).toLocaleDateString()}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </section>
    </main>
  )
}

export default WorkspaceHome
