import { beforeEach, describe, expect, it, vi } from 'vitest';
import { asMockedApiClient, mockApiClient } from '../test-support/mockApiClient';

vi.mock('./client', () => ({ apiClient: mockApiClient() }));
vi.mock('@simplewebauthn/browser', () => ({
  startAuthentication: vi.fn(),
  startRegistration: vi.fn(),
}));

import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { apiClient as realApiClient } from './client';
import { runAuthentication, runRegistration } from './webauthn';

const apiClient = asMockedApiClient(realApiClient);

function jsonResult(status: number, data?: unknown) {
  return { data, error: undefined, response: new Response(null, { status }) };
}

const OPTIONS = { challenge: 'abc' };
const CREDENTIAL = { id: 'cred-1' };

function optionsThen(verifyStatus: number, optionsStatus = 200) {
  apiClient.POST.mockImplementation(async (path: string) =>
    path.endsWith('/options') ? jsonResult(optionsStatus, OPTIONS) : jsonResult(verifyStatus),
  );
}

beforeEach(() => {
  apiClient.POST.mockReset();
  vi.mocked(startAuthentication).mockReset();
  vi.mocked(startRegistration).mockReset();
});

describe('runAuthentication', () => {
  it('runs options → prompt → verify', async () => {
    optionsThen(200);
    vi.mocked(startAuthentication).mockResolvedValueOnce(CREDENTIAL as never);

    await expect(runAuthentication('/webauthn/authentication')).resolves.toEqual({ ok: true });
    expect(startAuthentication).toHaveBeenCalledWith({ optionsJSON: OPTIONS });
    expect(apiClient.POST).toHaveBeenLastCalledWith('/webauthn/authentication/verify', {
      body: { response: CREDENTIAL },
    });
  });

  it('reports rate-limited when options return 429', async () => {
    optionsThen(200, 429);
    await expect(runAuthentication('/webauthn/step-up')).resolves.toEqual({
      ok: false,
      reason: 'rate-limited',
    });
    expect(startAuthentication).not.toHaveBeenCalled();
  });

  it('reports rejected when options are refused', async () => {
    optionsThen(200, 401);
    await expect(runAuthentication('/webauthn/step-up')).resolves.toEqual({
      ok: false,
      reason: 'rejected',
    });
  });

  it('reports cancelled without verifying when the prompt throws', async () => {
    optionsThen(200);
    vi.mocked(startAuthentication).mockRejectedValueOnce(new Error('cancelled'));
    await expect(runAuthentication('/webauthn/step-up')).resolves.toEqual({
      ok: false,
      reason: 'cancelled',
    });
    expect(apiClient.POST).toHaveBeenCalledTimes(1);
  });

  it('reports rejected / rate-limited from verify', async () => {
    vi.mocked(startAuthentication).mockResolvedValue(CREDENTIAL as never);
    optionsThen(401);
    await expect(runAuthentication('/webauthn/step-up')).resolves.toEqual({
      ok: false,
      reason: 'rejected',
    });
    optionsThen(429);
    await expect(runAuthentication('/webauthn/step-up')).resolves.toEqual({
      ok: false,
      reason: 'rate-limited',
    });
  });
});

describe('runRegistration', () => {
  it('sends optionsBody with options and merges verifyBody into verify', async () => {
    optionsThen(200);
    vi.mocked(startRegistration).mockResolvedValueOnce(CREDENTIAL as never);

    await expect(
      runRegistration('/webauthn/signup', {
        optionsBody: { key: 'k' },
        verifyBody: { deviceName: 'phone' },
      }),
    ).resolves.toEqual({ ok: true });
    expect(apiClient.POST).toHaveBeenNthCalledWith(1, '/webauthn/signup/options', {
      body: { key: 'k' },
    });
    expect(startRegistration).toHaveBeenCalledWith({ optionsJSON: OPTIONS });
    expect(apiClient.POST).toHaveBeenLastCalledWith('/webauthn/signup/verify', {
      body: { response: CREDENTIAL, deviceName: 'phone' },
    });
  });

  it('posts options without a body when none is given', async () => {
    optionsThen(200);
    vi.mocked(startRegistration).mockResolvedValueOnce(CREDENTIAL as never);
    await runRegistration('/webauthn/registration');
    expect(apiClient.POST).toHaveBeenNthCalledWith(1, '/webauthn/registration/options', undefined);
  });

  it('maps rate-limit, refusal, cancel and verify failure', async () => {
    optionsThen(200, 429);
    await expect(runRegistration('/webauthn/registration')).resolves.toEqual({
      ok: false,
      reason: 'rate-limited',
    });
    optionsThen(200, 400);
    await expect(runRegistration('/webauthn/registration')).resolves.toEqual({
      ok: false,
      reason: 'rejected',
    });
    optionsThen(200);
    vi.mocked(startRegistration).mockRejectedValueOnce(new Error('cancelled'));
    await expect(runRegistration('/webauthn/registration')).resolves.toEqual({
      ok: false,
      reason: 'cancelled',
    });
    optionsThen(400);
    vi.mocked(startRegistration).mockResolvedValueOnce(CREDENTIAL as never);
    await expect(runRegistration('/webauthn/registration')).resolves.toEqual({
      ok: false,
      reason: 'rejected',
    });
  });
});
