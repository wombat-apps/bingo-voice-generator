import type { SubscriptionInfo, Voice, VoiceKind } from '../types';

/**
 * Why the Active Account's Plan cannot generate with a voice of `kind`, or null if it can.
 * See docs/elevenlabs-plans.md: the Free Plan cannot use Library Voices via the API.
 */
export function voiceKindUnavailableReason(
  kind: VoiceKind,
  subscription: SubscriptionInfo | null
): string | null {
  if (subscription?.tier.toLowerCase() === 'free' && kind === 'library') {
    return 'No disponible con el plan Free';
  }
  return null;
}

/**
 * Why the Active Account's Plan cannot generate with `voice`, or null if it can.
 * Voices whose kind is still unknown count as available until they are backfilled.
 */
export function voiceUnavailableReason(
  voice: Voice,
  subscription: SubscriptionInfo | null
): string | null {
  return voice.kind ? voiceKindUnavailableReason(voice.kind, subscription) : null;
}
