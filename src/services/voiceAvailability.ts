import type { SubscriptionInfo, Voice } from '../types';

/**
 * Why the Active Account's Plan cannot generate with `voice`, or null if it can.
 * See docs/elevenlabs-plans.md: the Free Plan cannot use Library Voices via the API.
 * Voices whose kind is still unknown count as available until they are backfilled.
 */
export function voiceUnavailableReason(
  voice: Voice,
  subscription: SubscriptionInfo | null
): string | null {
  if (subscription?.tier.toLowerCase() === 'free' && voice.kind === 'library') {
    return 'No disponible con el plan Free';
  }
  return null;
}
