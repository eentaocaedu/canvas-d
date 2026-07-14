import assert from 'node:assert/strict'
import { embedJpegDpi, embedPngDpi, embedWebpDpi } from '../src/renderer/src/lib/rasterMetadata.ts'

const text = (bytes) => new TextDecoder().decode(bytes)

const png = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'))
const pngWithDpi = embedPngDpi(png, 300)
const physOffset = text(pngWithDpi).indexOf('pHYs')
assert.ok(physOffset > 0, 'PNG must contain a pHYs chunk')
const pngView = new DataView(pngWithDpi.buffer, pngWithDpi.byteOffset)
assert.equal(pngView.getUint32(physOffset + 4), 11811, 'PNG X density must be 300 DPI in pixels/meter')
assert.equal(pngView.getUint32(physOffset + 8), 11811, 'PNG Y density must be 300 DPI in pixels/meter')
assert.equal(pngWithDpi[physOffset + 12], 1, 'PNG density unit must be meters')

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9])
const jpegWithDpi = embedJpegDpi(jpeg, 300)
assert.equal(text(jpegWithDpi.slice(6, 11)), 'JFIF\0', 'JPEG must contain a JFIF segment')
assert.equal(jpegWithDpi[13], 1, 'JPEG density unit must be DPI')
assert.equal((jpegWithDpi[14] << 8) | jpegWithDpi[15], 300, 'JPEG X density must be 300 DPI')
assert.equal((jpegWithDpi[16] << 8) | jpegWithDpi[17], 300, 'JPEG Y density must be 300 DPI')

const vp8Payload = new Uint8Array([0, 0])
const webp = new Uint8Array(12 + 8 + vp8Payload.length)
webp.set(new TextEncoder().encode('RIFF'), 0)
new DataView(webp.buffer).setUint32(4, webp.length - 8, true)
webp.set(new TextEncoder().encode('WEBPVP8 '), 8)
new DataView(webp.buffer).setUint32(16, vp8Payload.length, true)
webp.set(vp8Payload, 20)
const webpWithDpi = embedWebpDpi(webp, 300, 500, 500)
assert.equal(text(webpWithDpi.slice(0, 4)), 'RIFF', 'WebP must retain RIFF signature')
assert.equal(text(webpWithDpi.slice(8, 12)), 'WEBP', 'WebP must retain WEBP signature')
assert.ok(text(webpWithDpi).includes('VP8X'), 'WebP must contain an extended header')
assert.ok(text(webpWithDpi).includes('EXIF'), 'WebP must contain EXIF resolution metadata')
assert.equal(new DataView(webpWithDpi.buffer).getUint32(4, true), webpWithDpi.length - 8, 'WebP RIFF size must be valid')

console.log('Raster metadata tests passed: PNG/JPEG/WebP at 300 DPI.')
