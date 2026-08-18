/**
 * @fileoverview Options CdoService hands to `fetchWithTimeout`.
 *
 * CDO answers a missing station with HTTP 200 and a bare `{}` — never a 404 —
 * so declaring 404 an expected status on that route describes a response the
 * endpoint cannot produce. The not-found path is the `!station.id` check in the
 * handlers, not a status mapping.
 * @module tests/services/cdo-service-request-options.test
 */

import { createMockContext } from '@cyanheads/mcp-ts-core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/config/server-config.js', () => ({
  getServerConfig: vi.fn().mockReturnValue({ token: 'test-token-1234' }),
}));

vi.mock('@cyanheads/mcp-ts-core/utils', async (importOriginal) => {
  const original = await importOriginal<typeof import('@cyanheads/mcp-ts-core/utils')>();
  return {
    ...original,
    withRetry: vi.fn(async (fn: () => Promise<unknown>) => fn()),
    fetchWithTimeout: vi.fn(),
  };
});

import { fetchWithTimeout } from '@cyanheads/mcp-ts-core/utils';
import { CdoService } from '@/services/cdo/cdo-service.js';

/** Options object from the most recent fetchWithTimeout call. */
function lastOptions(): Record<string, unknown> {
  const call = vi.mocked(fetchWithTimeout).mock.calls.at(-1);
  if (!call) throw new Error('fetchWithTimeout was never called.');
  return (call[3] ?? {}) as Record<string, unknown>;
}

beforeEach(() => {
  vi.mocked(fetchWithTimeout).mockReset();
  // A fresh Response per call — a shared instance throws "Body already used".
  vi.mocked(fetchWithTimeout).mockImplementation(
    async () =>
      new Response(JSON.stringify({ id: 'GHCND:USC00450974', name: 'YAKIMA WA US' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  );
});

describe('CdoService — request options', () => {
  it('getStation declares no expected non-2xx statuses', async () => {
    const service = new CdoService('https://mock-cdo.test/v2');
    await service.getStation('GHCND:USC00450974', createMockContext());

    expect(lastOptions()).not.toHaveProperty('expectedStatuses');
  });

  it('no CDO route declares an expected non-2xx status', async () => {
    const service = new CdoService('https://mock-cdo.test/v2');
    const ctx = createMockContext();

    await service.listDatasets({}, ctx);
    await service.listDataCategories({}, ctx);
    await service.listDataTypes({}, ctx);
    await service.findLocations({}, ctx);
    await service.findStations({}, ctx);
    await service.fetchData({ datasetid: 'GHCND' }, ctx);
    await service.getStation('GHCND:USC00450974', ctx);

    for (const call of vi.mocked(fetchWithTimeout).mock.calls) {
      expect(call[3] ?? {}).not.toHaveProperty('expectedStatuses');
    }
  });

  it('still authenticates every request with the token header', async () => {
    const service = new CdoService('https://mock-cdo.test/v2');
    await service.getStation('GHCND:USC00450974', createMockContext());

    expect(lastOptions().headers).toMatchObject({ token: 'test-token-1234' });
  });

  it('returns the bare {} CDO sends for a missing station rather than a 404', async () => {
    vi.mocked(fetchWithTimeout).mockResolvedValueOnce(
      new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    const service = new CdoService('https://mock-cdo.test/v2');
    const station = await service.getStation('GHCND:NOT-REAL', createMockContext());

    expect(station).toEqual({});
  });
});
