export const dashForStroke = (pattern: 'solid' | 'dashed' | 'dotted' = 'solid', strokeWidth = 1): number[] => {
  const width = Math.max(1, strokeWidth)
  if (pattern === 'dashed') return [width * 5, width * 3]
  if (pattern === 'dotted') return [width, width * 2.5]
  return []
}

export const routeArrowPoints = (points: number[], routing: 'straight' | 'elbow' = 'straight'): number[] => {
  if (routing !== 'elbow' || points.length < 4) return points
  const startX = points[0]
  const startY = points[1]
  const endX = points[points.length - 2]
  const endY = points[points.length - 1]
  if (Math.abs(endX - startX) >= Math.abs(endY - startY)) {
    const middleX = (startX + endX) / 2
    return [startX, startY, middleX, startY, middleX, endY, endX, endY]
  }
  const middleY = (startY + endY) / 2
  return [startX, startY, startX, middleY, endX, middleY, endX, endY]
}
