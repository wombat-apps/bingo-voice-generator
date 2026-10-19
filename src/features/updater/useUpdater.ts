import { useCallback, useEffect, useState } from 'react';
import type { UpdateInfo } from '../../types';
import {
  checkForUpdate,
  getAppVersion,
  installUpdate,
  onCheckForUpdateRequested,
  showMessage,
} from '../../services/tauri';
import { describeUpdateError } from '../../services/errors';
import { manualCheckDialog, type CheckOutcome } from './update';

/**
 * Checks for updates silently on launch and when the menu asks, with a dialog for the
 * latter. `update` is what the header offers; `later` hides it until the next launch
 * (or the next manual check).
 */
export function useUpdater() {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    checkForUpdate()
      .then((found) => {
        if (!cancelled) setUpdate(found);
      })
      .catch((err) => console.warn('Update check on launch failed:', err));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const runManualCheck = async () => {
      let outcome: CheckOutcome;
      try {
        outcome = { update: await checkForUpdate() };
      } catch (error) {
        console.warn('Update check failed:', error);
        outcome = { error };
      }
      if ('update' in outcome) {
        setUpdate(outcome.update);
        setIsDismissed(false);
      }
      const dialog = manualCheckDialog(outcome, await getAppVersion());
      if (dialog) await showMessage(dialog.title, dialog.message, dialog.kind);
    };

    const unlisten = onCheckForUpdateRequested(() => {
      runManualCheck().catch((err) => console.error('Update check failed:', err));
    });
    return () => {
      unlisten.then((stop) => stop());
    };
  }, []);

  // On success the app restarts, so this only returns on failure.
  const install = useCallback(async () => {
    setIsInstalling(true);
    try {
      await installUpdate();
    } catch (err) {
      console.error('Update install failed:', err);
      await showMessage("Couldn't install the update", describeUpdateError(err), 'error');
    } finally {
      setIsInstalling(false);
    }
  }, []);

  const later = useCallback(() => setIsDismissed(true), []);

  return { update: isDismissed ? null : update, isInstalling, install, later };
}
