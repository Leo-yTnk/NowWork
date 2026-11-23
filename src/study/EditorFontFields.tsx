import { useState } from 'react';
import { Button } from '../components/ui';
import { Select } from '../components/Select';
import { allowsWeight, editorFonts, editorWeightLabel, findEditorFont } from '../lib/editorTypography';

export function FontSelect({ value, onChange, label = 'Fonte', returnFocus, mixed, animateValue }: {
  value: string; onChange: (value: string) => void; label?: string; returnFocus?: boolean; mixed?: boolean; animateValue?: boolean;
}) {
  const known = editorFonts.some(({ name }) => name === value);
  const options: [string, string][] = [['', 'Padrão']];
  if (value && !known) options.push([value, value]);
  options.push(...editorFonts.map(({ name }): [string, string] => [name, name]));
  return <Select label={label} value={mixed ? 'ds-mixed-font' : value} options={options} displayValue={mixed ? 'Misto' : undefined} onChange={onChange} returnFocus={returnFocus} animateValue={animateValue} />;
}

type EditorFont = NonNullable<ReturnType<typeof findEditorFont>>;

export function ExactFontWeight({ font, value, onChange, label = 'Peso da fonte', autoFocus }: {
  font: EditorFont; value?: number; onChange: (value: number) => void; label?: string; autoFocus?: boolean;
}) {
  const [draft, setDraft] = useState(value?.toString() ?? '');
  const [invalid, setInvalid] = useState(false);
  const setWeight = () => {
    const weight = Number(draft);
    if (allowsWeight(weight, font)) onChange(weight);
    else setInvalid(true);
  };
  return <div className="note-weight-custom">
    <input className="ds-input" type="number" min={font.range?.[0]} max={font.range?.[1]} step={1} value={draft} autoFocus={autoFocus}
      aria-label={label + ' exato'} aria-invalid={invalid} placeholder={font.range?.join('–')}
      onChange={(event) => { setDraft(event.target.value); setInvalid(false); }}
      onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); setWeight(); } }} />
    <Button size="sm" onClick={setWeight}>Aplicar</Button>
    {invalid && <small role="alert">Use um peso inteiro de {font.range?.[0]} a {font.range?.[1]}.</small>}
  </div>;
}

export function FontWeightField({ font, value, onChange, label = 'Peso da fonte', onCustom }: {
  font: EditorFont; value?: number; onChange: (value?: number) => void; label?: string; onCustom?: () => void;
}) {
  const [custom, setCustom] = useState(false);
  const options: [string, string][] = [['', onCustom ? 'Peso' : 'Padrão']];
  options.push(...font.weights.map((weight): [string, string] => [
    String(weight), editorWeightLabel(weight),
  ]));
  if (value !== undefined && !font.weights.includes(value)) options.push([String(value), String(value)]);
  if (font.range) options.push(['custom', 'Peso exato…']);
  const displayValue = onCustom ? (value === undefined ? 'Peso' : editorWeightLabel(value)) : undefined;
  return <div className="note-weight-field">
    <Select label={label} value={custom ? 'custom' : value?.toString() ?? ''} options={options} displayValue={displayValue} returnFocus={!onCustom} onChange={(chosen) => {
      if (chosen === 'custom') {
        if (onCustom) onCustom();
        else setCustom(true);
        return;
      }
      setCustom(false);
      onChange(chosen ? Number(chosen) : undefined);
    }} />
    {custom && <ExactFontWeight font={font} value={value} label={label} onChange={(weight) => { onChange(weight); setCustom(false); }} />}
  </div>;
}
