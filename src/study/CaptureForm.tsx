import { useState } from 'react';
import { Select } from '../components/Select';
import { Button } from '../components/ui';
import { captureLabels, suggestCapture } from '../lib/capture';
import { useApp } from '../state/AppState';
import { CAPTURE_KINDS, type CaptureKind } from '../types';

export interface CaptureDraft { content?: string; classification?: CaptureKind; subjectId?: string; noteId?: string }
export function CaptureForm({ draft = {}, close }: { draft?: CaptureDraft; close: () => void }) {
  const app = useApp();
  const [content, setContent] = useState(draft.content ?? '');
  const [classification, setClassification] = useState<CaptureKind | ''>(draft.classification ?? '');
  const suggestion = suggestCapture(content);
  const save = () => {
    if (!content.trim()) return;
    app.capture(content, { ...draft, classification: classification || undefined });
    close();
  };
  return <form className="nw-stack" onSubmit={(event) => { event.preventDefault(); save(); }}>
    <label className="field-label">Conteúdo
      <textarea className="ds-input" rows={4} required value={content} placeholder="Escreva ou cole o que quer guardar"
        onChange={(event) => setContent(event.target.value)} onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && !event.nativeEvent.isComposing && event.key === 'Enter') { event.preventDefault(); save(); }
        }} />
    </label>
    <details className="cognitive-details"><summary>Classificar agora <span className="nw-muted">(opcional)</span></summary>
      <Select label="Classificação da captura" value={classification} onChange={setClassification}
        options={[[ '', 'Sem classificação'], ...CAPTURE_KINDS.map((kind) => [kind, captureLabels[kind]] as const)]} />
      {suggestion.classification && !classification && <Button size="sm" onClick={() => setClassification(suggestion.classification!)}>
        Usar sugestão · {captureLabels[suggestion.classification]}</Button>}
    </details>
    <div className="nw-toolbar"><Button variant="primary" type="submit" disabled={!content.trim()}>Guardar na caixa de entrada</Button>
      <Button onClick={close}>Cancelar</Button></div>
  </form>;
}
