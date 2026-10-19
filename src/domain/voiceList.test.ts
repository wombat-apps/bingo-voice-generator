import { describe, expect, it } from 'vitest';
import { groupVoicesByKind } from './voiceList';
import type { Voice, VoiceKind } from '../types';

function voice(customName: string, kind: VoiceKind | null, favorite = false): Voice {
  return {
    uuid: customName,
    elevenlabsId: customName,
    elevenlabsName: customName,
    customName,
    accent: 'es-ES',
    gender: 'female',
    favorite,
    kind,
    details: null,
  };
}

const names = (voices: Voice[]) => voices.map((v) => v.customName);

describe('groupVoicesByKind', () => {
  it('lists Default Voices before Library Voices, and unknown kinds last', () => {
    const groups = groupVoicesByKind([voice('Ana', 'library'), voice('Eva', null), voice('Sara', 'default')]);

    expect(groups.map((g) => g.kind)).toEqual(['default', 'library', null]);
  });

  it('sorts favorites first within each group, then by name', () => {
    const groups = groupVoicesByKind([
      voice('Zoe', 'library', true),
      voice('Bea', 'default'),
      voice('Ana', 'library'),
      voice('Eva', 'default', true),
    ]);

    expect(names(groups[0].voices)).toEqual(['Eva', 'Bea']);
    expect(names(groups[1].voices)).toEqual(['Zoe', 'Ana']);
  });

  it('keeps a group when it is the only kind', () => {
    const groups = groupVoicesByKind([voice('Ana', 'library')]);

    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe('library');
  });

  it('returns no groups for no Voices', () => {
    expect(groupVoicesByKind([])).toEqual([]);
  });
});
