import { describe, expect, it } from 'vitest';
import { detailLabel } from './voiceDetails';

describe('detailLabel', () => {
  it('turns ElevenLabs identifiers into words', () => {
    expect(detailLabel('middle_aged')).toBe('middle aged');
    expect(detailLabel('narrative_story')).toBe('narrative story');
  });

  it('keeps labels that are already words', () => {
    expect(detailLabel('latin american')).toBe('latin american');
  });
});
