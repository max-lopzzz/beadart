import { useState } from 'react';
import { HomeScreen } from './components/home/HomeScreen';
import { NewPatternWizard } from './components/new-pattern/NewPatternWizard';
import { WorkingView } from './components/working/WorkingView';
import { PaletteManageScreen } from './components/palettes/PaletteManageScreen';

type Screen =
  | { name: 'home' }
  | { name: 'new-pattern' }
  | { name: 'working'; patternId: string }
  | { name: 'palettes' };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });

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
