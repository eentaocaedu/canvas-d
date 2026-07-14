<div align="center">
  <img src="assets/Ativo%201.svg" width="104" alt="Ícone do Canvas D" />

  # Canvas D

  **Canvas infinito local para transformar ideias em layouts, fluxos, mapas mentais e arte vetorial.**

  [![Versão](https://img.shields.io/github/v/release/eentaocaedu/canvas-d?display_name=tag&style=flat-square&color=2563eb)](https://github.com/eentaocaedu/canvas-d/releases/latest)
  [![Windows](https://img.shields.io/badge/Windows-10%20%7C%2011-0078d4?style=flat-square&logo=windows11)](https://github.com/eentaocaedu/canvas-d/releases/latest)
  [![Electron](https://img.shields.io/badge/Electron-37-47848f?style=flat-square&logo=electron)](https://www.electronjs.org/)
  [![Licença MIT](https://img.shields.io/badge/licença-MIT-22c55e?style=flat-square)](LICENSE)

  [**Baixar para Windows**](https://github.com/eentaocaedu/canvas-d/releases/latest) · [Histórico de versões](CHANGELOG.md) · [Reportar problema](https://github.com/eentaocaedu/canvas-d/issues)
</div>

---

## O que é o Canvas D?

Canvas D é um aplicativo desktop rápido, local e sem login, criado para montar ideias visuais sem interromper o raciocínio. Ele combina a liberdade de um canvas infinito com ferramentas de layout, diagramação, texto, imagem e vetores.

Use o aplicativo para:

- esboçar páginas, interfaces e wireframes;
- criar fluxogramas e mapas mentais;
- organizar referências e imagens;
- montar layouts rápidos para redes sociais;
- desenhar e editar formas e caminhos vetoriais;
- trabalhar em uma prancheta com tamanho e DPI definidos;
- exportar o resultado em formatos raster e vetoriais.

Tudo funciona localmente. Os projetos são armazenados em arquivos `.pcanvas`, sem nuvem, conta ou backend obrigatório.

## Principais recursos

### Canvas e documentos

- Canvas infinito com pan, zoom, grade, réguas e guias.
- Pranchetas de tamanho definido em `px`, `cm`, `mm` ou `m`.
- Presets para telas, redes sociais, mobile, A4, A3 e cartão.
- Orientação, DPI e fundo configuráveis na criação do documento.
- Projetos recentes, autosave local e formato editável `.pcanvas`.
- Histórico com undo/redo, agrupamento e multisseleção.

### Desenho e vetores

- Retângulo, elipse, losango, polígono e nota adesiva.
- Linhas, setas diretas ou ortogonais e conectores opcionais.
- Caneta vetorial com paths abertos/fechados e âncoras editáveis.
- Desenho livre, frames, imagens e recorte não destrutivo.
- Cantos de retângulos ajustáveis em conjunto ou individualmente com `Shift`.
- Preenchimento, stroke, espessura, tracejado, pontas e opacidade.
- SVG importado como paths, grupos e textos editáveis quando compatível.

### Texto

- **Texto ponto:** clique para criar texto livre em uma linha natural.
- **Texto parágrafo:** arraste para definir uma caixa com quebra de linha.
- Fontes instaladas no Windows carregadas diretamente no seletor.
- Família, peso, itálico, tamanho, tracking, entrelinha e alinhamento.
- Caixa de parágrafo redimensionável sem esticar a fonte.

### Organização e interface

- Painel de camadas com previews, renomeação, visibilidade, bloqueio e reordenação.
- Seleção múltipla com `Ctrl` e intervalo com `Shift`.
- Rolagem da lista de camadas durante o próprio drag and drop.
- Painel de propriedades redimensionável, recolhível e persistente.
- Cards minimizáveis e reordenáveis por arraste.
- Camadas encaixáveis no painel ou flutuantes sobre o canvas.
- Cinco temas, densidade da interface, grade e redução de animações.

### Alinhamento e precisão

- Smart guides magnéticas durante movimento e redimensionamento.
- Alinhamento por esquerda, centro, direita, topo, meio e base.
- Distribuição horizontal e vertical de múltiplos elementos.
- Réguas e guias reposicionáveis, bloqueáveis e não exportáveis.
- Campos numéricos digitáveis com confirmação por `Enter`.

## Formatos

| Formato | Abrir/importar | Editar | Salvar/exportar | Observação |
|---|:---:|:---:|:---:|---|
| `.pcanvas` | ✅ | ✅ | ✅ | Formato de projeto com maior fidelidade |
| `.svg` | ✅ | ✅ | ✅ | Vetor recomendado para intercâmbio |
| `.eps` | ✅ | Parcial | ✅ | Compatibilidade com comandos PostScript suportados |
| `.png` | ✅ | Como imagem | ✅ | Exportação no tamanho exato da prancheta |
| `.jpg/.jpeg` | ✅ | Como imagem | ✅ | DPI incorporado ao arquivo |
| `.webp` | ✅ | Como imagem | ✅ | Importação e exportação local |
| `.ai` | — | — | — | Exporte como SVG no Illustrator antes de abrir |

> O suporte parcial a `.ai` existiu em versões históricas, mas foi removido na `0.7.0` porque não preservava com fidelidade todos os grupos, objetos fora da prancheta e recursos proprietários do Illustrator.

## Download e instalação

1. Abra a página de [Releases](https://github.com/eentaocaedu/canvas-d/releases/latest).
2. Baixe `Canvas D Setup <versão>.exe`.
3. Execute o instalador e escolha a pasta de instalação.

O instalador ainda não possui certificado comercial de assinatura de código. Por isso, o Windows SmartScreen pode exibir um aviso de editor desconhecido. Os hashes SHA-256 estão publicados em cada Release para conferência.

Para novos usuários, use sempre a [versão mais recente](https://github.com/eentaocaedu/canvas-d/releases/latest). As versões anteriores permanecem disponíveis para histórico e testes de regressão.

## Uso rápido

1. Clique em **Novo projeto**.
2. Escolha **Canvas infinito** ou uma **Prancheta** dimensionada.
3. Selecione uma ferramenta na barra esquerda.
4. Ajuste suas propriedades antes ou depois da criação.
5. Organize os elementos no painel de camadas.
6. Salve com `Ctrl+S` ou exporte pelo menu de documento.

## Atalhos principais

| Atalho | Ação |
|---|---|
| `V` | Seleção |
| `H` | Mão/pan |
| `F` | Frame |
| `R` | Retângulo |
| `O` | Elipse |
| `D` | Losango |
| `U` | Polígono |
| `N` | Nota adesiva |
| `L` | Linha |
| `A` | Seta/conector |
| `B` | Caminho vetorial |
| `T` | Texto ponto ou parágrafo |
| `P` | Desenho livre |
| `I` | Imagem |
| `C` | Recortar imagem/SVG selecionado |
| `Ctrl+S` | Salvar projeto aberto |
| `Ctrl+Shift+S` | Salvar como |
| `Ctrl+Z` / `Ctrl+Shift+Z` | Desfazer/refazer |
| `Ctrl+G` / `Ctrl+Shift+G` | Agrupar/desagrupar |
| `Ctrl+R` | Mostrar/ocultar réguas |
| `Ctrl+,` | Configurações |
| `Ctrl+0` / `Ctrl+1` / `Ctrl+2` | Zoom padrão, 100% e enquadrar seleção |
| `Espaço + arrastar` | Navegar pelo canvas |
| `Alt + arrastar` | Duplicar elemento |

## Desenvolvimento

### Requisitos

- Windows 10 ou 11
- Node.js 20 ou superior
- npm

### Executar localmente

```bash
npm install
npm run dev
```

No PowerShell, caso a política de execução bloqueie o shim do npm, use `npm.cmd`:

```powershell
npm.cmd install
npm.cmd run dev
```

### Validar e empacotar

```powershell
npm.cmd run build
npm.cmd run smoke
npm.cmd run test:metadata
npm.cmd run dist
```

O instalador NSIS é gerado em `release/`. Essa pasta, assim como `node_modules/` e `out/`, não faz parte do controle de versão.

## Stack

- Electron e electron-vite
- React e TypeScript
- Konva e react-konva
- Zustand
- Tailwind CSS
- electron-builder / NSIS

## Estrutura do projeto

```text
src/
├── main/       # Janela Electron, arquivos, fontes e exportação
├── preload/    # Ponte IPC segura para o renderer
└── renderer/   # Interface React, canvas, ferramentas e stores
scripts/        # Smoke tests e validação de metadados raster
assets/         # Identidade visual original
build/          # Recursos do instalador Windows
```

## Histórico

Veja [CHANGELOG.md](CHANGELOG.md) para a descrição detalhada do que foi implementado em cada versão, da `0.1.0` à versão atual.

## Licença

Distribuído sob a [licença MIT](LICENSE).

