import { describe, expect, it } from 'vitest';
import { describeGenerationError, describeUpdateError, isSharingDisabled } from './errors';

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

describe('isSharingDisabled', () => {
  it('spots a Library Voice its owner stopped sharing', () => {
    expect(isSharingDisabled(api(400, 'sharing_not_enabled'))).toBe(true);
  });

  it('ignores other failures', () => {
    expect(isSharingDisabled(api(400, 'bad_request'))).toBe(false);
    expect(isSharingDisabled(api(401, 'unauthorized'))).toBe(false);
    expect(isSharingDisabled({ code: 'NETWORK_ERROR', message: 'sharing_not_enabled' })).toBe(false);
  });
});

describe('describeUpdateError', () => {
  it('shows the message of an UPDATE_ERROR', () => {
    expect(describeUpdateError({ code: 'UPDATE_ERROR', message: 'signature mismatch' })).toBe(
      "Couldn't update: signature mismatch",
    );
  });

  it('falls back to any error message', () => {
    expect(describeUpdateError(new Error('offline'))).toBe("Couldn't update: offline");
  });
});
