import { describe, expect, it } from 'vitest';
import { describeGenerationError } from './errors';

const api = (status: number, apiCode: string | null, message = 'msg') => ({
  code: 'API_ERROR' as const,
  status,
  apiCode,
  message,
});

describe('describeGenerationError', () => {
  it('names the account when its key is wrong', () => {
    expect(describeGenerationError(api(401, 'invalid_api_key'), 'Personal')).toMatch(/"Personal"/);
  });

  it('explains Plan errors through the Plan rules', () => {
    expect(describeGenerationError(api(402, 'paid_plan_required'), null)).toMatch(/plan Free/);
    expect(describeGenerationError(api(403, null, 'nope'), null)).toMatch(/nope/);
  });

  it('covers the errors that never reach ElevenLabs', () => {
    expect(describeGenerationError({ code: 'NO_ACTIVE_ACCOUNT', message: '' }, null)).toMatch(/selecciona una cuenta/);
    expect(describeGenerationError({ code: 'STORAGE_ERROR', message: 'disk full' }, null)).toMatch(/disk full/);
    expect(describeGenerationError('boom', null)).toMatch(/boom/);
  });
});
