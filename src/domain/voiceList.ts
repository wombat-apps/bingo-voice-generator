/**
 * How the sidebar lists an Accent's Voices: grouped by kind (see GLOSSARY.md), Default Voices
 * first, so the voices every Plan can use stay on top whichever account is active.
 */

import type { Voice, VoiceKind } from '../types';

export interface VoiceGroup {
  /** null for Voices whose kind is still unknown; they are listed last, under no header. */
  kind: VoiceKind | null;
  voices: Voice[];
}

const GROUP_ORDER: (VoiceKind | null)[] = ['default', 'library', null];

/** Favorites first, then alphabetically by name. */
function compareVoices(a: Voice, b: Voice): number {
  if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
  return a.customName.localeCompare(b.customName);
}

/** The groups that have Voices, in order, each sorted. */
export function groupVoicesByKind(voices: Voice[]): VoiceGroup[] {
  return GROUP_ORDER.map((kind) => ({
    kind,
    voices: voices.filter((v) => v.kind === kind).sort(compareVoices),
  })).filter((group) => group.voices.length > 0);
}
