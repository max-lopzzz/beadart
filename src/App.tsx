import { lazy, Suspense, useState } from 'react';
import { HomeScreen } from './components/home/HomeScreen';
import { NewPatternWizard } from './components/new-pattern/NewPatternWizard';
import { WorkingView } from './components/working/WorkingView';
import { PaletteManageScreen } from './components/palettes/PaletteManageScreen';
import { AccountScreen } from './components/account/AccountScreen';

const SharedPatternView = lazy(() =>
  import('./components/shared/SharedPatternView').then((m) => ({ default: m.SharedPatternView })),
);
const SharedOverviewView = lazy(() =>
  import('./components/shared/SharedOverviewView').then((m) => ({
    default: m.SharedOverviewView,
  })),
);

type Screen =
  | { name: 'home' }
  | { name: 'new-pattern' }
  | { name: 'working'; patternId: string }
  | { name: 'palettes' }
  | { name: 'account' };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });

  const params = new URLSearchParams(window.location.search);
  const shareSlug = params.get('share');
  const overviewSlug = params.get('overview');
  if (shareSlug) {
    return (
      <Suspense fallback={<div className="shared-view">Loading…</div>}>
        <SharedPatternView slug={shareSlug} />
      </Suspense>
    );
  }
  if (overviewSlug) {
    return (
      <Suspense fallback={<div className="shared-view">Loading…</div>}>
        <SharedOverviewView slug={overviewSlug} />
      </Suspense>
    );
  }

  if (screen.name === 'home') {
    return (
      <HomeScreen
        onOpenPattern={(patternId) =>
          setScreen({ name: 'working', patternId })
        }
        onNewPattern={() => setScreen({ name: 'new-pattern' })}
        onManagePalettes={() => setScreen({ name: 'palettes' })}
        onAccount={() => setScreen({ name: 'account' })}
      />
    );
  }

  if (screen.name === 'new-pattern') {
    return (
      <NewPatternWizard
        onDone={(patternId) => setScreen({ name: 'working', patternId })}
        onCancel={() => setScreen({ name: 'home' })}
      />
    );
  }

  if (screen.name === 'working') {
    return (
      <WorkingView patternId={screen.patternId} onBack={() => setScreen({ name: 'home' })} />
    );
  }

  if (screen.name === 'account') {
    return <AccountScreen onBack={() => setScreen({ name: 'home' })} />;
  }

  return <PaletteManageScreen onBack={() => setScreen({ name: 'home' })} />;
}
