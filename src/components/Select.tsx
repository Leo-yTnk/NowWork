import { useRef, useState, type CSSProperties } from 'react';
import * as Primitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';

type SelectOption<T extends string | number> = readonly [value: T, label: string];

export function Select<T extends string | number>({ label, value, options, onChange, displayValue, disabled, returnFocus = true }: {
  label: string; value: T; options: readonly SelectOption<T>[];
  onChange: (value: T) => void; displayValue?: string; disabled?: boolean; returnFocus?: boolean;
}) {
  const selected = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const changeOpen = (nextOpen: boolean) => {
    if (nextOpen) selected.current = false;
    setOpen(nextOpen);
  };

  return <Primitive.Root disabled={disabled} open={open} value={String(value) || 'ds-empty'} onValueChange={(raw) => {
    const option = options.find(([key]) => (String(key) || 'ds-empty') === raw);
    if (option) {
      selected.current = true;
      onChange(option[0]);
    }
  }} onOpenChange={changeOpen}>
    <Primitive.Trigger ref={trigger} className="ds-select" aria-label={label} title={label}
      onPointerDown={(event) => {
        // Radix normally opens on mouse press. Toggle only once, on click.
        if (event.pointerType === 'mouse' && event.button === 0) event.preventDefault();
      }}
      onClick={(event) => {
        event.preventDefault();
        if (!event.ctrlKey) changeOpen(!open);
      }}>
      <Primitive.Value>{displayValue}</Primitive.Value><Primitive.Icon asChild><ChevronDown size={13} aria-hidden="true" /></Primitive.Icon>
    </Primitive.Trigger>
    <Primitive.Portal>
      <Primitive.Content className="ds-select-content" style={{ '--ds-select-rows': options.length } as CSSProperties} position="popper" align="start" sideOffset={6} collisionPadding={8}
        onPointerDownOutside={(event) => {
          // Let a click on the trigger close the menu after the pointer is released.
          const target = event.detail.originalEvent.target;
          if (target instanceof Node && trigger.current?.contains(target)) event.preventDefault();
        }}
        onCloseAutoFocus={(event) => { if (!returnFocus && selected.current) event.preventDefault(); }}>
        <div className="ds-select-frame ds-popup"><Primitive.Viewport className="ds-select-options">
          {options.map(([key, name]) => <Primitive.Item key={key} value={String(key) || 'ds-empty'} className="ds-select-option">
            <Primitive.ItemText>{name}</Primitive.ItemText>
            <Primitive.ItemIndicator><Check size={15} aria-hidden="true" /></Primitive.ItemIndicator>
          </Primitive.Item>)}
        </Primitive.Viewport></div>
      </Primitive.Content>
    </Primitive.Portal>
  </Primitive.Root>;
}
