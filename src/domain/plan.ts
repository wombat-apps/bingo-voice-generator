/**
 * What an ElevenLabs Plan allows, as far as the app cares (see GLOSSARY.md and
 * docs/elevenlabs-plans.md): the Free Plan cannot generate with Library Voices via the API,
 * and some errors mean the Plan, not the request, is the problem.
 */

import type { SubscriptionInfo, VoiceKind } from '../types';

function isFreePlan(subscription: SubscriptionInfo | null): boolean {
  return subscription?.tier.toLowerCase() === 'free';
}

/**
 * Why the Active Account's Plan cannot generate with a voice of `kind`, or null if it can.
 * A Voice whose kind is still unknown (`null`) counts as available until it is backfilled.
 */
export function unavailableReason(
  kind: VoiceKind | null,
  subscription: SubscriptionInfo | null
): string | null {
  if (kind === 'library' && isFreePlan(subscription)) {
    return 'No disponible con el plan Free';
  }
  return null;
}

/** Whether every Plan, Free included, can generate with a voice of `kind`. */
export function worksOnEveryPlan(kind: VoiceKind): boolean {
  return kind === 'default';
}

/** ElevenLabs codes for something the account's Plan does not allow. */
const PLAN_CODES = new Set([
  'subscription_required',
  'feature_not_available',
  'voice_access_denied',
  'model_access_denied',
]);

/** The message for an ElevenLabs error caused by the Plan, or null if the Plan is not why. */
export function planErrorMessage(apiCode: string | null, status: number, message: string): string | null {
  if (apiCode === 'paid_plan_required') {
    return 'El plan Free de ElevenLabs no permite usar voces de la biblioteca (Library Voices) por API. Usa una voz predeterminada o mejora tu plan.';
  }
  if ((apiCode && PLAN_CODES.has(apiCode)) || status === 403) {
    return `Tu plan de ElevenLabs no permite esta operación: ${message}`;
  }
  return null;
}
