/**
 * Rules for the update UI: what the popover shows and what the manual check reports.
 */

import type { UpdateInfo } from '../../types';
import { describeUpdateError } from '../../services/errors';

/** Release notes cut to `maxLength` characters at a word boundary, or null if there are none. */
export function truncateNotes(notes: string | null, maxLength: number): string | null {
  const trimmed = notes?.trim();
  if (!trimmed) return null;
  if (trimmed.length <= maxLength) return trimmed;
  const cut = trimmed.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export type CheckOutcome = { update: UpdateInfo | null } | { error: unknown };

export interface CheckDialog {
  title: string;
  message: string;
  kind: 'info' | 'error';
}

/** Dialog for a check the user asked for from the menu; null when there is an update to offer. */
export function manualCheckDialog(outcome: CheckOutcome, currentVersion: string): CheckDialog | null {
  if ('error' in outcome) {
    return { title: "Couldn't check for updates", message: describeUpdateError(outcome.error), kind: 'error' };
  }
  if (outcome.update) return null;
  return {
    title: `You're up to date (${currentVersion})`,
    message: `bingo!! studio ${currentVersion} is the latest version.`,
    kind: 'info',
  };
}

/** Why "Install and Restart" is disabled: restarting would cut a generation short. */
export function installBlockedReason(state: { isGenerating: boolean; isInstalling: boolean }): string | null {
  if (state.isInstalling) return 'Installing the update…';
  if (state.isGenerating) return 'Wait for the generation to finish before restarting.';
  return null;
}
