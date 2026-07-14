import type { Camera } from '@renderer/types/canvas'

interface GridLayerProps {
  camera: Camera
}

const GridLayer = ({ camera }: GridLayerProps): JSX.Element => {
  const spacing = Math.max(8, 24 * camera.zoom)

  return (
    <div
      className="pointer-events-none absolute inset-0 canvas-grid"
      style={{
        backgroundSize: `${spacing}px ${spacing}px`,
        backgroundPosition: `${camera.x}px ${camera.y}px`
      }}
    />
  )
}

export default GridLayer

