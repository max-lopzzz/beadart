import { lazy, Suspense, useState } from 'react';
import { HomeScreen } from './components/home/HomeScreen';
import { NewPatternWizard } from './components/new-pattern/NewPatternWizard';
import { WorkingView } from './components/working/WorkingView';
import { PaletteManageScreen } from './components/palettes/PaletteManageScreen';

const SharedPatternView = lazy(() =>
  import('./components/shared/SharedPatternView').then((m) => ({ default: m.SharedPatternView })),
);

type Screen =
  | { name: 'home' }
  | { name: 'new-pattern' }
  | { name: 'working'; patternId: string }
  | { name: 'palettes' };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });

  const shareSlug = new URLSearchParams(window.location.search).get('share');
  if (shareSlug) {
    return (
      <Suspense fallback={<div className="shared-view">Loading…</div>}>
        <SharedPatternView slug={shareSlug} />
      </Suspense>
    );
  }

  if (screen.name === 'home') {
    return (
      <HomeScreen
        onOpenPattern={(patternId) => setScreen({ name: 'working', patternId })}
        onNewPattern={() => setScreen({ name: 'new-pattern' })}
        onManagePalettes={() => setScreen({ name: 'palettes' })}
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

  return <PaletteManageScreen onBack={() => setScreen({ name: 'home' })} />;
}
