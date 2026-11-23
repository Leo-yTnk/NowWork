import type { Mark, Node, ResolvedPos } from '@tiptap/pm/model';
import type { EditorState } from '@tiptap/pm/state';
import type { EditorTextStyle, EditorTypography } from './editorTypography';

export const textMarkNames = ['bold', 'italic', 'underline', 'strike', 'superscript', 'subscript'] as const;

function contextStyle(position: ResolvedPos): EditorTextStyle {
  for (let depth = position.depth; depth > 0; depth--) {
    switch (position.node(depth).type.name) {
      case 'codeBlock': return 'code';
      case 'blockquote': return 'quote';
      case 'listItem':
      case 'taskItem': return 'list';
      case 'table': return 'table';
    }
  }
  return 'p';
}

function describeText(block: Node, position: ResolvedPos, marks: readonly Mark[], typography: EditorTypography) {
  const level = block.type.name === 'heading' ? Number(block.attrs.level) : 0;
  const style = level ? `h${level}` as EditorTextStyle : contextStyle(position);
  const attrs = marks.find((mark) => mark.type.name === 'textStyle')?.attrs;
  const defaultWeight = typography[style]?.weight ?? (level === 2 || level === 3 ? 700 : level ? 800 : 400);
  const weight: number = attrs?.fontWeight ?? defaultWeight;
  const hasMark = (name: string) => marks.some((mark) => mark.type.name === name);
  return {
    level,
    weight: hasMark('bold') ? (weight < 350 ? 400 : weight < 550 ? 700 : Math.max(weight, 900)) : weight,
    fontFamily: (attrs?.fontFamily || null) as string | null,
    fontSize: (attrs?.fontSize || null) as string | null,
    lineHeight: (attrs?.lineHeight || null) as string | null,
    hasMark,
  };
}

export function selectionTypography({ doc, selection, storedMarks }: EditorState, typography: EditorTypography) {
  const { $from } = selection;
  const entries: ReturnType<typeof describeText>[] = [];
  if (!selection.empty) {
    for (const { $from: start, $to: end } of selection.ranges) {
      doc.nodesBetween(start.pos, end.pos, (block, pos) => {
        if (!block.isTextblock) return;
        const from = Math.max(0, start.pos - pos - 1);
        const to = Math.min(block.content.size, end.pos - pos - 1);
        if (from >= to && (block.content.size || start.pos > pos || end.pos < pos + block.nodeSize)) return false;
        const position = doc.resolve(pos + 1);
        let hasInline = false;
        block.nodesBetween(from, to, (node) => {
          if (node.isInline) {
            hasInline = true;
            entries.push(describeText(block, position, node.marks, typography));
          }
          return false;
        });
        if (!hasInline) entries.push(describeText(block, position, [], typography));
        return false;
      });
    }
  }
  const [first, ...rest] = entries.length ? entries : [describeText($from.parent, $from, storedMarks ?? $from.marks(), typography)];
  const common = <T,>(read: (entry: typeof first) => T): T | 'Misto' => {
    const value = read(first);
    return rest.every((entry) => read(entry) === value) ? value : 'Misto';
  };
  return {
    level: common((entry) => entry.level),
    weight: common((entry) => entry.weight),
    fontFamily: common((entry) => entry.fontFamily),
    fontSize: common((entry) => entry.fontSize),
    lineHeight: common((entry) => entry.lineHeight),
    mark: (name: typeof textMarkNames[number]) => common((entry) => entry.hasMark(name)),
  };
}
