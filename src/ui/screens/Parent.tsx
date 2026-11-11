import { useEffect, useState } from 'react';
import type { AppSpeechProvider } from '../../speech';
import type { DeviceSettings, Profile } from '../../types';
import { ArrowLeftIcon, DownloadIcon, TrashIcon, WarnIcon } from '../icons';
import { getInstallEvent, onInstallEventChange } from '../util';

interface Props {
  speech: AppSpeechProvider;
  settings: DeviceSettings;
  profile: Profile | null;
  onChange: (patch: Partial<DeviceSettings>) => void;
  onDelete: (id: string) => Promise<void>;
  onBack: () => void;
}

const isIos = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches === true ||
  (navigator as unknown as { standalone?: boolean }).standalone === true;

/** R-PAR-2 / R-PAR-3: the only place with explanatory text. */
export default function Parent({ speech, settings, profile, onChange, onDelete, onBack }: Props) {
  const [voices, setVoices] = useState(() => speech.getUsVoices());
  const [installEvt, setInstallEvt] = useState(getInstallEvent);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => speech.onVoicesChanged(() => setVoices(speech.getUsVoices())), [speech]);
  useEffect(() => onInstallEventChange(() => setInstallEvt(getInstallEvent())), []);
  useEffect(() => () => speech.cancel(), [speech]);

  const available = speech.isAvailable();
  const ios = isIos();

  return (
    <div className="screen screen-parent">
      <header className="topbar">
        <button type="button" className="icon-btn" aria-label="Back" onClick={onBack}>
          <ArrowLeftIcon size={26} />
        </button>
        <h1 className="parent-title">Parent area</h1>
      </header>
      <div className="parent-body">
        {!available && (
          <p className="notice" role="alert">
            <WarnIcon size={22} />
            <span>
              Speech is not available in this browser, so words cannot be read aloud. Medium and Hard lessons need
              sound. Try Safari, Chrome or Edge.
            </span>
          </p>
        )}

        <section className="panel">
          <h2>Voice</h2>
          <p>Choose the voice that reads the words. Natural or enhanced voices usually sound best.</p>
          <div className="field-row">
            <select
              className="select"
              aria-label="Voice"
              value={settings.voiceURI ?? ''}
              onChange={(e) => onChange({ voiceURI: e.target.value || undefined })}
            >
              <option value="">Automatic (best US English voice)</option>
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-soft"
              disabled={!available}
              onClick={() => void speech.speakTest('Hello! Can you spell panda?', settings.voiceURI).catch(() => {})}
            >
              Test
            </button>
          </div>
          {available && voices.length === 0 && <p className="muted">No US English voices were found. The device default will be used.</p>}
        </section>

        <section className="panel">
          <h2>Sound</h2>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.sfxEnabled}
              onChange={(e) => onChange({ sfxEnabled: e.target.checked })}
            />
            <span className="toggle-track" aria-hidden="true" />
            <span>Sound effects</span>
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.ambientEnabled}
              onChange={(e) => onChange({ ambientEnabled: e.target.checked })}
            />
            <span className="toggle-track" aria-hidden="true" />
            <span>Gentle background music</span>
          </label>
        </section>

        <section className="panel">
          <h2>Install this app</h2>
          {isStandalone() ? (
            <p>This app is installed. Nice! Your progress is better protected.</p>
          ) : (
            <>
              <p>
                Installing the app helps protect progress, because browsers are less likely to clear saved data for
                installed apps. It also lets the game work offline.
              </p>
              {ios ? (
                <ol className="steps">
                  <li>Tap the Share button in Safari.</li>
                  <li>Choose Add to Home Screen.</li>
                  <li>Tap Add.</li>
                </ol>
              ) : installEvt ? (
                <button
                  type="button"
                  className="btn btn-soft"
                  onClick={() => {
                    void installEvt.prompt().then(() => installEvt.userChoice);
                  }}
                >
                  <DownloadIcon size={22} />
                  <span>Install</span>
                </button>
              ) : (
                <p className="muted">
                  Use your browser menu and choose Install app (or Add to Home Screen) if it is offered.
                </p>
              )}
            </>
          )}
        </section>

        {profile && (
          <section className="panel panel-danger">
            <h2>Delete player</h2>
            <p>
              Delete <strong>{profile.name}</strong> and all of their pandas and progress. This cannot be undone.
            </p>
            {!confirmDelete ? (
              <button type="button" className="btn btn-soft" onClick={() => setConfirmDelete(true)}>
                <TrashIcon size={22} />
                <span>Delete {profile.name}</span>
              </button>
            ) : (
              <div className="field-row">
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={deleting}
                  onClick={() => {
                    setDeleting(true);
                    onDelete(profile.id).catch(() => setDeleting(false));
                  }}
                >
                  <TrashIcon size={22} />
                  <span>Yes, delete everything</span>
                </button>
                <button type="button" className="btn btn-soft" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
