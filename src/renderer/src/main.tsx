import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles/globals.css'

const rootElement = document.getElementById('root') as HTMLElement
const root = ReactDOM.createRoot(rootElement)

const showBootFailure = (error: unknown): void => {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  console.error('Canvas D renderer boot failed', error)
  root.render(
    <main className="flex min-h-screen items-center justify-center bg-surface px-6 text-slate-100">
      <section className="w-full max-w-xl rounded-2xl border border-red-900/70 bg-panel p-8 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-400">Falha ao iniciar</p>
        <h1 className="mt-3 text-2xl font-semibold text-white">O Canvas D nao conseguiu carregar a interface.</h1>
        <p className="mt-3 text-sm leading-6 text-muted">Feche o aplicativo e abra novamente. Se o problema continuar, envie a mensagem abaixo.</p>
        <pre className="mt-5 overflow-auto rounded-xl border border-border bg-surface p-4 text-xs text-red-200">{message}</pre>
      </section>
    </main>
  )
}

void import('./App')
  .then(({ default: App }) => {
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    )
  })
  .catch(showBootFailure)
