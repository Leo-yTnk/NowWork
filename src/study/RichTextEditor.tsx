import { useRef, useState, type CSSProperties } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, ArrowDown, ArrowLeft, ArrowUp, Bold, Clipboard, Code2, Columns2, Copy, Eraser, Highlighter, IndentDecrease, IndentIncrease, Merge, Rows2, Split,
  ImagePlus, Italic, LayoutGrid, Link2, List, ListChecks, ListOrdered, Minus, Plus, Quote, Redo2, Scissors, SlidersHorizontal, Strikethrough, Subscript, Superscript, Table2, Trash2, Underline, Undo2, Type } from 'lucide-react';
import type { JSONContent } from '@tiptap/core';
import { NodeSelection, TextSelection, type Selection } from '@tiptap/pm/state';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { EditorView } from '@tiptap/pm/view';
import { closeHistory } from '@tiptap/pm/history';
import { collectionTypes, createCollection, type CollectionKind } from '../lib/collections';
import { importLocalImage } from '../lib/localImages';
import { blockViews, collectionIcons, editDocumentBlock } from './collections/DocumentBlocks';
import { Options } from './collections/Fields';
import { Button, IconButton, Toolbar } from '../components/ui';
import { Select } from '../components/Select';
import { documentExtensions, safeLink } from '../lib/documents';
import { copyNoteSelection, pasteNoteSelection } from '../lib/noteClipboard';
import { useApp } from '../state/AppState';
import { editorTextStyles, editorTypographyVariables, editorWeightLabel, findEditorFont } from '../lib/editorTypography';
import { selectionTypography } from '../lib/selectionTypography';
import { FontSelect } from './EditorFontFields';
import { canMoveBlock, moveBlock } from '../lib/editorBlocks';
import { EditorActionButton, NotebookToolbar, useMobileEditor, type EditorAction, type ToolGroup, type ToolCategory } from './NotebookToolbar';

const styleOptions: [string, string][] = editorTextStyles
  .filter(([style]) => style === 'p' || /^h[1-6]$/.test(style))
  .map(([style, label]): [string, string] => [style === 'p' ? '0' : style.slice(1), label])
  .sort(([a], [b]) => Number(a) - Number(b));
const weightOptions = [100, 200, 300, 400, 500, 600, 700, 800, 900];
const inkColors = [['Vinho', '#a52343'], ['Laranja', '#a34e20'], ['Verde', '#237456'], ['Azul', '#315bb1'], ['Roxo', '#7845a9']];
const highlightColors = [['Amarelo', '#f7e39b'], ['Verde', '#a9ebca'], ['Azul', '#b6d9ff'], ['Violeta', '#dcc7ff'], ['Rosa', '#ffbfd7']];

const extensions = documentExtensions.map((extension) =>
  extension.name === 'collection' ? blockViews.collection : extension.name === 'noteImage' ? blockViews.noteImage : extension);

function selectionBeforeBlur(view: EditorView): Selection {
  const { doc, selection } = view.state;
  const browser = view.dom.ownerDocument.getSelection();
  if (!(selection instanceof TextSelection) || !browser?.anchorNode || !browser.focusNode
    || !view.dom.contains(browser.anchorNode) || !view.dom.contains(browser.focusNode)) return selection;
  // The DOM can receive a selection change before ProseMirror's observer has flushed it.
  const anchor = doc.resolve(view.posAtDOM(browser.anchorNode, browser.anchorOffset));
  const head = doc.resolve(view.posAtDOM(browser.focusNode, browser.focusOffset));
  return anchor.parent.inlineContent && head.parent.inlineContent
    ? new TextSelection(anchor, head) : selection;
}

export function RichTextEditor({ content, onChange }: { content: JSONContent; onChange: (content: JSONContent) => void }) {
  const [toolPanel, setToolPanel] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [invalidLink, setInvalidLink] = useState(false);
  const [sizeDraft, setSizeDraft] = useState<string | null>(null);
  const [popover, setPopover] = useState<'ink' | 'highlight' | null>(null);
  const { notify, data } = useApp();
  const fileInput = useRef<HTMLInputElement>(null);
  const blurredSelection = useRef<{ doc: PMNode; selection: Selection }>(null);
  const mobile = useMobileEditor();
  const editor = useEditor({
    extensions,
    content,
    editorProps: {
      attributes: { 'aria-label': 'Conteúdo da página', role: 'textbox', 'data-notebook-editor': '', 'aria-multiline': 'true', lang: 'pt-BR' },
      handleDOMEvents: {
        blur: (view) => {
          blurredSelection.current = { doc: view.state.doc, selection: selectionBeforeBlur(view) };
          return false;
        },
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  });
  const tools = useEditorState({
    editor,
    selector: ({ editor }) => {
      if (!editor) return null;
      const taskItem = editor.isActive('taskItem');
      const list = taskItem || editor.isActive('listItem');
      const listItem = taskItem ? 'taskItem' : 'listItem';
      const textStyle = editor.getAttributes('textStyle');
      const selection = editor.state.selection;
      const selectedBlock = selection instanceof NodeSelection ? selection.node.type.name : null;
      const heading = editor.isActive('heading');
      const block = editor.getAttributes(heading ? 'heading' : 'paragraph');
      const typography = selectionTypography(editor.state, data.profile.editorTypography);
      const indent = Number(block.indent) || 0;
      const markState = (name: Parameters<typeof typography.mark>[0]) => {
        const state = typography.mark(name);
        return state === 'Misto' ? 'mixed' as const : state;
      };
      return {
        list, block, textStyle, selectedBlock, level: typography.level, weight: typography.weight,
        fontFamily: typography.fontFamily, fontSize: typography.fontSize,
        canStyle: !selectedBlock && (editor.can().setParagraph() || editor.can().setHeading({ level: 1 })),
        canWeight: editor.can().setMark('textStyle'),
        pageWidth: editor.state.doc.attrs.noteWidth ?? 'standard',
        superscript: markState('superscript'), subscript: markState('subscript'), highlightColor: editor.getAttributes('highlight').color,
        bold: markState('bold'), italic: markState('italic'), underline: markState('underline'),
        strike: markState('strike'), highlight: editor.isActive('highlight'),
        bullet: editor.isActive('bulletList'), ordered: editor.isActive('orderedList'), task: editor.isActive('taskList'),
        quote: editor.isActive('blockquote'), code: editor.isActive('codeBlock'), link: editor.isActive('link'),
        selected: !editor.state.selection.empty, table: editor.isActive('table'),
        canAddRow: editor.can().addRowAfter(), canAddColumn: editor.can().addColumnAfter(),
        canAddRowBefore: editor.can().addRowBefore(), canAddColumnBefore: editor.can().addColumnBefore(),
        canDeleteRow: editor.can().deleteRow(), canDeleteColumn: editor.can().deleteColumn(),
        canMergeCells: editor.can().mergeCells(), canSplitCell: editor.can().splitCell(),
        canAlign: editor.isActive('paragraph') || editor.isActive('heading'),
        canUndo: editor.can().undo(), canRedo: editor.can().redo(), listItem,
        canIndent: list ? editor.can().sinkListItem(listItem) : indent < 6,
        canOutdent: list ? editor.can().liftListItem(listItem) : indent > 0,
        canMoveUp: canMoveBlock(editor.state, -1), canMoveDown: canMoveBlock(editor.state, 1),
      };
    },
  });

  if (!editor || !tools) return null;
  const selectionChain = () => {
    const chain = editor.chain();
    const saved = blurredSelection.current;
    if (!editor.view.hasFocus() && saved?.doc === editor.state.doc && !saved.selection.eq(editor.state.selection)) {
      chain.command(({ tr }) => { tr.setSelection(saved.selection); return true; });
    }
    return chain;
  };
  const focus = () => selectionChain().focus(undefined, { scrollIntoView: false });
  const closeTools = () => { setToolPanel(null); setPopover(null); };
  const closeLink = () => { closeTools(); setLink(null); setInvalidLink(false); focus().run(); };
  const applyLink = (event: React.FormEvent) => {
    event.preventDefault();
    const href = safeLink(link?.trim() || '');
    if (!href) { setInvalidLink(true); return; }
    if (editor.state.selection.empty && !editor.isActive('link')) {
      focus().insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] }).run();
    } else focus().extendMarkRange('link').setLink({ href }).run();
    closeLink();
  };
  const reorder = (direction: -1 | 1) => {
    const transaction = moveBlock(editor.state, direction);
    if (transaction) editor.view.dispatch(transaction);
    editor.commands.focus();
  };

  const marks: EditorAction[] = [
    { label: 'Negrito', icon: <Bold size={18} />, pressed: tools.bold, run: () => focus().toggleBold().run() },
    { label: 'Itálico', icon: <Italic size={18} />, pressed: tools.italic, run: () => focus().toggleItalic().run() },
    { label: 'Sublinhado', icon: <Underline size={18} />, pressed: tools.underline, run: () => focus().toggleUnderline().run() },
    { label: 'Tachado', icon: <Strikethrough size={18} />, pressed: tools.strike, run: () => focus().toggleStrike().run() },
    { label: 'Sobrescrito', icon: <Superscript size={18} />, pressed: tools.superscript, run: () => focus().toggleMark('superscript').run() },
    { label: 'Subscrito', icon: <Subscript size={18} />, pressed: tools.subscript, run: () => focus().toggleMark('subscript').run() },
  ];
  const lists: EditorAction[] = [
    { label: 'Lista com marcadores', icon: <List size={18} />, pressed: tools.bullet, run: () => focus().toggleBulletList().run() },
    { label: 'Lista numerada', icon: <ListOrdered size={18} />, pressed: tools.ordered, run: () => focus().toggleOrderedList().run() },
    { label: 'Lista de tarefas', icon: <ListChecks size={18} />, pressed: tools.task, run: () => focus().toggleTaskList().run() },
  ];
  const quote: EditorAction = { label: 'Citação', icon: <Quote size={18} />, pressed: tools.quote, run: () => { closeTools(); focus().toggleBlockquote().run(); } };
  const code: EditorAction = { label: 'Bloco de código', icon: <Code2 size={18} />, pressed: tools.code, run: () => { closeTools(); focus().toggleCodeBlock().run(); } };
  const linkAction: EditorAction = { label: 'Inserir ou editar link', icon: <Link2 size={18} />, pressed: tools.link,
    run: () => { setPopover(null); setInvalidLink(false); setLink(editor.getAttributes('link').href || ''); } };
  const history: EditorAction[] = [
    { label: 'Desfazer', icon: <Undo2 size={18} />, disabled: !tools.canUndo, run: () => focus().undo().run() },
    { label: 'Refazer', icon: <Redo2 size={18} />, disabled: !tools.canRedo, run: () => focus().redo().run() },
  ];
  const align = ([
    ['left', 'Alinhar à esquerda', AlignLeft], ['center', 'Centralizar', AlignCenter],
    ['right', 'Alinhar à direita', AlignRight], ['justify', 'Justificar', AlignJustify],
  ] as const).map(([alignment, label, Icon]) => ({
    label, icon: <Icon size={18} />, pressed: (tools.block.textAlign || 'left') === alignment,
    disabled: !tools.canAlign, run: () => focus().setTextAlign(alignment).run(),
  })) satisfies EditorAction[];
  const indent = (direction: 1 | -1) => {
    if (tools.list) {
      if (direction === 1) focus().sinkListItem(tools.listItem).run();
      else focus().liftListItem(tools.listItem).run();
      return;
    }
    const { doc, selection, tr } = editor.state;
    if (selection.empty && !selection.$from.depth) return;
    const from = selection.empty ? selection.$from.before() : selection.from;
    const to = selection.empty ? Math.min(from + 1, doc.content.size) : selection.to;
    doc.nodesBetween(from, to, (node, pos) => {
      if (node.type.name === 'paragraph' || node.type.name === 'heading') {
        const next = Math.max(0, Math.min(6, (Number(node.attrs.indent) || 0) + direction));
        if (next !== node.attrs.indent) tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next });
        return false;
      }
    });
    if (tr.docChanged) editor.view.dispatch(tr);
    focus().run();
  };
  const blocks: EditorAction[] = [
    { label: 'Aumentar recuo', icon: <IndentIncrease size={18} />, disabled: !tools.canIndent || (!tools.list && !tools.canAlign), run: () => indent(1) },
    { label: 'Reduzir recuo', icon: <IndentDecrease size={18} />, disabled: !tools.canOutdent || (!tools.list && !tools.canAlign), run: () => indent(-1) },
    { label: 'Mover bloco para cima', icon: <ArrowUp size={18} />, disabled: !tools.canMoveUp, run: () => reorder(-1) },
    { label: 'Mover bloco para baixo', icon: <ArrowDown size={18} />, disabled: !tools.canMoveDown, run: () => reorder(1) },
  ];
  const table: EditorAction[] = [
    { label: 'Adicionar linha acima', icon: <span className="note-table-icon">L<ArrowUp size={11} /></span>, disabled: !tools.canAddRowBefore, run: () => focus().addRowBefore().run() },
    { label: 'Adicionar linha abaixo', icon: <span className="note-table-icon">L<Plus size={11} /></span>, disabled: !tools.canAddRow, run: () => focus().addRowAfter().run() },
    { label: 'Adicionar coluna à esquerda', icon: <span className="note-table-icon">C<ArrowLeft size={11} /></span>, disabled: !tools.canAddColumnBefore, run: () => focus().addColumnBefore().run() },
    { label: 'Adicionar coluna à direita', icon: <span className="note-table-icon">C<Plus size={11} /></span>, disabled: !tools.canAddColumn, run: () => focus().addColumnAfter().run() },
    { label: 'Excluir linha atual', icon: <span className="note-table-icon">L<Minus size={11} /></span>, disabled: !tools.canDeleteRow, run: () => focus().deleteRow().run() },
    { label: 'Excluir coluna atual', icon: <span className="note-table-icon">C<Minus size={11} /></span>, disabled: !tools.canDeleteColumn, run: () => focus().deleteColumn().run() },
    { label: 'Excluir tabela', icon: <Trash2 size={18} />, run: () => focus().deleteTable().run() },
  ];
  const insertTable: EditorAction = { label: 'Inserir tabela', icon: <Table2 size={19} />, disabled: tools.table,
    run: () => { closeTools(); focus().insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run(); } };
  const group = (actions: EditorAction[]) => actions.map((action) => <EditorActionButton key={action.label} action={action} />);
  const linkForm = link === null ? undefined : <form className="document-link-form" onSubmit={applyLink}
    onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); closeLink(); } }}>
    <label className="field-label">Endereço do link
      <input autoFocus type="url" required maxLength={2048} className="ds-input" placeholder="https://…" value={link}
        aria-invalid={invalidLink} onChange={(event) => { setLink(event.target.value); setInvalidLink(false); }} />
    </label>
    {invalidLink && <small role="alert">Use um endereço http, https ou mailto válido.</small>}
    <Toolbar><Button type="submit" size="sm" variant="primary">Aplicar link</Button>
      {tools.link && <Button size="sm" onClick={() => { focus().extendMarkRange('link').unsetLink().run(); closeLink(); }}>Remover link</Button>}
      {safeLink(link) && <a href={safeLink(link) || undefined} target="_blank" rel="noopener noreferrer">Abrir link</a>}
      <Button size="sm" variant="ghost" onClick={closeLink}>Cancelar</Button></Toolbar>
  </form>;

  const paste = () => {
    setPopover(null);
    void pasteNoteSelection(editor).catch(() => {
      notify('Use o atalho ou o menu do navegador para colar.');
      if (!editor.isDestroyed) focus().run();
    });
  };
  const copy = (cut: boolean) => {
    void copyNoteSelection(editor, cut).catch(() => notify(cut ? 'Use o atalho ou o menu do navegador para recortar.' : 'Use o atalho ou o menu do navegador para copiar.'));
  };
  const toggle = (kind: typeof popover) => {
    setLink(null);
    setPopover((previous) => previous === kind ? null : kind);
  };
  const clipboard: EditorAction[] = [
    { label: 'Colar', icon: <Clipboard size={17} />, run: paste },
    { label: 'Copiar', icon: <Copy size={17} />, disabled: !tools.selected, run: () => copy(false) },
    { label: 'Recortar', icon: <Scissors size={17} />, disabled: !tools.selected, run: () => copy(true) },
  ];
  const styleControl = <Select label="Estilo" value={String(tools.level)} options={styleOptions}
    displayValue={tools.level === 'Misto' ? 'Misto' : undefined} disabled={!tools.canStyle} returnFocus={false}
    onChange={(value) => {
      const level = Number(value) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
      setPopover(null);
      setLink(null);
      const chain = focus();
      if (level === 0) chain.setParagraph().run();
      else chain.setHeading({ level }).run();
    }} />;
  const fontFamily = tools.fontFamily === 'Misto' ? '' : tools.fontFamily ?? '';
  const inlineFont = findEditorFont(fontFamily);
  const fontSelect = <FontSelect returnFocus={false} value={inlineFont?.name ?? fontFamily} mixed={tools.fontFamily === 'Misto'} onChange={(name) => {
    const font = findEditorFont(name);
    const chain = focus();
    (font ? chain.setFontFamily(font.family) : chain.unsetFontFamily()).run();
  }} />;
  const availableWeights = tools.weight === 'Misto' || weightOptions.includes(tools.weight)
    ? weightOptions : [...weightOptions, tools.weight].sort((a, b) => a - b);
  const weightChoices: [string, string][] = [['', 'Padrão'], ...availableWeights.map((weight): [string, string] =>
    [String(weight), editorWeightLabel(weight)])];
  const weightField = <Select label="Peso da fonte" value={String(tools.weight)} options={weightChoices}
    displayValue={tools.weight === 'Misto' ? 'Misto' : undefined} disabled={!tools.canWeight} returnFocus={false}
    onChange={(value) => {
      setPopover(null);
      setLink(null);
      const chain = focus();
      if (value) chain.unsetBold();
      chain.setMark('textStyle', { fontWeight: value ? Number(value) : null }).removeEmptyTextStyle().run();
    }} />;
  const mixedSize = tools.fontSize === 'Misto';
  const activeSize = mixedSize ? '' : String(tools.fontSize ?? '').replace(/px$/, '');
  const applySize = (refocus: boolean) => {
    if (sizeDraft === null) return;
    setSizeDraft(null);
    const value = sizeDraft.trim().replace(',', '.').replace(/px$/i, '').trim();
    if (value && (!/^\d+(?:\.\d+)?$/.test(value) || Number(value) <= 0 || Number(value) > 2000)) {
      notify('Use um tamanho entre 0 e 2000 pixels.');
      return;
    }
    const chain = refocus ? focus() : selectionChain();
    (value ? chain.setFontSize(Number(value) + 'px') : chain.unsetFontSize()).run();
  };
  const sizeInput = <input className="ds-input note-size-input" aria-label="Tamanho da fonte" title="Tamanho em pixels"
    inputMode="decimal" data-mixed={mixedSize} placeholder={mixedSize ? 'Misto' : 'Auto'} value={sizeDraft ?? activeSize} onChange={(event) => setSizeDraft(event.target.value)}
    onBlur={() => applySize(false)} onKeyDown={(event) => {
      if (event.key === 'Enter') { event.preventDefault(); applySize(true); }
      if (event.key === 'Escape') { event.preventDefault(); setSizeDraft(null); }
    }} />;
  const colorActions: EditorAction[] = [
    { label: 'Cor do texto', icon: <span className="note-ink-icon" style={{ borderColor: tools.textStyle.color || undefined }}>A</span>, pressed: popover === 'ink', run: () => toggle('ink') },
    { label: 'Cor de fundo', icon: <Highlighter size={18} />, pressed: tools.highlight || popover === 'highlight', run: () => toggle('highlight') },
  ];
  const clear: EditorAction = { label: 'Limpar formatação', icon: <Eraser size={18} />, run: () => focus().unsetAllMarks().clearNodes().run() };
  const separator: EditorAction = { label: 'Inserir separador', icon: <Minus size={18} />, run: () => { closeTools(); focus().setHorizontalRule().run(); } };
  const insertContent = (item: JSONContent) => {
    closeTools();
    focus().command(({ tr }) => { closeHistory(tr); return true; }).insertContent(item).run();
  };
  const insertSet = (kind: CollectionKind) => insertContent({ type: 'collection', attrs: { value: createCollection(kind) } });
  const insertImage: EditorAction = { label: 'Inserir imagem', icon: <ImagePlus size={19} />,
    run: () => { closeTools(); fileInput.current?.click(); } };
  const contextualBlock = tools.selectedBlock === 'collection' || tools.selectedBlock === 'noteImage';
  const propertyAction: EditorAction = { label: tools.selectedBlock === 'collection' ? 'Configurar conjunto selecionado' : 'Propriedades da imagem',
    icon: <SlidersHorizontal size={17} />, run: () => {
      const root = editor.view.nodeDOM(editor.state.selection.from);
      const view = root instanceof Element ? root.matches('[data-node-view-wrapper]') ? root : root.querySelector('[data-node-view-wrapper]') : null;
      view?.dispatchEvent(new Event(editDocumentBlock));
    } };
  const lineHeight = <Select label="Altura da linha" returnFocus={false} value={tools.textStyle.lineHeight ?? ''}
    options={[[ '', 'Padrão'], ['1', 'Simples'], ['1.25', '1,25'], ['1.5', '1,5'], ['2', 'Duplo']]}
    onChange={(value) => (value ? focus().setLineHeight(value) : focus().unsetLineHeight()).run()} />;
  const pageWidth = <Options label="Largura do conteúdo" value={tools.pageWidth}
    options={[[ 'narrow', 'Estreita'], ['standard', 'Padrão'], ['wide', 'Ampla']]}
    onChange={(value) => {
      if (value === tools.pageWidth) return;
      editor.view.dispatch(closeHistory(editor.state.tr.setDocAttribute('noteWidth', value === 'standard' ? null : value)));
    }} />;
  const insertSets = Object.entries(collectionTypes).map(([key, definition]): EditorAction => {
    const kind = key as CollectionKind;
    const Icon = collectionIcons[kind];
    return { label: 'Inserir ' + definition.label.toLocaleLowerCase('pt-BR'), icon: <Icon size={17} />, run: () => insertSet(kind) };
  });
  const insertion = <div className="note-ribbon-insertion" role="group" aria-label="Inserir">
    <div className="note-insert-actions">{group([insertImage, insertTable, linkAction, ...insertSets, quote, code, separator])}</div>
  </div>;
  const cellActions: EditorAction[] = [
    { label: 'Alternar cabeçalho da primeira linha', icon: <Rows2 size={18} />, run: () => focus().toggleHeaderRow().run() },
    { label: 'Alternar cabeçalho da primeira coluna', icon: <Columns2 size={18} />, run: () => focus().toggleHeaderColumn().run() },
    { label: 'Mesclar células selecionadas', icon: <Merge size={18} />, disabled: !tools.canMergeCells, run: () => focus().mergeCells().run() },
    { label: 'Dividir célula mesclada', icon: <Split size={18} />, disabled: !tools.canSplitCell, run: () => focus().splitCell().run() },
  ];
  const context: ToolGroup[] = tools.table ? [
    { label: 'Linhas e colunas', rows: [group(table)] },
    { label: 'Cabeçalhos e células', rows: [group(cellActions)] },
    { label: 'Fórmulas', rows: [<div className="note-formula-help">
      <p>Digite <code>=</code> e a fórmula em uma célula. As colunas começam em A e as linhas em 1, incluindo o cabeçalho.</p>
      <p><code>=SOMA(A2:A5)</code>, <code>=MÉDIA(B2:B5)</code> ou <code>=A2*B2</code>. Separe argumentos com <code>;</code> e escreva decimais com vírgula.</p>
      <p>Também aceita <code>MÍNIMO</code>, <code>MÁXIMO</code>, <code>CONT.NÚM</code>, parênteses e porcentagens.</p>
    </div>] },
  ]
    : contextualBlock ? [{ label: 'Elemento selecionado', rows: [group([propertyAction])] }] : [];
  const supplemental: ToolGroup[] = [{ label: 'Página', rows: [pageWidth] }];
  const textActions = [...marks, ...colorActions, clear];
  const categories: ToolCategory[] = [
    { id: 'format', label: 'Texto', icon: <Type size={19} />, groups: [
      { label: 'Estilo e fonte', rows: [<>{styleControl}{fontSelect}{weightField}{sizeInput}</>, group(textActions)] },
      { label: 'Listas e parágrafo', rows: [group(lists), <>{group(align)}{lineHeight}</>, group(blocks.slice(0, 2))] },
      ...supplemental,
      { label: 'Área de transferência', rows: [group(clipboard)] },
    ] },
    ...(context.length ? [{ id: 'context', label: tools.table ? 'Tabela' : tools.selectedBlock === 'collection' ? 'Conjunto' : 'Imagem',
      icon: tools.table ? <Table2 size={18} /> : <SlidersHorizontal size={18} />, groups: context }] : []),
  ];
  const ribbon = <>
    <div className="note-ribbon-clipboard" role="group" aria-label="Área de transferência">
      <Button variant="ghost" size="sm" className="note-ribbon-paste" icon={clipboard[0].icon}
        onMouseDown={(event) => event.preventDefault()} onClick={clipboard[0].run}>Colar</Button>
      <EditorActionButton action={clipboard[1]} />
      <EditorActionButton action={clipboard[2]} />
    </div>
    <div className="note-ribbon-font" role="group" aria-label="Estilo e fonte">
      <div className="note-ribbon-font-selects">{styleControl}{fontSelect}{weightField}{sizeInput}</div>
      <div className="note-ribbon-marks">{group(textActions)}</div>
    </div>
    <div className="note-ribbon-paragraph" role="group" aria-label="Parágrafo">
      <div>{group(align)}{lineHeight}</div>
      <div>{group([...lists, ...blocks.slice(0, 2)])}</div>
    </div>
  </>;
  const title = popover === 'ink' ? 'Cor do texto' : 'Cor de fundo';
  const setColor = (color?: string) => {
    setPopover(null);
    const chain = focus();
    if (popover === 'ink') (color ? chain.setColor(color) : chain.unsetColor()).run();
    else (color ? chain.setHighlight({ color }) : chain.unsetHighlight()).run();
  };
  const extra = linkForm || (popover && <section className="note-ribbon-panel" aria-label={title}>
    <div className="nw-section-heading"><strong>{title}</strong>
      <IconButton label="Fechar opções" onClick={() => { setPopover(null); focus().run(); }}>×</IconButton></div>
    <Toolbar>
      <Button size="sm" onMouseDown={(event) => event.preventDefault()} onClick={() => setColor()}>Padrão</Button>
      {(popover === 'ink' ? inkColors : highlightColors).map(([name, color]) =>
        <button type="button" key={color} className="note-color-swatch" aria-label={name} title={name}
          aria-pressed={color === (popover === 'ink' ? tools.textStyle.color : tools.highlightColor)}
          style={{ backgroundColor: color }} onMouseDown={(event) => event.preventDefault()} onClick={() => setColor(color)} />)}
    </Toolbar>
  </section>);
  return <div className="document-editor">
    <input type="file" hidden ref={fileInput} aria-label="Arquivo de imagem do caderno" accept="image/*" onChange={async (event) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      const { doc, selection } = editor.state;
      try {
        const image = await importLocalImage(file);
        if (editor.isDestroyed) return;
        if (!editor.state.doc.eq(doc)) { notify('A página mudou. Selecione a imagem novamente.'); return; }
        setPopover(null);
        focus().command(({ tr }) => { tr.setSelection(selection); closeHistory(tr); return true; })
          .insertContent({ type: 'noteImage', attrs: { image } }).run();
      } catch (error) { notify(error instanceof Error ? error.message : 'Não foi possível inserir a imagem.'); }
    }} />
    <NotebookToolbar simple={{ history: group(history), text: <>{styleControl}{weightField}{group(marks.slice(0, 3))}</>,
      lists: group(lists), insertIcon: <Plus size={21} /> }} ribbon={ribbon} insertion={insertion} reorderActions={group(blocks.slice(2))} supplemental={supplemental} categories={categories} panel={toolPanel} setPanel={setToolPanel} extra={extra} mobile={mobile}
      clearExtra={() => { setPopover(null); setLink(null); }}
      dismissKeyboard={() => {
        const active = document.activeElement;
        if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) active.blur();
        else editor.commands.blur();
      }} />
    <EditorContent editor={editor} className="document-content" data-width={tools.pageWidth}
      style={editorTypographyVariables(data.profile.editorTypography) as CSSProperties} />
  </div>;
}
