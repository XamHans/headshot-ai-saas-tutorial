'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HEADSHOT_STYLES } from '@/modules/headshot/styles';

interface StylePickerProps {
  selectedId: string;
  onSelect: (styleId: string) => void;
  disabled?: boolean;
}

/**
 * Six style preset cards. One is always selected (the default is pre-selected
 * by the parent), so the user can start generation in a single tap without
 * choosing. Selecting is optional, not required.
 */
export function StylePicker({ selectedId, onSelect, disabled }: StylePickerProps) {
  return (
    <fieldset
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
      aria-label="Choose a headshot style"
    >
      {HEADSHOT_STYLES.map((style) => {
        const selected = style.id === selectedId;
        return (
          // biome-ignore lint/a11y/useSemanticElements: styled selectable cards need a real button for keyboard/click; the radio role conveys single-select semantics to AT.
          <button
            key={style.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onSelect(style.id)}
            className={cn(
              'relative flex flex-col gap-1 rounded-lg border p-4 text-left transition-colors',
              'hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'disabled:cursor-not-allowed disabled:opacity-60',
              selected ? 'border-primary ring-2 ring-primary/40' : 'border-border',
            )}
          >
            {selected && (
              <span
                className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
                aria-hidden
              >
                <Check className="h-3 w-3" />
              </span>
            )}
            <span className="font-medium">{style.label}</span>
            <span className="text-sm text-muted-foreground">{style.description}</span>
          </button>
        );
      })}
    </fieldset>
  );
}
