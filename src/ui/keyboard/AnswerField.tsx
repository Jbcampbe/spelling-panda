import type { ReactNode } from 'react';

interface Props {
  value: string;
  label: string;
  wobbleKey?: number;
  placeholder?: ReactNode;
  state?: 'idle' | 'correct';
  /** Faded previous attempt shown above (R-LSN-8). */
  previous?: string;
  size?: 'normal' | 'large';
  /** Button shown to the right of the field (e.g. submit). */
  action?: ReactNode;
}

/** Display-only answer field — NOT an <input>, so the native keyboard can't open (R-KEY-2). */
export default function AnswerField({
  value,
  label,
  wobbleKey = 0,
  placeholder,
  state = 'idle',
  previous,
  size = 'normal',
  action,
}: Props) {
  return (
    <div className={`answer-wrap answer-${size}`}>
      <div className="answer-prev" aria-hidden={!previous}>
        {previous ?? ''}
      </div>
      <div className="answer-row">
        <div
          key={wobbleKey}
          role="textbox"
          aria-readonly="true"
          aria-label={label}
          className={`answer-field${wobbleKey > 0 ? ' wobble' : ''}${state === 'correct' ? ' is-correct' : ''}`}
        >
          {value ? (
            <span className="answer-text">{value}</span>
          ) : (
            <span className="answer-placeholder">{placeholder}</span>
          )}
          <span className="caret" aria-hidden="true" />
        </div>
        {action}
      </div>
    </div>
  );
}
