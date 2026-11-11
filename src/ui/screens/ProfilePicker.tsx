import { useEffect, useState } from 'react';
import { sfx } from '../../audio/sfxEngine';
import type { Repository } from '../../storage/Repository';
import type { PandaColor, Profile } from '../../types';
import { PlusIcon } from '../icons';
import { loadWorld } from '../lazy';
import Portrait from '../Portrait';

interface Props {
  repo: Repository;
  profiles: Profile[];
  onSelect: (p: Profile) => void;
  onCreate: () => void;
}

const MAX_PROFILES = 4;

export default function ProfilePicker({ repo, profiles, onSelect, onCreate }: Props) {
  const [colors, setColors] = useState<Record<string, PandaColor>>({});

  // After the picker has rendered, start fetching the 3D scene (R-PRF-P5).
  useEffect(() => {
    const t = window.setTimeout(() => void loadWorld().catch(() => {}), 200);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    let alive = true;
    void Promise.all(
      profiles.map(async (p) => {
        const list = await repo.listPandas(p.id).catch(() => []);
        return [p.id, list.find((x) => x.id === p.avatarPandaId)?.color ?? 'classic'] as const;
      }),
    ).then((entries) => {
      if (alive) setColors(Object.fromEntries(entries));
    });
    return () => {
      alive = false;
    };
  }, [repo, profiles]);

  return (
    <div className="screen screen-picker">
      <h1 className="brand">
        <span className="brand-small">Panda World</span>
        <span className="brand-big">Spelling</span>
      </h1>
      <div className="profile-grid">
        {profiles.map((p) => (
          <button
            key={p.id}
            type="button"
            className="profile-tile"
            onClick={() => {
              sfx.play('tap');
              onSelect(p);
            }}
          >
            <Portrait color={colors[p.id] ?? 'classic'} size={104} />
            <span className="profile-name">{p.name}</span>
          </button>
        ))}
        {profiles.length < MAX_PROFILES && (
          <button
            type="button"
            className="profile-tile profile-add"
            aria-label="New player"
            onClick={() => {
              sfx.play('tap');
              onCreate();
            }}
          >
            <span className="add-circle">
              <PlusIcon size={44} />
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
