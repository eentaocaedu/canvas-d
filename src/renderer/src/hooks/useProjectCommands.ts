import { useCallback } from 'react'
import { boundsFromObjects } from '@renderer/lib/bounds'
import { exportFrameToBytes, exportObjectsToBytes, type RasterExportFormat } from '@renderer/lib/canvasExport'
import { buildProjectDocument } from '@renderer/lib/projectDocument'
import { createNewProject, validateProjectDocument } from '@renderer/lib/serialization'
import { exportFrameToSvg, exportObjectsToSvg } from '@renderer/lib/svgExport'
import { importSvgDocument } from '@renderer/lib/svgImport'
import { importLegacyVector } from '@renderer/lib/legacyVectorImport'
import { svgToEps } from '@renderer/lib/epsExport'
import { makeFrame, makeImage } from '@renderer/lib/objectFactory'
import { clampZoom } from '@renderer/lib/coordinates'
import { useCanvasStore } from '@renderer/store/useCanvasStore'
import { useHistoryStore } from '@renderer/store/useHistoryStore'
import { useWorkspaceStore } from '@renderer/store/useWorkspaceStore'
import type { CanvasObject, Camera, FrameObject } from '@renderer/types/canvas'
import type { ProjectDocument, ProjectSetup } from '@renderer/types/project'

const extensionOf = (path: string): string => path.match(/(\.[^./\\]+)$/)?.[1]?.toLowerCase() ?? ''
const nameFromPath = (path: string): string => path.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') || 'Sem titulo'

const cameraToFit = (objects: CanvasObject[]): Camera => {
  const bounds = boundsFromObjects(objects, 48)
  if (!bounds) return { x: 0, y: 0, zoom: 1 }
  const viewportWidth = Math.max(480, window.innerWidth - 356)
  const viewportHeight = Math.max(320, window.innerHeight - 76)
  const zoom = clampZoom(Math.min(viewportWidth / bounds.width, viewportHeight / bounds.height, 2))
  return {
    x: (viewportWidth - bounds.width * zoom) / 2 - bounds.x * zoom,
    y: (viewportHeight - bounds.height * zoom) / 2 - bounds.y * zoom,
    zoom
  }
}

const imageSize = (src: string): Promise<{ width: number; height: number }> =>
  new Promise((resolve, reject) => {
    const image = new window.Image()
    image.onload = () => resolve({ width: Math.max(1, image.naturalWidth), height: Math.max(1, image.naturalHeight) })
    image.onerror = () => reject(new Error('Nao foi possivel abrir a imagem.'))
    image.src = src
  })

export const useProjectCommands = () => {
  const project = useWorkspaceStore((state) => state.project)
  const projectPath = useWorkspaceStore((state) => state.projectPath)
  const setProject = useWorkspaceStore((state) => state.setProject)
  const setSaveState = useWorkspaceStore((state) => state.setSaveState)
  const saveState = useWorkspaceStore((state) => state.saveState)
  const setRecentProjects = useWorkspaceStore((state) => state.setRecentProjects)
  const setNewProjectDialogOpen = useWorkspaceStore((state) => state.setNewProjectDialogOpen)
  const setCanvas = useCanvasStore((state) => state.setCanvas)
  const objects = useCanvasStore((state) => state.objects)
  const camera = useCanvasStore((state) => state.camera)
  const selectedIds = useCanvasStore((state) => state.selectedIds)
  const clearHistory = useHistoryStore((state) => state.clear)

  const buildCurrentDocument = useCallback(() => {
    if (!project) return null
    const canvas = useCanvasStore.getState()
    return buildProjectDocument(project, canvas.camera, canvas.objects, canvas.guides)
  }, [project])

  const refreshRecentProjects = useCallback(async () => {
    setRecentProjects(await window.canvasD.getRecentProjects())
  }, [setRecentProjects])

  const currentSvg = useCallback((): string => {
    const frame = objects.find((object): object is FrameObject => object.type === 'frame' && object.visible)
    if (frame) return exportFrameToSvg(frame, objects)
    const visible = objects.filter((object) => object.visible)
    const area = boundsFromObjects(visible, 0)
    if (!area) throw new Error('Nao ha objetos visiveis para salvar.')
    return exportObjectsToSvg(area, visible)
  }, [objects])

  const currentRaster = useCallback(async (format: RasterExportFormat, pixelRatio: 1 | 2 | 3 = 2): Promise<Uint8Array> => {
    const dpi = project?.setup?.dpi ?? 96
    const frame = objects.find((object): object is FrameObject => object.type === 'frame' && object.visible)
    // Artboards are document-sized surfaces: raster output must match their
    // width and height exactly. Pixel-ratio scaling is reserved for loose
    // selections on the infinite canvas.
    if (frame) return exportFrameToBytes(frame, objects, 1, format, dpi)
    const visible = objects.filter((object) => object.visible)
    const area = boundsFromObjects(visible, 0)
    if (!area) throw new Error('Nao ha objetos visiveis para salvar.')
    return exportObjectsToBytes(area, visible, pixelRatio, format, dpi)
  }, [objects, project?.setup?.dpi])

  const newProject = useCallback(() => {
    if (saveState === 'dirty' && !window.confirm('O projeto atual tem alteracoes nao salvas. Criar um novo projeto mesmo assim?')) return
    setNewProjectDialogOpen(true)
  }, [saveState, setNewProjectDialogOpen])

  const createConfiguredProject = useCallback((name: string, setup: ProjectSetup) => {
    const next = { ...createNewProject(name.trim() || 'Untitled Canvas'), setup }
    if (setup.mode === 'artboard' && setup.pixelWidth && setup.pixelHeight) {
      const frame = {
        ...makeFrame({ x: 0, y: 0 }, setup.pixelWidth, setup.pixelHeight, 1, 'custom', setup.background),
        name: `Prancheta ${setup.width} x ${setup.height} ${setup.unit}`,
        clipContent: true
      }
      const snapshot = { camera: cameraToFit([frame]), objects: [frame], guides: [] }
      const document: ProjectDocument = { ...next, canvas: snapshot }
      setProject(document, null, 'dirty')
      setCanvas(snapshot)
    } else {
      setProject(next, null, 'dirty')
      setCanvas(next.canvas)
    }
    clearHistory()
    setNewProjectDialogOpen(false)
  }, [clearHistory, setCanvas, setNewProjectDialogOpen, setProject])

  const saveToPath = useCallback(async (path: string): Promise<'document' | 'export' | 'failed'> => {
    const document = buildCurrentDocument()
    if (!document || !project) return 'failed'
    const extension = extensionOf(path)
    const name = nameFromPath(path)
    try {
      if (extension === '.pcanvas') {
        const renamed = { ...document, name }
        const result = await window.canvasD.saveProject(renamed, path)
        if (!result.ok) throw new Error(result.error ?? 'Nao foi possivel salvar o projeto.')
        setProject(validateProjectDocument(result.data) ? result.data : renamed, result.path ?? path, 'saved')
        await refreshRecentProjects()
        return 'document'
      }
      if (extension === '.svg') {
        const result = await window.canvasD.writeDocumentText(path, currentSvg())
        if (!result.ok) throw new Error(result.error ?? 'Nao foi possivel salvar o SVG.')
        setProject({ ...document, name }, path, 'saved')
        return 'document'
      }
      if (extension === '.eps') {
        const eps = await svgToEps(currentSvg(), name)
        const result = await window.canvasD.writeDocumentText(path, eps.content)
        if (!result.ok) throw new Error(result.error ?? 'Nao foi possivel salvar o EPS.')
        setProject({ ...document, name }, path, 'saved')
        if (eps.warnings.length > 0) {
          window.alert(`EPS salvo com avisos:\n\n${eps.warnings.slice(0, 5).join('\n')}`)
        }
        return 'document'
      }
      const format: RasterExportFormat | null = extension === '.webp' ? 'webp' : extension === '.png' ? 'png' : extension === '.jpg' || extension === '.jpeg' ? 'jpeg' : null
      if (format) {
        const result = await window.canvasD.writeDocumentBytes(path, await currentRaster(format, 2))
        if (!result.ok) throw new Error(result.error ?? 'Nao foi possivel salvar a imagem.')
        window.alert('Copia exportada. O projeto editavel continua aberto no formato atual.')
        return 'export'
      }
      throw new Error('Escolha PCanvas, SVG, EPS, WebP, PNG ou JPEG.')
    } catch (error) {
      setSaveState('error')
      window.alert(error instanceof Error ? error.message : 'Nao foi possivel salvar o arquivo.')
      return 'failed'
    }
  }, [buildCurrentDocument, currentRaster, currentSvg, project, refreshRecentProjects, setProject, setSaveState])

  const saveProjectAs = useCallback(async () => {
    if (!project) return
    const previousSaveState = saveState
    const result = await window.canvasD.chooseSavePath(`${project.name || 'Sem titulo'}.pcanvas`)
    if (result.canceled || !result.path) return
    setSaveState('saving')
    const outcome = await saveToPath(result.path)
    if (outcome === 'export') setSaveState(previousSaveState)
  }, [project, saveState, saveToPath, setSaveState])

  const saveProject = useCallback(async () => {
    if (!project) return
    if (!projectPath) {
      await saveProjectAs()
      return
    }
    setSaveState('saving')
    await saveToPath(projectPath)
  }, [project, projectPath, saveProjectAs, saveToPath, setSaveState])

  const loadProject = useCallback(async (path?: string) => {
    if (saveState === 'dirty' && !window.confirm('O projeto atual tem alteracoes nao salvas. Abrir outro arquivo mesmo assim?')) return
    const result = path ? await window.canvasD.openDocumentPath(path) : await window.canvasD.openDocument()
    if (!result.ok || !result.data) {
      if (!result.canceled) {
        setSaveState('error')
        window.alert(result.error ?? 'Nao foi possivel abrir o arquivo.')
      }
      return
    }

    try {
      if (result.data.kind === 'project') {
        if (!validateProjectDocument(result.data.project)) throw new Error('Arquivo .pcanvas invalido ou em versao nao suportada.')
        const document = result.data.project
        setProject(document, result.path ?? null, 'saved')
        setCanvas(document.canvas)
        clearHistory()
        await refreshRecentProjects()
        return
      }

      if (result.data.kind === 'svg' && result.data.content) {
        const imported = await importSvgDocument(result.data.content, result.data.name)
        const frame = { ...makeFrame({ x: 0, y: 0 }, imported.width, imported.height, 0, 'custom', 'transparent'), name: 'Prancheta SVG', clipContent: true }
        const importedObjects = [frame, ...imported.objects.map((object, index) => ({ ...object, zIndex: index + 1 }))]
        const next = createNewProject(result.data.name)
        const snapshot = { camera: cameraToFit(importedObjects), objects: importedObjects, guides: [] }
        const document: ProjectDocument = {
          ...next,
          setup: { mode: 'artboard', unit: 'px', width: imported.width, height: imported.height, pixelWidth: Math.round(imported.width), pixelHeight: Math.round(imported.height), dpi: 96, background: 'transparent' },
          canvas: snapshot
        }
        setProject(document, result.data.convertedFrom ? null : result.path ?? null, result.data.convertedFrom ? 'dirty' : 'saved')
        setCanvas(snapshot)
        clearHistory()
        if (imported.warnings.length > 0) window.alert(`Arquivo aberto com avisos:\n\n${imported.warnings.slice(0, 6).join('\n')}`)
        if (result.data.convertedFrom) window.alert(`${result.data.convertedFrom.toUpperCase()} convertido para paths SVG editaveis. Use Salvar como para escolher PCanvas, SVG ou EPS.`)
        return
      }

      if (result.data.kind === 'vector' && result.data.bytes) {
        const imported = await importLegacyVector(new Uint8Array(result.data.bytes), result.data.name, result.data.extension)
        const frame = { ...makeFrame({ x: 0, y: 0 }, imported.width, imported.height, 0, 'custom', 'transparent'), name: `Prancheta ${result.data.extension.toUpperCase()}`, clipContent: true }
        const importedObjects = [frame, ...imported.objects.map((object, index) => ({ ...object, zIndex: index + 1 }))]
        const next = createNewProject(result.data.name)
        const snapshot = { camera: cameraToFit(importedObjects), objects: importedObjects, guides: [] }
        const document: ProjectDocument = {
          ...next,
          setup: { mode: 'artboard', unit: 'px', width: imported.width, height: imported.height, pixelWidth: Math.round(imported.width), pixelHeight: Math.round(imported.height), dpi: 96, background: 'transparent' },
          canvas: snapshot
        }
        setProject(document, null, 'dirty')
        setCanvas(snapshot)
        clearHistory()
        const messages = [`${result.data.extension.slice(1).toUpperCase()} aberto como paths e textos editaveis. Use Salvar como para preservar em PCanvas, SVG ou EPS.`, ...imported.warnings]
        window.alert(messages.join('\n\n'))
        return
      }

      if (result.data.kind === 'image' && result.data.dataUrl) {
        const size = await imageSize(result.data.dataUrl)
        const image = makeImage({ x: 0, y: 0 }, result.data.dataUrl, size.width, size.height, 1)
        const next = createNewProject(result.data.name)
        const snapshot = { camera: cameraToFit([image]), objects: [image], guides: [] }
        const document: ProjectDocument = {
          ...next,
          setup: { mode: 'artboard', unit: 'px', width: size.width, height: size.height, pixelWidth: Math.round(size.width), pixelHeight: Math.round(size.height), dpi: 96, background: 'transparent' },
          canvas: snapshot
        }
        setProject(document, null, 'dirty')
        setCanvas(snapshot)
        clearHistory()
        return
      }

      throw new Error('Formato de documento nao reconhecido.')
    } catch (error) {
      setSaveState('error')
      window.alert(error instanceof Error ? error.message : 'Nao foi possivel abrir o arquivo.')
    }
  }, [clearHistory, refreshRecentProjects, saveState, setCanvas, setProject, setSaveState])

  const autosaveProject = useCallback(async () => {
    const document = buildCurrentDocument()
    if (!document) return
    await window.canvasD.autosaveProject(document.id, document)
  }, [buildCurrentDocument])

  const exportSelectedFrame = useCallback(async (pixelRatio: 1 | 2 | 3 = 2, format: RasterExportFormat = 'png') => {
    const dpi = project?.setup?.dpi ?? 96
    const extension = format === 'jpeg' ? 'jpg' : format
    const saveRaster = async (bytes: Uint8Array, defaultName: string): Promise<void> => {
      const result = format === 'jpeg'
        ? await window.canvasD.exportJpeg({ bytes, defaultName })
        : format === 'webp'
          ? await window.canvasD.exportWebp({ bytes, defaultName })
          : await window.canvasD.exportPng({ bytes, defaultName })
      if (!result.ok && !result.canceled) window.alert(result.error ?? 'Nao foi possivel exportar a imagem.')
    }
    try {
      const frame = objects.find((object) => selectedIds.includes(object.id) && object.type === 'frame') as FrameObject | undefined
      if (frame) {
        await saveRaster(await exportFrameToBytes(frame, objects, 1, format, dpi), `${project?.name ?? 'canvas-d'}-${frame.name}.${extension}`)
        return
      }
      const selectedObjects = objects.filter((object) => selectedIds.includes(object.id) && object.visible)
      if (selectedObjects.length > 0) {
        const area = boundsFromObjects(selectedObjects)
        if (area) await saveRaster(await exportObjectsToBytes(area, selectedObjects, pixelRatio, format, dpi), `${project?.name ?? 'canvas-d'}-selection.${extension}`)
        return
      }
      const visible = objects.filter((object) => object.visible)
      if (visible.length === 0) throw new Error('Nao ha objetos visiveis para exportar.')
      if (!window.confirm('Nenhum item selecionado. Exportar todos os objetos visiveis?')) return
      const area = boundsFromObjects(visible)
      if (area) await saveRaster(await exportObjectsToBytes(area, visible, pixelRatio, format, dpi), `${project?.name ?? 'canvas-d'}-objects.${extension}`)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Nao foi possivel gerar a imagem exportada.')
    }
  }, [objects, project?.name, project?.setup?.dpi, selectedIds])

  const svgForSelection = useCallback((confirmAll: boolean): { content: string; suffix: string } | null => {
    const frame = objects.find((object) => selectedIds.includes(object.id) && object.type === 'frame') as FrameObject | undefined
    if (frame) return { content: exportFrameToSvg(frame, objects), suffix: frame.name }
    const selectedObjects = objects.filter((object) => selectedIds.includes(object.id) && object.visible)
    if (selectedObjects.length > 0) {
      const area = boundsFromObjects(selectedObjects)
      return area ? { content: exportObjectsToSvg(area, selectedObjects), suffix: 'selection' } : null
    }
    const visible = objects.filter((object) => object.visible)
    if (visible.length === 0) {
      window.alert('Nao ha objetos visiveis para exportar.')
      return null
    }
    if (confirmAll && !window.confirm('Nenhum item selecionado. Exportar todos os objetos visiveis?')) return null
    const area = boundsFromObjects(visible)
    return area ? { content: exportObjectsToSvg(area, visible), suffix: 'objects' } : null
  }, [objects, selectedIds])

  const exportSelectedSvg = useCallback(async () => {
    const vector = svgForSelection(true)
    if (!vector) return
    const result = await window.canvasD.exportSvg({ content: vector.content, defaultName: `${project?.name ?? 'canvas-d'}-${vector.suffix}.svg` })
    if (!result.ok && !result.canceled) window.alert(result.error ?? 'Nao foi possivel exportar o SVG.')
  }, [project?.name, svgForSelection])

  const exportSelectedVector = useCallback(async (format: 'eps') => {
    try {
      const vector = svgForSelection(true)
      if (!vector) return
      const converted = await svgToEps(vector.content, `${project?.name ?? 'canvas-d'}-${vector.suffix}`)
      const result = await window.canvasD.exportVector({
        content: converted.content,
        defaultName: `${project?.name ?? 'canvas-d'}-${vector.suffix}.${format}`,
        format
      })
      if (!result.ok && !result.canceled) throw new Error(result.error ?? `Nao foi possivel exportar o ${format.toUpperCase()}.`)
      if (result.ok && converted.warnings.length > 0) {
        window.alert(`EPS exportado com avisos:\n\n${converted.warnings.slice(0, 5).join('\n')}`)
      }
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Nao foi possivel gerar o vetor exportado.')
    }
  }, [project?.name, svgForSelection])

  return { camera, objects, selectedIds, newProject, createConfiguredProject, saveProject, saveProjectAs, loadProject, autosaveProject, exportSelectedFrame, exportSelectedSvg, exportSelectedVector }
}
