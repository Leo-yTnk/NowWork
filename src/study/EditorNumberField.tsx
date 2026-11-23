import { useRef, useState } from 'react';
import { ControlValue } from '../components/ControlValue';

export function EditorNumberField({ label, title, value, placeholder, onCommit }: {
  label: string; title: string; value: string; placeholder: string;
  onCommit: (value: string, refocus: boolean) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const pending = useRef<string | null>(null);
  const changeDraft = (next: string | null) => {
    pending.current = next;
    setDraft(next);
  };
  const mixed = value === 'Misto';
  const current = mixed ? '' : value;
  const emptyLabel = mixed ? 'Misto' : placeholder;
  const commit = (refocus: boolean) => {
    const value = pending.current;
    if (value === null) return;
    changeDraft(null);
    onCommit(value, refocus);
  };

  return <div className="note-size-field">
    <input className="ds-input note-size-input" aria-label={label} title={title}
      inputMode="decimal" data-mixed={mixed} placeholder={emptyLabel} value={draft ?? current}
      onChange={(event) => changeDraft(event.target.value)}
      onBlur={() => commit(false)} onKeyDown={(event) => {
        if (event.key === 'Enter') { event.preventDefault(); commit(true); }
        if (event.key === 'Escape') { event.preventDefault(); changeDraft(null); }
      }} />
    <span className="note-size-value" data-placeholder={!current && !mixed}>
      <ControlValue value={current || emptyLabel} />
    </span>
  </div>;
}
