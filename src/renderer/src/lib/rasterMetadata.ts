export type RasterMetadataFormat = 'png' | 'jpeg' | 'webp'

const concatBytes = (parts: Uint8Array[]): Uint8Array => {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0))
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }
  return result
}

const ascii = (value: string): Uint8Array => new TextEncoder().encode(value)

let crcTable: Uint32Array | null = null
const pngCrc32 = (bytes: Uint8Array): number => {
  if (!crcTable) {
    crcTable = new Uint32Array(256)
    for (let index = 0; index < 256; index += 1) {
      let value = index
      for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
      crcTable[index] = value >>> 0
    }
  }
  let crc = 0xffffffff
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

const pngChunk = (type: string, data: Uint8Array): Uint8Array => {
  const typeBytes = ascii(type)
  const result = new Uint8Array(12 + data.length)
  const view = new DataView(result.buffer)
  view.setUint32(0, data.length)
  result.set(typeBytes, 4)
  result.set(data, 8)
  view.setUint32(8 + data.length, pngCrc32(concatBytes([typeBytes, data])))
  return result
}

export const embedPngDpi = (bytes: Uint8Array, dpi: number): Uint8Array => {
  if (bytes.length < 12 || bytes[0] !== 0x89 || String.fromCharCode(...bytes.slice(1, 4)) !== 'PNG') return bytes
  const ppm = Math.max(1, Math.round(dpi / 0.0254))
  const density = new Uint8Array(9)
  const densityView = new DataView(density.buffer)
  densityView.setUint32(0, ppm)
  densityView.setUint32(4, ppm)
  density[8] = 1
  const physicalChunk = pngChunk('pHYs', density)
  const parts: Uint8Array[] = [bytes.slice(0, 8)]
  let inserted = false
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const length = new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0)
    const end = offset + 12 + length
    if (end > bytes.length) return bytes
    const type = new TextDecoder().decode(bytes.slice(offset + 4, offset + 8))
    if (type === 'IDAT' && !inserted) {
      parts.push(physicalChunk)
      inserted = true
    }
    if (type !== 'pHYs') parts.push(bytes.slice(offset, end))
    offset = end
  }
  if (!inserted) parts.splice(1, 0, physicalChunk)
  return concatBytes(parts)
}

export const embedJpegDpi = (bytes: Uint8Array, dpi: number): Uint8Array => {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return bytes
  const density = Math.max(1, Math.min(65535, Math.round(dpi)))
  const result = bytes.slice()
  for (let offset = 2; offset + 4 < result.length;) {
    if (result[offset] !== 0xff) break
    const marker = result[offset + 1]
    if (marker === 0xda || marker === 0xd9) break
    const length = (result[offset + 2] << 8) | result[offset + 3]
    if (length < 2 || offset + 2 + length > result.length) break
    const dataOffset = offset + 4
    if (marker === 0xe0 && String.fromCharCode(...result.slice(dataOffset, dataOffset + 5)) === 'JFIF\0' && length >= 16) {
      result[dataOffset + 7] = 1
      result[dataOffset + 8] = density >> 8
      result[dataOffset + 9] = density & 0xff
      result[dataOffset + 10] = density >> 8
      result[dataOffset + 11] = density & 0xff
      return result
    }
    offset += 2 + length
  }
  const app0 = new Uint8Array([0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, density >> 8, density & 0xff, density >> 8, density & 0xff, 0x00, 0x00])
  return concatBytes([result.slice(0, 2), app0, result.slice(2)])
}

const webpChunk = (type: string, data: Uint8Array): Uint8Array => {
  const paddedLength = data.length + (data.length % 2)
  const result = new Uint8Array(8 + paddedLength)
  result.set(ascii(type), 0)
  new DataView(result.buffer).setUint32(4, data.length, true)
  result.set(data, 8)
  return result
}

const uint24 = (target: Uint8Array, offset: number, value: number): void => {
  target[offset] = value & 0xff
  target[offset + 1] = value >> 8 & 0xff
  target[offset + 2] = value >> 16 & 0xff
}

const exifDpi = (dpi: number): Uint8Array => {
  const payload = new Uint8Array(72)
  payload.set(ascii('Exif\0\0'), 0)
  const view = new DataView(payload.buffer, 6)
  view.setUint16(0, 0x4949, true)
  view.setUint16(2, 42, true)
  view.setUint32(4, 8, true)
  view.setUint16(8, 3, true)
  const writeEntry = (offset: number, tag: number, type: number, count: number, value: number): void => {
    view.setUint16(offset, tag, true)
    view.setUint16(offset + 2, type, true)
    view.setUint32(offset + 4, count, true)
    view.setUint32(offset + 8, value, true)
  }
  writeEntry(10, 0x011a, 5, 1, 50)
  writeEntry(22, 0x011b, 5, 1, 58)
  writeEntry(34, 0x0128, 3, 1, 2)
  view.setUint32(46, 0, true)
  view.setUint32(50, Math.max(1, Math.round(dpi)), true)
  view.setUint32(54, 1, true)
  view.setUint32(58, Math.max(1, Math.round(dpi)), true)
  view.setUint32(62, 1, true)
  return payload
}

export const embedWebpDpi = (bytes: Uint8Array, dpi: number, width: number, height: number): Uint8Array => {
  if (bytes.length < 20 || new TextDecoder().decode(bytes.slice(0, 4)) !== 'RIFF' || new TextDecoder().decode(bytes.slice(8, 12)) !== 'WEBP') return bytes
  const chunks: Uint8Array[] = []
  let hasExtendedHeader = false
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const size = new DataView(bytes.buffer, bytes.byteOffset + offset + 4, 4).getUint32(0, true)
    const end = offset + 8 + size + (size % 2)
    if (end > bytes.length) return bytes
    const type = new TextDecoder().decode(bytes.slice(offset, offset + 4))
    if (type !== 'EXIF') {
      const chunk = bytes.slice(offset, end)
      if (type === 'VP8X') {
        chunk[8] |= 0x08
        hasExtendedHeader = true
      }
      chunks.push(chunk)
    }
    offset = end
  }
  if (!hasExtendedHeader) {
    const extended = new Uint8Array(10)
    extended[0] = 0x18
    uint24(extended, 4, Math.max(0, Math.round(width) - 1))
    uint24(extended, 7, Math.max(0, Math.round(height) - 1))
    chunks.unshift(webpChunk('VP8X', extended))
  }
  chunks.push(webpChunk('EXIF', exifDpi(dpi)))
  const body = concatBytes([ascii('WEBP'), ...chunks])
  const result = new Uint8Array(8 + body.length)
  result.set(ascii('RIFF'), 0)
  new DataView(result.buffer).setUint32(4, result.length - 8, true)
  result.set(body, 8)
  return result
}

export const withRasterDpi = (bytes: Uint8Array, format: RasterMetadataFormat, dpi: number, width: number, height: number): Uint8Array => {
  if (!Number.isFinite(dpi) || dpi <= 0) return bytes
  if (format === 'png') return embedPngDpi(bytes, dpi)
  if (format === 'jpeg') return embedJpegDpi(bytes, dpi)
  return embedWebpDpi(bytes, dpi, width, height)
}
