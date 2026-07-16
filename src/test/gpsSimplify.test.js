import { describe, expect, it } from 'vitest';
import { cleanGpsTrace, createGpsFixProcessor, GPS_TRACK_CONFIG } from '../utils/gpsSimplify';

const point = (lat, seconds, accuracy = 5, extra = {}) => ({
  lat,
  lng: 2,
  accuracy,
  timestamp: new Date(Date.UTC(2026, 0, 1, 10, 0, seconds)).toISOString(),
  ...extra,
});

describe('filtrage des traces GPS', () => {
  it('utilise les seuils chantier attendus', () => {
    expect(GPS_TRACK_CONFIG).toMatchObject({
      maxAccuracy: 15,
      maxSpeedKmh: 15,
      minDistance: 2.5,
      simplifyTolerance: 2,
    });
  });

  it('rejette un point dont la précision dépasse 15 m', () => {
    const processor = createGpsFixProcessor();
    expect(processor.push(point(43.6, 0, 22))).toBeNull();
    expect(processor.push(point(43.6, 1, 5))).not.toBeNull();
  });

  it('rejette un saut incompatible avec un déplacement à pied', () => {
    const processor = createGpsFixProcessor();
    expect(processor.push(point(43.6, 0))).not.toBeNull();
    expect(processor.push(point(43.601, 1))).toBeNull();
  });

  it('conserve des positions régulières espacées d’environ 3 m', () => {
    const processor = createGpsFixProcessor();
    const accepted = [
      processor.push(point(43.6, 0)),
      processor.push(point(43.60003, 5)),
      processor.push(point(43.60006, 10)),
      processor.push(point(43.60009, 15)),
    ].filter(Boolean);
    expect(accepted.length).toBeGreaterThanOrEqual(2);
  });

  it('retire une pointe isolée et les fixes trop imprécis d’une ancienne trace', () => {
    const trace = [
      point(43.6, 0),
      point(43.60003, 5),
      { ...point(43.601, 10), lng: 2.001 },
      point(43.60006, 15),
      point(43.60009, 20),
      point(43.60012, 25, 30),
    ];
    const cleaned = cleanGpsTrace(trace);
    expect(cleaned.length).toBeLessThan(trace.length);
    expect(cleaned.every(item => !item.accuracy || item.accuracy <= 15)).toBe(true);
    expect(cleaned.every(item => item.lat < 43.6005)).toBe(true);
  });

  it('préserve les coupures entre deux sessions', () => {
    const trace = [point(43.6, 0), point(43.60003, 5), { break: true }, point(43.7, 10), point(43.70003, 15)];
    expect(cleanGpsTrace(trace).some(item => item.break === true)).toBe(true);
  });
});
