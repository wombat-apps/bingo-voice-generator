import { describe, expect, it } from 'vitest';
import { installBlockedReason, manualCheckDialog, truncateNotes } from './update';

describe('truncateNotes', () => {
  it('keeps short notes as they are', () => {
    expect(truncateNotes('Fixes the player.', 20)).toBe('Fixes the player.');
  });

  it('cuts long notes at a word and adds an ellipsis', () => {
    expect(truncateNotes('Fixes the player and the grid.', 20)).toBe('Fixes the player…');
  });

  it('has nothing to show for missing or blank notes', () => {
    expect(truncateNotes(null, 20)).toBeNull();
    expect(truncateNotes('  \n ', 20)).toBeNull();
  });
});

describe('manualCheckDialog', () => {
  it('says the app is up to date, with its version', () => {
    expect(manualCheckDialog({ update: null }, '0.3.1')).toEqual({
      title: "You're up to date (0.3.1)",
      message: 'Bingo Voice Generator 0.3.1 is the latest version.',
      kind: 'info',
    });
  });

  it('shows the error when the check fails', () => {
    expect(
      manualCheckDialog({ error: { code: 'UPDATE_ERROR', message: 'offline' } }, '0.3.1'),
    ).toEqual({ title: "Couldn't check for updates", message: "Couldn't update: offline", kind: 'error' });
  });

  it('shows no dialog when there is an update: the header offers it', () => {
    expect(manualCheckDialog({ update: { version: '0.4.0', notes: null } }, '0.3.1')).toBeNull();
  });
});

describe('installBlockedReason', () => {
  it('blocks installing while audio is being generated', () => {
    expect(installBlockedReason({ isGenerating: true, isInstalling: false })).toBe(
      'Wait for the generation to finish before restarting.',
    );
  });

  it('blocks a second install while one is running', () => {
    expect(installBlockedReason({ isGenerating: false, isInstalling: true })).toBe('Installing the update…');
  });

  it('allows installing otherwise', () => {
    expect(installBlockedReason({ isGenerating: false, isInstalling: false })).toBeNull();
  });
});
