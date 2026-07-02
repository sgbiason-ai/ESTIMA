// Export PDF de l'audit des prix — test de fumée.
// Vérifie que le générateur produit un blob non vide contenant les stats,
// les chapitres et les lignes affichées (avec et sans prix observé RAO).
import { describe, it, expect, vi } from 'vitest';

let capturedBlob = null;
let capturedName = null;
vi.mock('../utils/fileSaver', async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...mod,
    saveFileWithPicker: vi.fn(async (blob, name) => { capturedBlob = blob; capturedName = name; }),
  };
});

import { generatePriceAuditPdf } from '../utils/pdf/pdfPriceAuditGenerator';

const baseRow = {
  unit: 'm3', projectPrice: 12, bpuPrice: 10, diff: 2, pctDiff: 20,
  observedPrice: null, obsPctDiff: null, status: 'diff', path: ['TERRASSEMENTS'],
};

const rows = [
  { ...baseRow, id: 'i1', designation: 'ZZDEBLAIS EN MASSE' },
  { ...baseRow, id: 'i2', designation: 'ZZFOUILLE TRANCHEE', status: 'match', diff: 0, pctDiff: 0, bpuPrice: 12 },
  { ...baseRow, id: 'i3', designation: 'ZZARTICLE ABSENT', status: 'missing', bpuPrice: null, diff: null, pctDiff: null, path: ['VOIRIE', 'BORDURES'] },
];

const stats = { total: 3, match: 1, diff: 1, missing: 1 };

describe('generatePriceAuditPdf (fumée)', () => {
  it('produit un PDF avec chapitres, lignes et statuts (sans prix observé)', async () => {
    capturedBlob = null;
    await generatePriceAuditPdf({
      project: { name: 'Projet Audit Test' },
      rows, stats, totalImpact: 2, filterMode: 'all', search: '', branding: null,
    });
    expect(capturedBlob).toBeInstanceOf(Blob);
    expect(capturedBlob.size).toBeGreaterThan(800);
    expect(capturedName).toMatch(/^Audit_Prix_.*\.pdf$/);
    const raw = new TextDecoder('latin1').decode(await capturedBlob.arrayBuffer());
    expect(raw).toContain('AUDIT DES PRIX');
    expect(raw).toContain('TERRASSEMENTS');
    expect(raw).toContain('ZZDEBLAIS EN MASSE');
    expect(raw).toContain('ZZARTICLE ABSENT');
    // Pas de colonne « Prix observé » quand aucune ligne n'en porte
    expect(raw).not.toContain('Prix observ');
  });

  it('ajoute la colonne « Prix observé » quand au moins une ligne en porte un', async () => {
    capturedBlob = null;
    await generatePriceAuditPdf({
      project: { name: 'Projet Audit Test' },
      rows: [{ ...baseRow, id: 'i1', designation: 'ZZAVEC OBSERVE', observedPrice: 11, obsPctDiff: 9.1 }],
      stats, totalImpact: 2, filterMode: 'diff', search: 'bordure', branding: null,
    });
    const raw = new TextDecoder('latin1').decode(await capturedBlob.arrayBuffer());
    expect(raw).toContain('Prix observ');
    // Le contexte reflète le filtre et la recherche actifs
    expect(raw).toContain('carts uniquement');
    expect(raw).toContain('bordure');
  });
});
