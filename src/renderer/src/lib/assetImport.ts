import { boundsFromObjects } from './bounds'
import { makeImage, nextObjectZIndex } from './objectFactory'
import { importSvgDocument } from './svgImport'
import { importLegacyVector } from './legacyVectorImport'
import { useCanvasStore } from '@renderer/store/useCanvasStore'
import { useHistoryStore } from '@renderer/store/useHistoryStore'
import { useWorkspaceStore } from '@renderer/store/useWorkspaceStore'
import type { Point } from '@renderer/types/canvas'

export const isNativeVectorFile = (file: File): boolean => file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)
export const isConvertibleVectorFile = (file: File): boolean => /\.eps$/i.test(file.name)
export const isUnsupportedAiFile = (file: File): boolean => /\.ai$/i.test(file.name)
export const isCanvasAssetFile = (file: File): boolean => file.type.startsWith('image/') || /\.(png|jpe?g|webp|svg|eps)$/i.test(file.name)

const dataUrlForFile = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Nao foi possivel ler o arquivo.'))
    reader.readAsDataURL(file)
  })

const imageSize = (src: string): Promise<{ width: number; height: number }> =>
  new Promise((resolve, reject) => {
    const image = new window.Image()
    image.onload = () => resolve({ width: Math.max(1, image.naturalWidth), height: Math.max(1, image.naturalHeight) })
    image.onerror = () => reject(new Error('Nao foi possivel abrir a imagem.'))
    image.src = src
  })

export const importAssetFile = async (file: File, point: Point): Promise<void> => {
  const canvas = useCanvasStore.getState()
  try {
    if (isNativeVectorFile(file) || isConvertibleVectorFile(file)) {
      let imported
      if (isNativeVectorFile(file)) {
        imported = await importSvgDocument(await file.text(), file.name.replace(/\.[^.]+$/, ''))
      } else {
        const bytes = new Uint8Array(await file.arrayBuffer())
        try {
          imported = await importLegacyVector(bytes, file.name.replace(/\.[^.]+$/, ''), file.name.match(/\.[^.]+$/)?.[0] ?? '')
        } catch (nativeError) {
          const result = await window.canvasD.convertVectorFile(file.name, bytes)
          if (!result.ok || !result.data) throw nativeError
          imported = await importSvgDocument(result.data, file.name.replace(/\.[^.]+$/, ''))
        }
      }
      const bounds = boundsFromObjects(imported.objects, 0)
      if (!bounds) throw new Error('O vetor nao possui elementos editaveis.')
      const dx = point.x - (bounds.x + bounds.width / 2)
      const dy = point.y - (bounds.y + bounds.height / 2)
      const firstZ = nextObjectZIndex(canvas.objects)
      const placed = imported.objects.map((object, index) => ({ ...object, x: object.x + dx, y: object.y + dy, zIndex: firstZ + index }))
      useHistoryStore.getState().push({ camera: canvas.camera, objects: canvas.objects, guides: canvas.guides })
      canvas.setObjects([...canvas.objects, ...placed])
      canvas.setSelectedIds(placed.map((object) => object.id))
      useWorkspaceStore.getState().markDirty()
      if (imported.warnings.length > 0) window.alert(`Vetor importado com avisos:\n\n${imported.warnings.slice(0, 5).join('\n')}`)
      return
    }

    const src = await dataUrlForFile(file)
    const size = await imageSize(src)
    const imageObject = makeImage(point, src, size.width, size.height, nextObjectZIndex(canvas.objects))
    const centered = { ...imageObject, x: point.x - imageObject.width / 2, y: point.y - imageObject.height / 2 }
    useHistoryStore.getState().push({ camera: canvas.camera, objects: canvas.objects, guides: canvas.guides })
    canvas.addObject(centered, true)
    useWorkspaceStore.getState().markDirty()
  } catch (error) {
    window.alert(error instanceof Error ? error.message : 'Nao foi possivel importar o arquivo.')
  }
}
