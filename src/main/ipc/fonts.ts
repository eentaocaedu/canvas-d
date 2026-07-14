import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { ipcMain } from 'electron'

const execFileAsync = promisify(execFile)

const fallbackFonts = [
  'Arial',
  'Calibri',
  'Cambria',
  'Consolas',
  'Courier New',
  'Georgia',
  'Segoe UI',
  'Tahoma',
  'Times New Roman',
  'Trebuchet MS',
  'Verdana'
]

let fontCache: string[] | null = null

const listWindowsFonts = async (): Promise<string[]> => {
  const script = [
    'Add-Type -AssemblyName System.Drawing',
    '$drawing = [System.Drawing.Text.InstalledFontCollection]::new().Families | ForEach-Object { $_.Name }',
    '$registry = @(\'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts\', \'HKCU:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts\') | Where-Object { Test-Path $_ } | ForEach-Object { (Get-ItemProperty $_).PSObject.Properties | Where-Object { $_.Name -notmatch \'^PS\' } | ForEach-Object { $_.Name -replace \'\\s+\\((TrueType|OpenType)\\)$\', \'\' } }',
    '@($drawing + $registry | Where-Object { $_ } | Sort-Object -Unique) | ConvertTo-Json -Compress'
  ].join('; ')
  const { stdout } = await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
    { encoding: 'utf8', windowsHide: true, maxBuffer: 2 * 1024 * 1024 }
  )
  const result = JSON.parse(stdout.trim()) as string[] | string
  return (Array.isArray(result) ? result : [result]).filter(Boolean)
}

const listInstalledFonts = async (): Promise<string[]> => {
  if (fontCache) return fontCache

  try {
    const fonts = process.platform === 'win32' ? await listWindowsFonts() : fallbackFonts
    fontCache = Array.from(new Set([...fonts, ...fallbackFonts])).sort((a, b) => a.localeCompare(b))
  } catch {
    fontCache = fallbackFonts
  }

  return fontCache
}

export const registerFontIpc = (): void => {
  ipcMain.handle('fonts:list', () => listInstalledFonts())
}
