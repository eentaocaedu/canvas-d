import { dialog, ipcMain } from 'electron'
import { writeFile } from 'node:fs/promises'

interface ExportPayload {
  bytes?: Uint8Array
  dataUrl?: string
  defaultName?: string
}

interface SvgExportPayload {
  content: string
  defaultName?: string
}

interface VectorExportPayload extends SvgExportPayload {
  format: 'eps'
}

const dataUrlToBuffer = (dataUrl: string): Buffer => {
  const [, base64 = ''] = dataUrl.split(',')
  return Buffer.from(base64, 'base64')
}

const rasterBuffer = (payload: ExportPayload, format: 'png' | 'jpeg' | 'webp'): Buffer => {
  const buffer = payload.bytes ? Buffer.from(payload.bytes) : payload.dataUrl ? dataUrlToBuffer(payload.dataUrl) : Buffer.alloc(0)
  const valid =
    format === 'png'
      ? buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      : format === 'jpeg'
        ? buffer.length > 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[buffer.length - 2] === 0xff && buffer[buffer.length - 1] === 0xd9
        : buffer.length > 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  if (!valid) throw new Error(`A imagem ${format.toUpperCase()} gerada e invalida e nao foi salva.`)
  return buffer
}

export const registerExportIpc = (): void => {
  ipcMain.handle('export:png', async (_event, payload: ExportPayload) => {
    try {
      const result = await dialog.showSaveDialog({
        title: 'Export PNG',
        defaultPath: payload.defaultName ?? 'canvas-frame.png',
        filters: [{ name: 'PNG Image', extensions: ['png'] }]
      })

      if (result.canceled || !result.filePath) return { canceled: true }
      await writeFile(result.filePath, rasterBuffer(payload, 'png'))
      return { ok: true, path: result.filePath }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Unable to export PNG.' }
    }
  })

  ipcMain.handle('export:jpeg', async (_event, payload: ExportPayload) => {
    try {
      const result = await dialog.showSaveDialog({
        title: 'Export JPEG',
        defaultPath: payload.defaultName ?? 'canvas-export.jpg',
        filters: [{ name: 'JPEG Image', extensions: ['jpg', 'jpeg'] }]
      })
      if (result.canceled || !result.filePath) return { canceled: true }
      await writeFile(result.filePath, rasterBuffer(payload, 'jpeg'))
      return { ok: true, path: result.filePath }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Unable to export JPEG.' }
    }
  })

  ipcMain.handle('export:webp', async (_event, payload: ExportPayload) => {
    try {
      const result = await dialog.showSaveDialog({
        title: 'Export WebP',
        defaultPath: payload.defaultName ?? 'canvas-export.webp',
        filters: [{ name: 'WebP Image', extensions: ['webp'] }]
      })
      if (result.canceled || !result.filePath) return { canceled: true }
      await writeFile(result.filePath, rasterBuffer(payload, 'webp'))
      return { ok: true, path: result.filePath }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Unable to export WebP.' }
    }
  })

  ipcMain.handle('export:svg', async (_event, payload: SvgExportPayload) => {
    try {
      const result = await dialog.showSaveDialog({
        title: 'Export SVG',
        defaultPath: payload.defaultName ?? 'canvas-export.svg',
        filters: [{ name: 'Scalable Vector Graphics', extensions: ['svg'] }]
      })
      if (result.canceled || !result.filePath) return { canceled: true }
      await writeFile(result.filePath, payload.content, 'utf8')
      return { ok: true, path: result.filePath }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Unable to export SVG.' }
    }
  })

  ipcMain.handle('export:vector', async (_event, payload: VectorExportPayload) => {
    try {
      const result = await dialog.showSaveDialog({
        title: 'Export EPS',
        defaultPath: payload.defaultName ?? 'canvas-export.eps',
        filters: [{ name: 'Encapsulated PostScript', extensions: ['eps'] }]
      })
      if (result.canceled || !result.filePath) return { canceled: true }
      await writeFile(result.filePath, payload.content, 'utf8')
      return { ok: true, path: result.filePath }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Unable to export vector file.' }
    }
  })
}
