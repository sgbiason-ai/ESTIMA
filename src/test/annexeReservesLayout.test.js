import { describe, expect, it } from 'vitest';
import jsPDF from 'jspdf';
import {
  buildReservePhotoRows,
  countReservePhotos,
  generateAnnexeReservesPdf,
  normalizeReservePdfMode,
} from '../utils/docAdmin/annexeReserves';

describe('mise en page de l’annexe PDF des réserves', () => {
  it('utilise le mode détaillé par défaut et accepte le mode compact', () => {
    expect(normalizeReservePdfMode()).toBe('detailed');
    expect(normalizeReservePdfMode('detailed')).toBe('detailed');
    expect(normalizeReservePdfMode('compact')).toBe('compact');
    expect(normalizeReservePdfMode('inconnu')).toBe('detailed');
  });

  it('compte toutes les photos, y compris l’ancien champ image', () => {
    expect(countReservePhotos([
      { images: ['a', 'b'] },
      { image: 'legacy' },
      { images: [] },
    ])).toBe(3);
  });

  it('regroupe deux paysages et agrandit les portraits séparément', () => {
    const landscapeA = { image: { width: 1600, height: 900 } };
    const landscapeB = { image: { width: 1200, height: 900 } };
    const portrait = { image: { width: 700, height: 1200 } };
    const unavailable = { image: null };

    expect(buildReservePhotoRows([landscapeA, landscapeB, portrait, unavailable])).toEqual([
      [landscapeA, landscapeB],
      [portrait],
      [unavailable],
    ]);
  });

  it('conserve l’annexe historique de l’EXE6', async () => {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    await generateAnnexeReservesPdf(pdf, {
      dateOPR: '2026-07-21',
      reserves: [{ numero: '1', designation: 'Reprendre le joint du regard', delaiLevee: '2026-08-15', images: [] }],
    }, 'EXE6', { sectionD: { objet: 'Marché de voirie' } });

    expect(pdf.internal.getNumberOfPages()).toBe(2);
    expect(pdf.output('arraybuffer').byteLength).toBeGreaterThan(1_000);
  });
});
