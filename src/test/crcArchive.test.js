// Tests pour src/utils/crcArchive.js
import { describe, it, expect } from 'vitest';
import { exportCrcArchive, importCrcArchive } from '../utils/crcArchive';

// ─── exportCrcArchive ───────────────────────────────────────────────────────

describe('exportCrcArchive', () => {
  const mockDoc = {
    crrConfig: {
      chantierInfo: { nom: 'Test Chantier' },
      categories: ['Travaux', 'Admin'],
      participantGroups: [{ id: 'g1', name: 'MOE', contacts: [] }],
    },
    crrMeetings: [
      { id: 'm1', number: 1, observations: [{ id: 'o1' }, { id: 'o2' }] },
    ],
  };

  it('retourne un blob et un filename', async () => {
    const { blob, filename } = await exportCrcArchive(mockDoc, 'user@test.com');
    expect(blob).toBeInstanceOf(Blob);
    expect(filename).toMatch(/\.crcestima$/);
  });

  it('le filename contient le nom du chantier sanitize', async () => {
    const { filename } = await exportCrcArchive(mockDoc, 'user@test.com');
    expect(filename).toContain('TEST_CHANTIER');
  });

  it('le filename contient la date', async () => {
    const { filename } = await exportCrcArchive(mockDoc, 'user@test.com');
    const today = new Date().toISOString().split('T')[0];
    expect(filename).toContain(today);
  });

  it('le blob contient du JSON valide (version 2 autosuffisant)', async () => {
    const { blob, stats } = await exportCrcArchive(mockDoc, 'user@test.com');
    const text = await blob.text();
    const parsed = JSON.parse(text);
    expect(parsed.format).toBe('crcestima');
    expect(parsed.version).toBe(2);
    expect(parsed.exportedBy).toBe('user@test.com');
    expect(parsed.data.crrConfig).toBeDefined();
    expect(parsed.data.crrMeetings).toHaveLength(1);
    // Aucune image dans le mockDoc -> stats vides
    expect(stats.total).toBe(0);
  });

  it('gere un nom de chantier avec accents', async () => {
    const doc = { ...mockDoc, crrConfig: { ...mockDoc.crrConfig, chantierInfo: { nom: 'Résumé été' } } };
    const { filename } = await exportCrcArchive(doc, '');
    expect(filename).toContain('RESUME_ETE');
  });

  it('gere un doc sans nom de chantier', async () => {
    const doc = { crrConfig: {}, crrMeetings: [] };
    const { filename } = await exportCrcArchive(doc, '');
    expect(filename).toContain('CHANTIER');
  });

  it('gere un doc sans meetings', async () => {
    const doc = { crrConfig: mockDoc.crrConfig };
    const { blob } = await exportCrcArchive(doc, '');
    expect(blob).toBeInstanceOf(Blob);
  });

  it('embarque les images base64 telles quelles (sans re-fetch)', async () => {
    const dataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
    const doc = {
      crrConfig: { chantierInfo: { nom: 'T' } },
      crrMeetings: [{
        id: 'm1', number: 1,
        observations: [{ id: 'o1', images: [{ src: dataUrl, lat: 44.5, lng: 1.5 }] }],
      }],
    };
    const { blob, stats } = await exportCrcArchive(doc, '');
    const parsed = JSON.parse(await blob.text());
    expect(parsed.data.crrMeetings[0].observations[0].images[0].src).toBe(dataUrl);
    expect(stats.total).toBe(0); // base64 deja autosuffisant, pas compte
  });
});

// ─── importCrcArchive ───────────────────────────────────────────────────────

describe('importCrcArchive', () => {
  const createFile = (content) => {
    const blob = new Blob([JSON.stringify(content)], { type: 'application/json' });
    return new File([blob], 'test.crcestima');
  };

  const validArchive = {
    format: 'crcestima',
    version: 1,
    exportedAt: '2026-04-04T12:00:00.000Z',
    exportedBy: 'test@test.com',
    data: {
      crrConfig: {
        chantierInfo: { nom: 'Mon Chantier' },
        categories: ['Travaux'],
        participantGroups: [{ id: 'g1', name: 'MOE', contacts: [{ id: 'c1' }] }],
      },
      crrMeetings: [
        {
          id: 'm1', number: 1,
          observations: [
            { id: 'o1', images: [{ id: 'img1' }] },
            { id: 'o2', images: [] },
          ],
        },
        { id: 'm2', number: 2, observations: [] },
      ],
    },
  };

  it('valide un fichier correct', async () => {
    const result = await importCrcArchive(createFile(validArchive));
    expect(result.valid).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.summary).toBeDefined();
  });

  it('calcule le resume correctement', async () => {
    const result = await importCrcArchive(createFile(validArchive));
    expect(result.summary.chantierName).toBe('Mon Chantier');
    expect(result.summary.meetingCount).toBe(2);
    expect(result.summary.observationCount).toBe(2);
    expect(result.summary.imageCount).toBe(1);
    expect(result.summary.categories).toBe(1);
    expect(result.summary.participantGroups).toBe(1);
  });

  it('rejette un format invalide', async () => {
    const result = await importCrcArchive(createFile({ format: 'wrong', version: 1, data: {} }));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Format');
  });

  it('rejette une version trop recente', async () => {
    const result = await importCrcArchive(createFile({ format: 'crcestima', version: 99, data: {} }));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Version');
  });

  it('rejette un fichier sans data', async () => {
    const result = await importCrcArchive(createFile({ format: 'crcestima', version: 1 }));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('manquantes');
  });

  it('rejette un fichier sans crrConfig', async () => {
    const result = await importCrcArchive(createFile({ format: 'crcestima', version: 1, data: {} }));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Configuration');
  });

  it('rejette un JSON invalide', async () => {
    const blob = new Blob(['not json at all {{{'], { type: 'text/plain' });
    const file = new File([blob], 'bad.crcestima');
    const result = await importCrcArchive(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Erreur');
  });

  it('gere un fichier sans meetings', async () => {
    const archive = {
      ...validArchive,
      data: { crrConfig: validArchive.data.crrConfig },
    };
    const result = await importCrcArchive(createFile(archive));
    expect(result.valid).toBe(true);
    expect(result.summary.meetingCount).toBe(0);
  });

  it('gere un chantier sans nom', async () => {
    const archive = {
      ...validArchive,
      data: { crrConfig: {}, crrMeetings: [] },
    };
    const result = await importCrcArchive(createFile(archive));
    expect(result.valid).toBe(true);
    expect(result.summary.chantierName).toBe('Sans nom');
  });
});
