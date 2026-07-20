'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface WizardStep {
  id: string;
  label: string;
}

interface WizardProgressProps {
  steps: WizardStep[];
  /** Index of the currently active step. Steps before it are complete. */
  currentIndex: number;
}

/**
 * Horizontal step indicator for the headshot wizard (Upload → Style → Results).
 * Purely presentational — `HeadshotFlow` owns the actual step state.
 */
export function WizardProgress({ steps, currentIndex }: WizardProgressProps) {
  return (
    <ol className="flex w-full list-none items-center p-0" aria-label="Progress">
      {steps.map((step, i) => {
        const complete = i < currentIndex;
        const active = i === currentIndex;
        const isLast = i === steps.length - 1;

        return (
          <li key={step.id} className={cn('flex items-center', !isLast && 'flex-1')}>
            <div className="flex flex-col items-center gap-2">
              <span
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors',
                  complete && 'border-primary bg-primary text-primary-foreground',
                  active && 'border-primary text-primary',
                  !complete && !active && 'border-muted-foreground/30 text-muted-foreground',
                )}
              >
                {complete ? <Check className="h-4 w-4" aria-hidden /> : i + 1}
              </span>
              <span
                className={cn(
                  'whitespace-nowrap text-xs font-medium',
                  active ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div
                className={cn(
                  'mx-2 mb-5 h-0.5 flex-1 rounded-full transition-colors',
                  complete ? 'bg-primary' : 'bg-muted-foreground/20',
                )}
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
