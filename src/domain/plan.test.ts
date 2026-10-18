import { describe, expect, it } from 'vitest';
import type { SubscriptionInfo } from '../types';
import { planErrorMessage, unavailableReason, worksOnEveryPlan } from './plan';

const plan = (tier: string): SubscriptionInfo => ({
  tier,
  characterCount: 0,
  characterLimit: 10000,
  status: 'active',
  nextCharacterCountResetUnix: null,
});

describe('Plan rules', () => {
  it('keeps Library Voices from the Free Plan only', () => {
    expect(unavailableReason('library', plan('Free'))).not.toBeNull();
    expect(unavailableReason('library', plan('creator'))).toBeNull();
    expect(unavailableReason('default', plan('free'))).toBeNull();
    // Unknown kinds and unknown Plans do not block generation
    expect(unavailableReason(null, plan('free'))).toBeNull();
    expect(unavailableReason('library', null)).toBeNull();
  });

  it('marks only Default Voices as working on every Plan', () => {
    expect(worksOnEveryPlan('default')).toBe(true);
    expect(worksOnEveryPlan('library')).toBe(false);
  });

  it('recognises errors caused by the Plan', () => {
    expect(planErrorMessage('paid_plan_required', 402, 'x')).toMatch(/plan Free/);
    expect(planErrorMessage('model_access_denied', 400, 'no')).toMatch(/no permite esta operación: no/);
    expect(planErrorMessage(null, 403, 'forbidden')).toMatch(/forbidden/);
    expect(planErrorMessage('rate_limit_exceeded', 429, 'x')).toBeNull();
  });
});
