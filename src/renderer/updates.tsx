// In-app updates UI: the Settings → Updates section and (below) the banner in
// the main window. Both read the UpdateState the main process pushes; nothing
// here talks to the network itself.
import { useEffect, useState } from 'react';
import type { UpdateState } from '../shared/types';
import { api } from './api';
import { updateStatusLine, updateSwitches } from './update-text';

/**
 * Subscribe to the main process' update state: one fetch, then live pushes.
 * Returns null until the first state arrives.
 */
export function useUpdates(): UpdateState | null {
  const [u, setU] = useState<UpdateState | null>(null);
  useEffect(() => {
    let dead = false;
    void api.getUpdatesState().then(s => { if (!dead) setU(s); });
    const off = api.onUpdatesState(setU);
    return () => { dead = true; off(); };
  }, []);
  return u;
}

/**
 * Settings → Updates. The switches read back the settings the main process
 * rides on every state push (a fresh window shows what it will do, not local
 * defaults); the result line is the live state from the main process, so
 * "Check now" shows its result even when "Check for updates" is off.
 */
export function UpdatesSection() {
  const u = useUpdates();
  const { check, autoDownload: auto } = u ? updateSwitches(u) : { check: false, autoDownload: false };
  if (!u) return null;
  if (u.mode === 'off') {
    return (
      <div className="updates-section">
        <b>Updates</b>
        <p className="muted small">Updates are off when running from source.</p>
      </div>
    );
  }
  return (
    <div className="updates-section">
      <b>Updates</b>
      <label className="check">
        <input type="checkbox" checked={check}
          onChange={e => void api.setUpdates({ check: e.target.checked })} />
        Check for updates
      </label>
      {u.mode === 'full' ? (
        <label className="check">
          <input type="checkbox" checked={auto} disabled={!check}
            onChange={e => void api.setUpdates({ autoDownload: e.target.checked })} />
          Download updates automatically
        </label>
      ) : (
        <p className="muted small">This build checks only; download new versions from the release page.</p>
      )}
      <div className="updates-check">
        <button onClick={() => void api.checkForUpdates()}>Check now</button>
        <span className={u.status === 'error' ? 'err' : 'muted'}>{updateStatusLine(u)}</span>
      </div>
    </div>
  );
}

/**
 * The update banner in the main window. Shown while there is something to act
 * on (available / downloading / downloaded / error); hidden otherwise and on a
 * build running from source (off).
 */
export function UpdateBanner({ updates }: { updates: UpdateState | null }) {
  if (!updates || updates.mode === 'off') return null;
  const u = updates;
  if (u.status === 'available') {
    // The main process sets url on "available" for both modes (one source).
    const href = u.url;
    return (
      <div className="update-banner" role="status">
        <span>{u.mode === 'check-only' ? `Version ${u.version ?? ''} is out.` : `Version ${u.version ?? ''} is ready to download.`}</span>
        {u.notes && (
          <details className="update-notes">
            <summary>Release notes</summary>
            <p>{u.notes}</p>
            <a href={href} target="_blank" rel="noreferrer">Open the release page</a>
          </details>
        )}
        {u.mode === 'check-only' ? (
          <a className="primary" href={href} target="_blank" rel="noreferrer">Open release page</a>
        ) : (
          <>
            <button className="primary" onClick={() => void api.downloadUpdate()}>Download</button>
            <button className="link" onClick={() => { if (u.version) void api.skipUpdate(u.version); }}>Skip this version</button>
          </>
        )}
      </div>
    );
  }
  if (u.status === 'downloading') {
    return (
      <div className="update-banner" role="status">
        <span>Downloading{u.progress != null ? ` ${u.progress}%` : ''}…</span>
      </div>
    );
  }
  if (u.status === 'downloaded') {
    return (
      <div className="update-banner" role="status">
        <span>Version {u.version ?? ''} is downloaded. <span className="muted">It installs when you quit.</span></span>
        <button className="primary" onClick={() => void api.installUpdate()}>Restart now</button>
      </div>
    );
  }
  if (u.status === 'error') {
    return (
      <div className="update-banner error" role="status">
        <span>{u.error ?? 'The update check failed.'}</span>
        <button className="link" onClick={() => void api.checkForUpdates()}>Retry</button>
      </div>
    );
  }
  return null;
}
