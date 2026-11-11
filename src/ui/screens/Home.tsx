import { sfx } from '../../audio/sfxEngine';
import type { Profile, PandaColor } from '../../types';
import HoldGear from '../HoldGear';
import { BookIcon, PlayIcon, VolumeIcon, VolumeOffIcon } from '../icons';
import Portrait from '../Portrait';

interface Props {
  profile: Profile;
  avatarColor: PandaColor;
  muted: boolean;
  onPlay: () => void;
  onBook: () => void;
  onSwitch: () => void;
  onMute: () => void;
  onParent: () => void;
}

/** HUD drawn over the full-screen island (R-WLD-5, R-SND-3). */
export default function Home({ profile, avatarColor, muted, onPlay, onBook, onSwitch, onMute, onParent }: Props) {
  return (
    <div className="hud">
      <div className="hud-top">
        <button type="button" className="icon-btn glass" aria-label={muted ? 'Sound off' : 'Sound on'} onClick={onMute}>
          {muted ? <VolumeOffIcon size={26} /> : <VolumeIcon size={26} />}
        </button>
        <HoldGear onOpen={onParent} />
      </div>
      <div className="hud-bottom">
        <button
          type="button"
          className="icon-btn icon-btn-lg glass"
          aria-label="Panda Book"
          onClick={() => {
            sfx.play('tap');
            onBook();
          }}
        >
          <BookIcon size={34} />
        </button>
        <button
          type="button"
          className="btn btn-play"
          aria-label="Play"
          onClick={() => {
            sfx.unlock();
            sfx.play('tap');
            onPlay();
          }}
        >
          <PlayIcon size={44} />
        </button>
        <button
          type="button"
          className="chip-btn glass"
          aria-label={`Switch player (${profile.name})`}
          onClick={() => {
            sfx.play('tap');
            onSwitch();
          }}
        >
          <Portrait color={avatarColor} size={44} />
          <span className="chip-name">{profile.name}</span>
        </button>
      </div>
    </div>
  );
}
