import { Fragment } from 'react';

interface StepIndicatorProps {
  steps: string[];
  currentIndex: number;
}

export function StepIndicator({ steps, currentIndex }: StepIndicatorProps) {
  return (
    <div className="step-indicator" aria-hidden="true">
      {steps.map((step, i) => (
        <Fragment key={step}>
          <div
            className="step-dot"
            data-state={i < currentIndex ? 'done' : i === currentIndex ? 'active' : undefined}
            title={step}
          >
            {i + 1}
          </div>
          {i < steps.length - 1 && (
            <div className="step-line" data-state={i < currentIndex ? 'done' : undefined} />
          )}
        </Fragment>
      ))}
    </div>
  );
}
