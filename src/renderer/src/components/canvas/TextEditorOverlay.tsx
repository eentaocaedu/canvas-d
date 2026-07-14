import { useEffect, useMemo, useRef, useState } from 'react'
import { worldToScreen } from '@renderer/lib/coordinates'
import { measurePointText } from '@renderer/lib/textMetrics'
import { useCanvasStore } from '@renderer/store/useCanvasStore'
import { useHistoryStore } from '@renderer/store/useHistoryStore'
import { useWorkspaceStore } from '@renderer/store/useWorkspaceStore'
import type { TextObject } from '@renderer/types/canvas'

interface TextEditorOverlayProps {
  editingId: string | null
  onClose: () => void
}

const TextEditorOverlay = ({ editingId, onClose }: TextEditorOverlayProps): JSX.Element | null => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const committedRef = useRef(false)
  const objects = useCanvasStore((state) => state.objects)
  const guides = useCanvasStore((state) => state.guides)
  const camera = useCanvasStore((state) => state.camera)
  const updateObject = useCanvasStore((state) => state.updateObject)
  const pushHistory = useHistoryStore((state) => state.push)
  const markDirty = useWorkspaceStore((state) => state.markDirty)
  const textObject = objects.find((object) => object.id === editingId && object.type === 'text') as TextObject | undefined
  const [value, setValue] = useState(textObject?.text ?? '')
  const mode = textObject?.textMode ?? 'paragraph'

  useEffect(() => {
    setValue(textObject?.text ?? '')
    committedRef.current = false
  }, [textObject?.id, textObject?.text])

  useEffect(() => {
    if (!editingId) return
    const frame = window.requestAnimationFrame(() => {
      textareaRef.current?.focus()
      textareaRef.current?.select()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [editingId])

  const screenPosition = useMemo(() => {
    if (!textObject) return null
    return worldToScreen({ x: textObject.x, y: textObject.y }, camera)
  }, [camera, textObject])

  const pointSize = useMemo(() => {
    if (!textObject || mode !== 'point') return null
    return measurePointText({
      text: value,
      fontFamily: textObject.fontFamily,
      fontSize: textObject.fontSize,
      fontWeight: textObject.fontWeight,
      fontStyle: textObject.fontStyle,
      lineHeight: textObject.lineHeight,
      letterSpacing: textObject.letterSpacing
    })
  }, [mode, textObject, value])

  if (!textObject || !screenPosition) return null

  const commit = (): void => {
    if (committedRef.current) return
    committedRef.current = true
    const sizePatch = mode === 'point' && pointSize ? pointSize : {}
    const changed = value !== textObject.text || ('width' in sizePatch && (sizePatch.width !== textObject.width || sizePatch.height !== textObject.height))
    if (changed) {
      pushHistory({ camera, objects, guides })
      updateObject(textObject.id, { text: value, ...sizePatch })
      markDirty()
    }
    onClose()
  }

  const width = (mode === 'point' ? pointSize?.width ?? textObject.width : textObject.width) * camera.zoom
  const height = (mode === 'point' ? pointSize?.height ?? textObject.height : textObject.height) * camera.zoom

  return (
    <textarea
      ref={textareaRef}
      value={value}
      wrap={mode === 'point' ? 'off' : 'soft'}
      spellCheck
      onChange={(event) => setValue(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          committedRef.current = true
          onClose()
        } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault()
          commit()
        }
      }}
      className="absolute z-20 resize-none p-0 outline-none"
      style={{
        left: screenPosition.x,
        top: screenPosition.y,
        width: Math.max(8, width),
        height: Math.max(8, height),
        boxSizing: 'border-box',
        border: mode === 'paragraph' ? '1px dashed rgba(96, 165, 250, 0.9)' : '1px solid transparent',
        borderRadius: 0,
        background: 'transparent',
        color: textObject.fill,
        caretColor: '#f8fafc',
        fontFamily: textObject.fontFamily,
        fontSize: textObject.fontSize * camera.zoom,
        fontStyle: textObject.fontStyle ?? 'normal',
        fontWeight: textObject.fontWeight,
        letterSpacing: (textObject.letterSpacing ?? 0) * camera.zoom,
        lineHeight: textObject.lineHeight,
        textAlign: textObject.align === 'justify' ? 'justify' : textObject.align,
        textDecoration: textObject.textDecoration ?? 'none',
        transform: `rotate(${textObject.rotation}deg)`,
        transformOrigin: 'top left',
        overflow: mode === 'paragraph' ? 'auto' : 'hidden',
        whiteSpace: mode === 'point' ? 'pre' : 'pre-wrap'
      }}
      aria-label={mode === 'point' ? 'Editar texto livre' : 'Editar texto de paragrafo'}
    />
  )
}

export default TextEditorOverlay
