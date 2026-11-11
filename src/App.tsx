import { Suspense, useState, useSyncExternalStore } from 'react';
import { sfx } from './audio/sfxEngine';
import { islandPandas } from './game/island';
import ErrorBoundary from './ui/ErrorBoundary';
import { PandaFace } from './ui/icons';
import { World } from './ui/lazy';
import Portrait from './ui/Portrait';
import ColorStep from './ui/screens/ColorStep';
import CreateProfile from './ui/screens/CreateProfile';
import Home from './ui/screens/Home';
import Lesson from './ui/screens/Lesson';
import LevelPicker from './ui/screens/LevelPicker';
import NameEntry from './ui/screens/NameEntry';
import PandaBook from './ui/screens/PandaBook';
import Parent from './ui/screens/Parent';
import ProfilePicker from './ui/screens/ProfilePicker';
import Results from './ui/screens/Results';
import { useApp, type AppApi } from './ui/useApp';
import type { PandaColor } from './types';

const reducedQuery = '(prefers-reduced-motion: reduce)';
function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(reducedQuery);
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    () => window.matchMedia(reducedQuery).matches,
    () => false,
  );
}

function NewPandaName({ app, color }: { app: AppApi; color: PandaColor }) {
  const [busy, setBusy] = useState(false);
  return (
    <NameEntry
      label="Panda name"
      dice
      busy={busy}
      hero={<Portrait color={color} size={140} />}
      onSubmit={(name) => {
        setBusy(true);
        app.createEarnedPanda(color, name).catch(() => setBusy(false));
      }}
    />
  );
}

export default function App() {
  const app = useApp();
  const reduced = useReducedMotion();
  const { screen, profile, pandas } = app;

  const avatarColor = pandas.find((p) => p.id === profile?.avatarPandaId)?.color ?? 'classic';
  const dimmed = screen.name === 'levelPicker' || screen.name === 'lesson' || screen.name === 'results';

  let content;
  switch (screen.name) {
    case 'loading':
      return (
        <div className="screen screen-loading" aria-busy="true">
          <PandaFace size={96} />
        </div>
      );
    case 'profilePicker':
      content = (
        <ProfilePicker
          repo={app.repo}
          profiles={app.profiles}
          onSelect={(p) => void app.selectProfile(p)}
          onCreate={() => app.go({ name: 'createProfile' })}
        />
      );
      break;
    case 'createProfile':
      content = (
        <CreateProfile onCancel={() => app.go({ name: 'profilePicker' })} onCreate={app.createProfile} />
      );
      break;
    case 'home':
      content = profile && (
        <Home
          profile={profile}
          avatarColor={avatarColor}
          muted={!app.settings.sfxEnabled && !app.settings.ambientEnabled}
          onPlay={() => app.go({ name: 'levelPicker' })}
          onBook={() => app.go({ name: 'pandaBook' })}
          onSwitch={app.switchProfile}
          onMute={app.toggleMute}
          onParent={() => app.go({ name: 'parent' })}
        />
      );
      break;
    case 'levelPicker':
      content = profile && (
        <LevelPicker
          repo={app.repo}
          speech={app.speech}
          profile={profile}
          onBack={() => app.go({ name: 'home' })}
          onStart={(setup) => app.go({ name: 'lesson', setup })}
        />
      );
      break;
    case 'lesson':
      content = (
        <Lesson
          setup={screen.setup}
          speech={app.speech}
          onFinish={(r) => void app.finishLesson(screen.setup, r)}
          onLeave={(r) => void app.leaveLesson(screen.setup, r)}
        />
      );
      break;
    case 'results':
      content = (
        <Results score={screen.score} reward={screen.reward} onContinue={() => app.afterResults(screen.reward)} />
      );
      break;
    case 'newPandaColor':
      content = <ColorStep onPick={(c) => app.go({ name: 'newPandaName', color: c })} />;
      break;
    case 'newPandaName':
      content = <NewPandaName app={app} color={screen.color} />;
      break;
    case 'pandaBook':
      content = (
        <PandaBook pandas={pandas} cap={app.cap} onBack={() => app.go({ name: 'home' })} onToggle={app.toggleIsland} />
      );
      break;
    case 'parent':
      content = (
        <Parent
          speech={app.speech}
          settings={app.settings}
          profile={profile}
          onChange={app.updateSettings}
          onDelete={app.deleteProfile}
          onBack={() => app.go({ name: profile ? 'home' : 'profilePicker' })}
        />
      );
      break;
  }

  return (
    <div className="app">
      {profile && (
        <div className="world-layer">
          <ErrorBoundary>
            <Suspense fallback={null}>
              <World
                pandas={islandPandas(pandas, app.cap)}
                paused={screen.name !== 'home'}
                dimmed={dimmed}
                arrivalPandaId={app.arrival?.pandaId}
                evictedPandaIds={app.arrival?.evicted}
                onArrivalDone={app.clearArrival}
                onPandaTap={() => sfx.play('squeak')}
                onPandaCapChange={app.setWorldCap}
                reducedMotion={reduced}
              />
            </Suspense>
          </ErrorBoundary>
        </div>
      )}
      <div className="screen-host" key={screen.name === 'lesson' ? 'lesson' : screen.name}>
        {content}
      </div>
    </div>
  );
}
