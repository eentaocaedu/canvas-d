import { useEffect, useMemo, useState } from 'react'

let fontPromise: Promise<string[]> | null = null

const loadFonts = (): Promise<string[]> => {
  fontPromise ??= window.canvasD.listFonts()
  return fontPromise
}

interface FontPickerProps {
  value: string
  onChange: (fontFamily: string) => void
}

const FontPicker = ({ value, onChange }: FontPickerProps): JSX.Element => {
  const [fonts, setFonts] = useState<string[]>([])
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    void loadFonts()
      .then((availableFonts) => {
        if (!active) return
        setFonts(availableFonts)
        setFailed(false)
        for (const font of availableFonts) void document.fonts.load(`12px "${font.replace(/"/g, '\\"')}"`)
      })
      .catch(() => {
        if (active) setFailed(true)
      })
    return () => {
      active = false
    }
  }, [])

  const options = useMemo(() => Array.from(new Set([value, ...fonts].filter(Boolean))), [fonts, value])

  return (
    <label className="inspector-field">
      <span>Fonte</span>
      <span className="min-w-0">
        <select
          className="inspector-input w-full"
          value={value}
          disabled={options.length === 0}
          title={failed ? 'Nao foi possivel consultar as fontes do Windows' : `${fonts.length || 'Carregando'} fontes instaladas no Windows`}
          style={{ fontFamily: value }}
          onChange={(event) => onChange(event.target.value)}
        >
          {fonts.length === 0 && !value ? <option value="">Carregando fontes...</option> : null}
          {options.map((font) => (
            <option key={font} value={font} style={{ fontFamily: font }}>
              {font}
            </option>
          ))}
        </select>
        <span className="mt-1 block truncate text-[10px] text-muted">
          {failed ? 'Falha ao ler fontes do sistema' : fonts.length > 0 ? `${fonts.length} fontes instaladas` : 'Lendo fontes do sistema...'}
        </span>
      </span>
    </label>
  )
}

export default FontPicker
