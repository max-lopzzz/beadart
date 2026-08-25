import { useEffect, useState } from 'react';
import { fetchSharedPattern } from '../../lib/sharing/shareRepo';
import { SharedPatternSummary } from '../../types/sharedPattern';
import { ProgressRing } from './Progress';

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'not-found' }
  | { status: 'ready'; summary: SharedPatternSummary };

export function SharedPatternView({ slug }: { slug: string }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    fetchSharedPattern(slug)
      .then((summary) => {
        if (cancelled) return;
        setState(summary ? { status: 'ready', summary } : { status: 'not-found' });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (state.status === 'loading') {
    return (
      <div className="shared-view">
        <p className="hint">Loading…</p>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="shared-view">
        <p className="hint">Couldn't load this pattern right now.</p>
      </div>
    );
  }

  if (state.status === 'not-found') {
    return (
      <div className="shared-view">
        <p className="hint">This pattern isn't shared anymore.</p>
      </div>
    );
  }

  const { summary } = state;

  return (
    <div className="shared-view">
      <div className="surface shared-card">
        <div className="shared-card-header">
          {summary.thumbnail && (
            <img
              className="shared-card-thumb"
              src={summary.thumbnail}
              alt={summary.name}
              width={64}
              height={64}
            />
          )}
          <div className="shared-card-heading">
            <h1>{summary.name}</h1>
            <div className="shared-card-progress">
              <ProgressRing percent={summary.percent} size={40} thickness={4} />
              <span>{summary.percent}% complete</span>
            </div>
          </div>
        </div>
        <ul className="shared-color-list">
          {summary.colors.map((color) => (
            <li key={color.name} data-done={color.done ? 'true' : 'false'}>
              <span
                className="bead bead-sm"
                aria-hidden="true"
                style={{ backgroundColor: color.hex }}
              />
              <span className="shared-color-name">
                {color.name} × {color.total}
              </span>
              <span className="shared-color-status">{color.done ? 'done' : 'remaining'}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
