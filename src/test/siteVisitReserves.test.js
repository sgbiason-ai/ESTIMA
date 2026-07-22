import { describe, expect, it } from 'vitest';
import {
  getReserveImages,
  siteVisitToReserves,
} from '../utils/docAdmin/siteVisitReserves';

describe('siteVisitToReserves', () => {
  it('importe toutes les observations, toutes les photos et les repères de la trace', () => {
    const visit = {
      id: 'visit-1',
      nom: 'OPR rue des Écoles',
      lieu: 'Lavaur',
      client: 'Commune',
      date: '2026-07-22',
      gpsTracking: {
        coordinates: [
          { lat: 43.69, lng: 1.81 },
          { lat: 43.691, lng: 1.812 },
        ],
        distance: 245,
      },
      observations: [
        {
          id: 'obs-1',
          text: '<p>Reprendre le <strong>regard</strong></p>',
          date: '2026-07-22',
          pointLocation: { lat: 43.6905, lng: 1.811 },
          images: [
            { src: 'https://example.test/1.jpg', path: 'visits/1.jpg', lat: 43.6905, lng: 1.811 },
            'data:image/png;base64,AAAA',
          ],
        },
        {
          id: 'obs-2',
          text: '',
          images: [{ src: 'https://example.test/2.jpg' }],
        },
      ],
    };

    const result = siteVisitToReserves(visit, '2026-07-22T12:00:00.000Z');

    expect(result.reserves).toHaveLength(2);
    expect(result.reserves[0]).toMatchObject({
      numero: '1',
      designation: 'Reprendre le regard',
      sourceObservationId: 'obs-1',
    });
    expect(result.reserves[0].images).toHaveLength(2);
    expect(result.reserves[1].designation).toBe('Observation 2');
    expect(result.source).toMatchObject({
      id: 'visit-1',
      nom: 'OPR rue des Écoles',
      observationCount: 2,
      photoCount: 3,
    });
    expect(result.source.mapVisit.gpsTracking.coordinates).toHaveLength(2);
    expect(result.source.mapVisit.observations[0].pointLocation).toEqual({ lat: 43.6905, lng: 1.811 });
    expect(result.source.mapVisit.observations[0].images).toEqual([{ lat: 43.6905, lng: 1.811 }]);
  });

  it('reste rétrocompatible avec la photo unique des anciennes réserves', () => {
    expect(getReserveImages({ image: 'data:image/jpeg;base64,AAAA' }))
      .toEqual(['data:image/jpeg;base64,AAAA']);
    expect(getReserveImages({
      image: 'ancienne',
      images: [{ src: 'nouvelle' }, null],
    })).toEqual([{ src: 'nouvelle' }]);
  });
});
