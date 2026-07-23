import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchIgnRoute } from '../utils/geoHelpers';

describe('routage IGN mobile', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('convertit les coordonnées IGN [longitude, latitude] pour la carte', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        distance: 123.4,
        geometry: { coordinates: [[1.44, 43.61], [1.45, 43.62]] },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchIgnRoute(
      { lat: 43.61, lng: 1.44 },
      { lat: 43.62, lng: 1.45 },
      0
    )).resolves.toEqual({
      distance: 123.4,
      coordinates: [[43.61, 1.44], [43.62, 1.45]],
    });
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it('abandonne la requête après huit secondes et permet le repli local', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    })));

    const request = fetchIgnRoute(
      { lat: 43.61, lng: 1.44 },
      { lat: 43.62, lng: 1.45 },
      0
    );
    await vi.advanceTimersByTimeAsync(8000);

    await expect(request).resolves.toBeNull();
  });
});
