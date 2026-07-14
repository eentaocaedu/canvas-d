# Canvas D

Canvas D is a local desktop infinite canvas app for Windows. It is focused on fast wireframes, website layout sketches, mind maps and visual organization without cloud, login or backend services.

[Baixar a versao mais recente para Windows](https://github.com/eentaocaedu/canvas-d/releases/latest)

## Download

Os instaladores do Windows ficam na pagina de [Releases](https://github.com/eentaocaedu/canvas-d/releases). Cada versao historica publicada possui seu proprio instalador `.exe`.

## Stack

- Electron
- electron-vite
- React
- TypeScript
- Zustand
- react-konva / Konva
- Tailwind CSS
- electron-builder
- Local JSON persistence with `.pcanvas`

## Commands

```bash
npm install
npm run dev
npm run build
npm run smoke
npm run dist
```

`npm run smoke` abre o Electron por DevTools Protocol e verifica a tela inicial, preload/IPC, fontes locais, menus, ferramentas de desenho, os dois modos de texto, importacao SVG/EPS/WebP, crop, camadas, multisselecao, aparencia, grupos, clipboard, historico, atalhos e erros do renderer.

On Windows PowerShell, if `npm` is blocked by execution policy, use `npm.cmd`:

```bash
npm.cmd install
npm.cmd run dev
```

## Basic use

1. Start the app with `npm.cmd run dev` or install the latest Windows build from [GitHub Releases](https://github.com/eentaocaedu/canvas-d/releases/latest).
2. Click **Novo projeto** and choose between an infinite canvas or a sized artboard. Artboards support px, cm, mm, m, presets, orientation, DPI, and background.
3. Use the left toolbar or shortcuts to switch tools:
   - `V` select
   - `H` pan
   - `F` frame
   - `R` rectangle
   - `O` ellipse
   - `D` diamond
   - `U` polygon
   - `N` sticky note
   - `L` line
   - `A` arrow
   - `B` vector path
   - `T` text
   - `P` freehand
   - `I` image
   - `C` crop selected image/SVG
4. Pan with the hand tool, middle mouse, or space + drag.
5. Zoom with Ctrl + scroll, Ctrl + `+`, Ctrl + `-`, Ctrl + `0`, and Ctrl + `1`. Use Ctrl + `2` to fit the selection or visible artwork.
6. Select objects to edit properties in the right inspector.
7. Use Ctrl + S to update the open `.pcanvas`, `.svg`, or `.eps` document, and Ctrl + Shift + S to choose a new format.
8. Select a frame or objects and export PNG, JPEG, WebP, or editable SVG from the top bar or inspector.

## MVP scope

- Local workspaces and `.pcanvas` files
- Infinite visual canvas with camera-based pan and zoom
- Frames, live shapes, point/paragraph text, straight/orthogonal smart connectors, editable vector paths, freehand and images
- Selection, move, resize and rotate
- Contextual inspector controls with persistent tool styles
- Full picker populated from fonts installed on Windows
- Smart guides, rulers, alignment, distribution and a layers panel
- Local save, open, recent projects and autosave
- Configurable new-project flow with infinite mode or fixed artboards in px/cm/mm/m
- Native editable SVG import and EPS PostScript path import
- PNG/JPEG/WebP raster export plus editable SVG and EPS vector export
- A document menu with New, Open, Save, Save As, export formats, current path, and save state
- A persistent, resizable Properties dock with collapsible and drag-sortable cards, plus a compact icon rail
- Dockable Layers panel with click-outside closing and mouse-wheel scrolling while a layer is being dragged
- Persistent Settings for five color themes, interface density, canvas grid, reduced motion, and panel behavior

## Current MVP notes

- The app is fully local and offline after dependencies are installed.
- Projects are plain JSON documents with the `.pcanvas` extension.
- Autosave writes a project snapshot to Electron `userData` every 10 seconds while the document is dirty.
- Multi-selection is supported for selection and transformer operations; dragging one selected object moves that object.
- Image import uses the browser file picker and stores the image as a data URL in the project file.
- With the text tool, click to create point text or drag to create a paragraph box. Use Ctrl+Enter to finish editing.
- Arrow keys nudge selected objects by 1 px; Shift+arrow nudges by 10 px.
- Ctrl-click or Shift-click in the Layers panel builds multi-selections; Shift selects a contiguous range. Fill, stroke color, and stroke width can be applied to the whole selection.
- Vector paths are created point by point, can be open or closed, and expose draggable anchor points after selection.
- SVG files opened or dragged into the canvas become editable paths, groups and text rather than a flattened image.
- EPS files use a safe command reader for common vector artwork. Unsupported PostScript resources are reported instead of silently rasterized.
- Proprietary AI files are intentionally not presented as native: export them as SVG in Illustrator to preserve vectors and groups before opening in Canvas D.
- EPS export is generated locally and keeps supported artwork as vectors. SVG and `.pcanvas` remain the highest-fidelity editable formats in Canvas D.
- WebP can be opened, dragged into the canvas, exported, or chosen in Save As.
- Images and SVGs can be cropped directly on the canvas with the Crop tool.
- Automatic arrow connections are optional and disabled by default; enable them in the Arrow tool properties when smart connectors are desired.
- Rectangle corner handles edit all corners together; hold Shift while dragging to edit one corner independently.
- Properties keeps its width, card order, collapsed cards, and compact/full mode between sessions. Export stays last and Transform starts first in the default layout.
- When Properties is compact, each contextual icon opens its card temporarily and clicking back on the canvas closes it.
- Layers can float over the canvas or dock as a reorderable Properties card. While dragging a layer, the mouse wheel scrolls the list without releasing the item.
- Open Settings from `Edit > Configuracoes...`, `Ctrl+,`, or the app File menu. Theme and interface choices apply globally and are not stored inside `.pcanvas` files.

## Future TODOs

- Snap to grid
- Reusable components
- Website templates
- PDF export
- Clickable prototyping
- Component library
- Mind maps with smart connectors
- Presentation mode
- AI layout generation
- Screenshot to wireframe
- Custom themes
- Plugin system
