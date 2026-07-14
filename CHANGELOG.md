# Histórico de versões do Canvas D

Este arquivo registra as principais implementações de cada instalador publicado. Para uso normal, recomendamos sempre a [versão mais recente](https://github.com/eentaocaedu/canvas-d/releases/latest).

## 0.8.1 — Rolagem real durante o drag de camadas

**Data:** 14 de julho de 2026

- Substituição do drag nativo do Chromium por um arraste controlado no painel de camadas.
- Uso da roda do mouse enquanto a camada permanece pressionada.
- Continuidade do arraste após rolar a lista, sem perder o item selecionado.
- Reordenação efetivada somente ao soltar na posição desejada.
- Teste automatizado específico para o fluxo pressionar, arrastar, rolar e soltar.

## 0.8.0 — Painéis configuráveis, preferências e temas

**Data:** 14 de julho de 2026

- Painel de Propriedades redimensionável e completamente recolhível.
- Cards minimizáveis e reordenáveis por drag and drop.
- Ordem padrão contextual: Transformação primeiro e Exportação por último.
- Barra compacta com ícones que abrem cards temporariamente.
- Fechamento do card temporário ao clicar novamente no canvas.
- Painel de Camadas encaixável nas Propriedades ou flutuante.
- Camadas flutuantes com fechamento ao clicar fora.
- Indicador de destino, auto-scroll nas bordas e suporte inicial à roda durante drag.
- Modal de Configurações acessível por `Edit`, menu interno e `Ctrl+,`.
- Temas Midnight, Grafite, OLED preto, Light frio e Light areia.
- Preferências de densidade, grade, movimento reduzido e painéis.
- Persistência global do layout e da aparência entre sessões.

## 0.7.0 — Fluxo vetorial confiável e remoção do AI parcial

**Data:** 14 de julho de 2026

- Remoção de `.ai` dos menus Abrir, Salvar como e Exportar.
- Remoção do parser PDF/AI e da dependência pesada associada.
- Mensagem orientando a exportação do arquivo AI como SVG no Illustrator.
- SVG consolidado como formato vetorial editável recomendado.
- EPS mantido como intercâmbio vetorial legado.
- Redução do tamanho do pacote e eliminação de um suporte que não preservava o documento integral.

## 0.6.1 — Correção do importador AI/PDF histórico

**Data:** 14 de julho de 2026

> Versão histórica. O suporte a AI foi removido posteriormente na `0.7.0`.

- Correção do erro `hashOriginal.toHex is not a function` ao abrir AI PDF-compatível.
- Ajuste do encerramento do parser PDF.
- Preservação do buffer original para os fallbacks do importador.
- Carregamento sob demanda do parser apenas ao abrir AI/PDF.
- Smoke test com AI compatível convertido em path, seguido de EPS e WebP.

## 0.6.0 — Inspetor redesenhado e exportação precisa

**Data:** 14 de julho de 2026

- Campos numéricos digitáveis com aplicação por `Enter` e ajuste por setas.
- Redesign completo do painel lateral para todas as ferramentas.
- Hierarquia visual, agrupamento e dimensões dos controles refinados.
- Arredondamento do retângulo por número, setas ou slider.
- Pranchetas renderizadas com cantos retos.
- PNG, JPEG e WebP exportados exatamente no tamanho em pixels da prancheta.
- DPI incorporado como metadado sem alterar a resolução solicitada.
- Exportação contextual disponível para objeto único ou seleção múltipla.
- Opções vetoriais SVG, EPS e AI compatível visíveis no fluxo histórico.
- Testes automatizados de metadados raster em 300 DPI.

## 0.5.0 — Novo documento e pranchetas dimensionadas

**Data:** 14 de julho de 2026

- Modal de Novo projeto com escolha entre canvas infinito e prancheta.
- Tamanho personalizado em pixels, centímetros, milímetros ou metros.
- Presets Full HD, Desktop, Mobile, Instagram, A4, A3 e cartão.
- Orientação horizontal e vertical.
- DPI em 72, 96, 150, 300 ou valor personalizado.
- Fundo transparente, branco, escuro ou personalizado.
- Prévia da resolução final em pixels.
- Persistência da última configuração utilizada.
- Dimensões e DPI mostrados no painel de propriedades.
- Enquadramento automático da prancheta ao criar o documento.

## 0.4.1 — Recuperação da tela inicial

**Data:** 14 de julho de 2026

- Correção da tela preta causada por um `require` CommonJS no renderer isolado.
- Correção de erro no tratamento global do teclado.
- Tela de recuperação para futuras falhas de inicialização.
- Cobertura automatizada da home, recentes, caminhos, novo projeto e abertura.
- Smoke test ampliado para ferramentas, texto, vetores, camadas, clipboard e atalhos.

## 0.4.0 — Documentos vetoriais, WebP e menu de arquivo

**Data:** 14 de julho de 2026

> O suporte experimental a AI desta versão foi removido na `0.7.0` por limitações de fidelidade.

- SVG aberto ou arrastado convertido em paths, grupos e textos editáveis.
- Leitura vetorial própria para EPS e AI PostScript compatível.
- Importação experimental de AI com PDF incorporado.
- Edição de fill, stroke, espessura, nós e controles Bézier.
- Exportação local em SVG e EPS.
- Abertura, inserção e exportação em WebP.
- Novo menu visual de Arquivo e Exportação.
- `Ctrl+S` para atualizar PCanvas, SVG ou EPS aberto.
- `Ctrl+Shift+S` com seleção de PCanvas, SVG, EPS, WebP, PNG e JPEG.
- Avisos explícitos para gradientes, máscaras ou recursos não suportados.

## 0.3.1 — Estabilidade, texto, exportação e recorte

**Data:** 13 de julho de 2026

- Remoção do atraso causado pelo cursor personalizado.
- Conexão automática de setas transformada em opção, desligada por padrão.
- Fill, stroke e espessura aplicáveis a múltiplas formas selecionadas.
- Correção do texto de parágrafo que esticava junto com a caixa.
- Indicador visual da área de parágrafo durante a criação.
- Seletor abastecido pelas fontes instaladas no Windows.
- Cantos independentes com `Shift`; sem modificador, todos mudam juntos.
- Correção da forma criada acidentalmente ao soltar o controle de canto.
- Limpeza correta das smart guides ao concluir ou interromper gestos.
- Indicador e animação de destino no drag de camadas.
- Scroll por roda e auto-scroll nas bordas do painel de camadas.
- Escrita validada dos bytes PNG/JPEG para evitar arquivos corrompidos.
- Inclusão de elementos bloqueados e imagens na exportação.
- Importação SVG por seletor, clipboard e drag and drop.
- Nova ferramenta de recorte para imagens e SVGs.
- SVG exportado respeitando crop e raios individuais.

## 0.3.0 — Grande evolução de texto e vetores

**Data:** 10 de julho de 2026

- Separação entre texto ponto por clique e texto parágrafo por arraste.
- Fontes do Windows, peso, itálico, tracking, entrelinha, alinhamento e decoração.
- Persistência de cores e estilos entre ferramentas e sessões.
- Ctrl-click para alternar camadas e Shift-click para selecionar intervalo.
- Novas formas: losango, polígono configurável e nota adesiva.
- Caminhos vetoriais abertos/fechados com âncoras editáveis.
- Controles visuais de arredondamento nos quatro cantos.
- Setas diretas/ortogonais, pontas configuráveis e conexão automática.
- Linhas sólidas, tracejadas ou pontilhadas.
- Bloqueio de proporção para imagens.
- Exportação PNG, JPEG e SVG vetorial.
- Melhorias em autosave, undo/redo, objetos rotacionados, atalhos e nudge por setas.

## 0.1.9 — Identidade visual e primeira evolução tipográfica

**Data:** 10 de julho de 2026

- Ícone oficial aplicado ao executável, aplicativo e instalador NSIS.
- Conversão da identidade SVG para um `.ico` compatível com Windows.
- Cursores corretos nos pontos de redimensionamento.
- Primeira revisão do fluxo de texto ponto/parágrafo e das métricas do editor.
- Base para enumeração de fontes locais e propriedades tipográficas ampliadas.
- Build final desta versão recompilado após os ajustes de texto.

## 0.1.8 — Clipboard interno e drag and drop confiável

**Data:** 9 de julho de 2026

- Prioridade para elementos copiados dentro do Canvas D no `Ctrl+V`.
- Imagem do clipboard usada somente quando não há cópia interna válida.
- Drag and drop global aceitando explicitamente arquivos da pasta.
- Correção do bloqueio que impedia importar imagens arrastadas.

## 0.1.7 — Fluxo de teclado, nomes e importação de imagens

**Data:** 9 de julho de 2026

- Bloqueio do `Tab` fora de campos editáveis para não mover foco pelo chrome do app.
- Sincronização do nome do projeto com o arquivo `.pcanvas` salvo ou aberto.
- Paste de imagem tratado no nível da janela.
- Importação de imagens por arrastar e soltar.
- Primeira implementação da precedência entre clipboard interno e imagem externa.

## 0.1.6 — Histórico, cursores e controles mais claros

**Data:** 9 de julho de 2026

- Histórico ignorando snapshots duplicados e ações sem mudança real.
- Drag e resize gravados como uma única operação concluída.
- Cursor de precisão com ícone contextual da ferramenta.
- `CapsLock` alternando para cursor de precisão puro.
- Estados ativos/inativos visíveis em toolbar, réguas, snap, lock e visibilidade.
- Passo decimal `0.1` nos campos numéricos aplicáveis.

## 0.1.5 — Multisseleção rígida e snap no resize

**Data:** 9 de julho de 2026

- Arraste de múltiplos objetos usando um único delta.
- Preservação exata do espaçamento interno durante a movimentação.
- Smart guides considerando a caixa total da seleção.
- Snap contra todos os objetos visíveis e guias do canvas.
- Smart guides e magnetismo também durante redimensionamento.

## 0.1.4 — Grupos e undo consistente

**Data:** 9 de julho de 2026

- Grupos reais com filhos embutidos no modelo do documento.
- Movimento e redimensionamento proporcional do grupo.
- Preview de grupo no painel de camadas.
- Exportação e duplicação preservando grupos.
- `Ctrl+G` para agrupar e `Ctrl+Shift+G` para desagrupar.
- Undo/redo preservando seleção válida e câmera atual.
- Coalescimento de mudanças contínuas de cor em um único passo.

## 0.1.3 — Correções de pan e criação sobre elementos

**Data:** 9 de julho de 2026

- Correção do “teletransporte” ao soltar o mouse durante `Espaço + arrastar`.
- Eliminação do pan fantasma após o fim da interação.
- Clique em objeto compatível mantendo seleção e handles.
- Click-drag sobre objetos permitindo criar uma nova forma por cima.
- Transformer protegido contra criação acidental.

## 0.1.2 — Camadas visuais e produtividade

**Data:** 9 de julho de 2026

- Correção do clique da ferramenta Texto sobre texto existente.
- Preview translúcido ao puxar uma guia da régua.
- Reposicionamento de guias desbloqueadas por arraste.
- Alinhamento e distribuição de múltiplos objetos.
- `Alt + arrastar` para duplicar.
- Undo preservando zoom/pan e agrupando edições contínuas.
- Miniaturas diferentes por tipo no painel de camadas.
- Texto da própria camada como nome, com truncamento seguro.
- Altura do painel de camadas ajustável pela borda inferior.

## 0.1.1 — Inspetor contextual, camadas, réguas e guias

**Data:** 9 de julho de 2026

- Seleção de texto existente sem criar outro elemento por cima.
- Transformer disponível com ferramentas de criação ativas.
- Pan prioritário sobre objetos ao segurar Espaço.
- Propriedades da ferramenta visíveis antes da criação.
- Opção de preenchimento e stroke sem cor.
- Painel flutuante de camadas com seleção, visibilidade, lock e reordenação.
- Réguas ativadas por `Ctrl+R` e guias puxadas das réguas.
- Inspector de guia com posição, bloqueio, visibilidade e remoção.
- Smart guides magenta e snap básico.
- Guias persistidas no documento `.pcanvas`.

## 0.1.0 — MVP desktop

**Data:** 9 de julho de 2026

- Aplicativo Electron local para Windows.
- Home com novo projeto, abertura e lista de recentes.
- Canvas infinito com pan, zoom e grade pontilhada.
- Frames, retângulos, elipses, texto, linhas, setas, freehand e imagens.
- Seleção, movimento, redimensionamento e rotação com Transformer.
- Barra de ferramentas, painel de propriedades e status bar.
- Histórico inicial, autosave e persistência `.pcanvas`.
- Exportação PNG.
- Instalador Windows NSIS com escolha de diretório.

