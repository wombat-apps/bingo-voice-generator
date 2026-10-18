import type { SubscriptionInfo, Voice } from '../types';

// See docs/elevenlabs-plans.md: the Free Plan cannot use Library Voices via the API.
function isFreePlan(subscription: SubscriptionInfo | null): boolean {
  return subscription?.tier.toLowerCase() === 'free';
}

/**
 * Why the Active Account's Plan cannot generate with `voice`, or null if it can.
 * Voices whose kind is still unknown count as available until they are backfilled.
 */
export function voiceUnavailableReason(
  voice: Voice,
  subscription: SubscriptionInfo | null
): string | null {
  if (isFreePlan(subscription) && voice.kind === 'library') {
    return 'No disponible con el plan Free';
  }
  return null;
}

/** Why the Active Account's Plan cannot add Library Voices, or null if it can. */
export function libraryVoicesUnavailableReason(
  subscription: SubscriptionInfo | null
): string | null {
  if (isFreePlan(subscription)) {
    return 'El plan Free no permite usar voces de la Voice Library por API';
  }
  return null;
}
