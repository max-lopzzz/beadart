import { useEffect, useState } from 'react';
import { fetchSharedOverview } from '../../lib/sharing/shareRepo';
import { SharedOverviewSummary } from '../../types/sharedOverview';
import { ProgressRing } from './Progress';

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'not-found' }
  | { status: 'ready'; summary: SharedOverviewSummary };

export function SharedOverviewView({ slug }: { slug: string }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    fetchSharedOverview(slug)
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
        <p className="hint">Couldn't load this overview right now.</p>
      </div>
    );
  }

  if (state.status === 'not-found') {
    return (
      <div className="shared-view">
        <p className="hint">This overview isn't shared anymore.</p>
      </div>
    );
  }

  const { summary } = state;

  return (
    <div className="shared-view">
      <div className="surface shared-card">
        <div className="shared-card-header">
          <ProgressRing percent={summary.percent} size={48} thickness={5} />
          <div className="shared-card-heading">
            <h1>Bead art progress</h1>
            <div className="shared-card-progress">
              <span>
                {summary.patternCount} pattern{summary.patternCount === 1 ? '' : 's'} ·{' '}
                {summary.beadsPlaced.toLocaleString()} / {summary.beadsTotal.toLocaleString()}{' '}
                beads placed
              </span>
            </div>
          </div>
        </div>
        {summary.patterns.length > 0 && (
          <div className="shared-pattern-grid">
            {summary.patterns.map((pattern) => (
              <div key={pattern.id} className="shared-pattern-item">
                <img
                  src={pattern.thumbnail}
                  alt={pattern.name}
                  className="shared-pattern-thumb"
                />
                <div className="shared-pattern-info">
                  <span className="shared-pattern-name">{pattern.name}</span>
                  <span className="shared-pattern-percent">
                    {pattern.percent}% complete
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        {summary.materials.length > 0 && (
          <ul className="shared-color-list">
            {summary.materials.map((color) => (
              <li key={color.name} data-done={color.remaining === 0 ? 'true' : 'false'}>
                <span
                  className="bead bead-sm"
                  aria-hidden="true"
                  style={{ backgroundColor: color.hex }}
                />
                <span className="shared-color-name">{color.name}</span>
                <span className="shared-color-status">
                  {color.remaining === 0 ? 'done' : `${color.remaining} left`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
