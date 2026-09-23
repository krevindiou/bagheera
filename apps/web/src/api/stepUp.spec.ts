import { beforeEach, describe, expect, it, vi } from 'vitest';
import { asMockedApiClient, mockApiClient } from '../test-support/mockApiClient';

vi.mock('./client', () => ({ apiClient: mockApiClient() }));
vi.mock('@simplewebauthn/browser', () => ({ startAuthentication: vi.fn() }));

import { startAuthentication } from '@simplewebauthn/browser';
import { apiClient as realApiClient } from './client';
import { completeStepUp } from './stepUp';

const apiClient = asMockedApiClient(realApiClient);

function jsonResult(status: number, data?: unknown) {
  return { data, error: undefined, response: new Response(null, { status }) };
}

const OPTIONS = { challenge: 'abc' };
const ASSERTION = { id: 'cred-1' };

describe('completeStepUp', () => {
  beforeEach(() => {
    apiClient.POST.mockReset();
    vi.mocked(startAuthentication).mockReset();
  });

  it('runs options → passkey prompt → verify and resolves true', async () => {
    apiClient.POST.mockImplementation(async (path: string) =>
      path === '/webauthn/step-up/options' ? jsonResult(200, OPTIONS) : jsonResult(200),
    );
    vi.mocked(startAuthentication).mockResolvedValueOnce(
      ASSERTION as unknown as Awaited<ReturnType<typeof startAuthentication>>,
    );

    await expect(completeStepUp()).resolves.toBe(true);
    expect(startAuthentication).toHaveBeenCalledWith({ optionsJSON: OPTIONS });
    expect(apiClient.POST).toHaveBeenLastCalledWith('/webauthn/step-up/verify', {
      body: { response: ASSERTION },
    });
  });

  it('resolves false without prompting when options are refused', async () => {
    apiClient.POST.mockResolvedValueOnce(jsonResult(401));

    await expect(completeStepUp()).resolves.toBe(false);
    expect(startAuthentication).not.toHaveBeenCalled();
  });

  it('resolves false without verifying when the prompt is cancelled', async () => {
    apiClient.POST.mockResolvedValueOnce(jsonResult(200, OPTIONS));
    vi.mocked(startAuthentication).mockRejectedValueOnce(new Error('cancelled'));

    await expect(completeStepUp()).resolves.toBe(false);
    expect(apiClient.POST).toHaveBeenCalledTimes(1);
  });

  it('resolves false when verification is refused', async () => {
    apiClient.POST.mockImplementation(async (path: string) =>
      path === '/webauthn/step-up/options' ? jsonResult(200, OPTIONS) : jsonResult(401),
    );
    vi.mocked(startAuthentication).mockResolvedValueOnce(
      ASSERTION as unknown as Awaited<ReturnType<typeof startAuthentication>>,
    );

    await expect(completeStepUp()).resolves.toBe(false);
  });
});
