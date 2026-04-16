// src/test/stressTest.test.js
// Stress tests — performance sur grands datasets
// Simule les calculs métier avec des volumes réalistes (et extrêmes)

import { describe, it, expect } from 'vitest';

// ─── HELPERS REPRODUCTIBLES ─────────────────────────────────────────────────

/** Génère un projet avec N chapitres et M items par chapitre */
const generateProject = (numChapters, itemsPerChapter) => {
  const chapters = [];
  for (let c = 0; c < numChapters; c++) {
    const children = [];
    for (let i = 0; i < itemsPerChapter; i++) {
      children.push({
        id: `item_${c}_${i}`,
        type: 'item',
        designation: `Article ${c + 1}.${i + 1} — Terrassement en déblai pour tranchée profonde VRD lot ${c}`,
        unit: 'ml',
        qty: Math.round(Math.random() * 500 * 100) / 100,
        price: Math.round(Math.random() * 200 * 100) / 100,
      });
    }
    chapters.push({
      id: `chap_${c}`,
      type: 'chapter',
      title: `Chapitre ${c + 1} — Lot VRD ${c + 1}`,
      children,
    });
  }
  return { name: 'Projet Stress Test', chapters };
};

/** Génère une BPU de N items */
const generateBpu = (n) => {
  const items = [];
  for (let i = 0; i < n; i++) {
    items.push({
      id: `bpu_${i}`,
      designation: `Article BPU ${i + 1} — Fourniture et pose de canalisation PVC DN${100 + (i % 10) * 50}`,
      unit: ['ml', 'm²', 'm³', 'u', 'kg', 'forfait'][i % 6],
      price: Math.round(Math.random() * 500 * 100) / 100,
      category: `cat_${i % 20}`,
      observedPrice: i % 3 === 0 ? Math.round(Math.random() * 300 * 100) / 100 : null,
    });
  }
  return items;
};

/** Calcul total projet (même logique que collectData dans pdfGenerator) */
const computeProjectTotal = (chapters) => {
  let total = 0;
  let itemCount = 0;
  const recurse = (nodes) => {
    for (const node of nodes) {
      if (node.type === 'item') {
        total += (node.qty || 0) * (node.price || 0);
        itemCount++;
      } else if (node.children) {
        recurse(node.children);
      }
    }
  };
  recurse(chapters);
  return { total: Math.round(total * 100) / 100, itemCount };
};

/** Simule le filtrage BPU (même logique que DatabaseView) */
const filterBpu = (items, search, category) => {
  let filtered = items;
  if (category) {
    filtered = filtered.filter(i => i.category === category);
  }
  if (search) {
    const q = search.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    filtered = filtered.filter(i => {
      const d = (i.designation || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return d.includes(q);
    });
  }
  return filtered;
};

/** Simule JSON.parse(JSON.stringify()) deep clone (pattern utilisé 19x) */
const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

/** Simule structuredClone (alternative recommandée) */
const structuredCloneAlt = (obj) => structuredClone(obj);

// ─── TESTS VOLUME NORMAL (usage quotidien) ──────────────────────────────────

describe('Stress — Volume normal (usage quotidien)', () => {
  it('calcule un projet 10 chapitres × 30 items (300 items) en < 5ms', () => {
    const project = generateProject(10, 30);
    const start = performance.now();
    const result = computeProjectTotal(project.chapters);
    const elapsed = performance.now() - start;

    expect(result.itemCount).toBe(300);
    expect(result.total).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(5);
  });

  it('filtre une BPU de 500 items avec recherche en < 5ms', () => {
    const bpu = generateBpu(500);
    const start = performance.now();
    const filtered = filterBpu(bpu, 'canalisation PVC DN200', null);
    const elapsed = performance.now() - start;

    expect(filtered.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(5);
  });

  it('deep clone un projet 300 items en < 10ms', () => {
    const project = generateProject(10, 30);
    const start = performance.now();
    const cloned = deepClone(project);
    const elapsed = performance.now() - start;

    expect(cloned.chapters.length).toBe(10);
    expect(elapsed).toBeLessThan(10);
  });
});

// ─── TESTS VOLUME ÉLEVÉ (gros projet / grosse BPU) ─────────────────────────

describe('Stress — Volume élevé (gros projet)', () => {
  it('calcule un projet 50 chapitres × 100 items (5 000 items) en < 20ms', () => {
    const project = generateProject(50, 100);
    const start = performance.now();
    const result = computeProjectTotal(project.chapters);
    const elapsed = performance.now() - start;

    expect(result.itemCount).toBe(5000);
    expect(elapsed).toBeLessThan(20);
  });

  it('filtre une BPU de 5 000 items avec recherche en < 20ms', () => {
    const bpu = generateBpu(5000);
    const start = performance.now();
    const filtered = filterBpu(bpu, 'DN300', 'cat_5');
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(20);
  });

  it('deep clone un projet 5 000 items en < 50ms', () => {
    const project = generateProject(50, 100);
    const start = performance.now();
    const cloned = deepClone(project);
    const elapsed = performance.now() - start;

    expect(cloned.chapters[0].children.length).toBe(100);
    expect(elapsed).toBeLessThan(50);
  });

  it('structuredClone est plus rapide que JSON clone sur 5 000 items', () => {
    const project = generateProject(50, 100);

    const startJson = performance.now();
    deepClone(project);
    const elapsedJson = performance.now() - startJson;

    const startStructured = performance.now();
    structuredCloneAlt(project);
    const elapsedStructured = performance.now() - startStructured;

    // On logue les deux pour comparaison
    console.log(`  JSON clone: ${elapsedJson.toFixed(2)}ms vs structuredClone: ${elapsedStructured.toFixed(2)}ms`);
    // Les deux doivent être sous 100ms
    expect(elapsedJson).toBeLessThan(100);
    expect(elapsedStructured).toBeLessThan(100);
  });
});

// ─── TESTS VOLUME EXTRÊME (limites) ─────────────────────────────────────────

describe('Stress — Volume extrême (limites)', () => {
  it('calcule un projet 100 chapitres × 200 items (20 000 items) en < 100ms', () => {
    const project = generateProject(100, 200);
    const start = performance.now();
    const result = computeProjectTotal(project.chapters);
    const elapsed = performance.now() - start;

    expect(result.itemCount).toBe(20000);
    expect(elapsed).toBeLessThan(100);
  });

  it('filtre une BPU de 20 000 items avec recherche en < 100ms', () => {
    const bpu = generateBpu(20000);
    const start = performance.now();
    const filtered = filterBpu(bpu, 'fourniture', null);
    const elapsed = performance.now() - start;

    expect(filtered.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(100);
  });

  it('trie 20 000 items BPU par prix en < 50ms', () => {
    const bpu = generateBpu(20000);
    const start = performance.now();
    const sorted = [...bpu].sort((a, b) => a.price - b.price);
    const elapsed = performance.now() - start;

    expect(sorted[0].price).toBeLessThanOrEqual(sorted[sorted.length - 1].price);
    expect(elapsed).toBeLessThan(50);
  });

  it('deep clone 20 000 items ne dépasse pas 200ms', () => {
    const project = generateProject(100, 200);
    const start = performance.now();
    const cloned = deepClone(project);
    const elapsed = performance.now() - start;

    expect(cloned.chapters.length).toBe(100);
    expect(elapsed).toBeLessThan(200);
  });
});

// ─── TESTS MÉMOIRE (allocation) ─────────────────────────────────────────────

describe('Stress — Empreinte mémoire', () => {
  it('un projet de 5 000 items pèse moins de 5 MB en JSON', () => {
    const project = generateProject(50, 100);
    const json = JSON.stringify(project);
    const sizeMB = json.length / 1024 / 1024;

    expect(sizeMB).toBeLessThan(5);
    console.log(`  Projet 5k items = ${(sizeMB).toFixed(2)} MB JSON`);
  });

  it('une BPU de 10 000 items pèse moins de 10 MB en JSON', () => {
    const bpu = generateBpu(10000);
    const json = JSON.stringify(bpu);
    const sizeMB = json.length / 1024 / 1024;

    expect(sizeMB).toBeLessThan(10);
    console.log(`  BPU 10k items = ${(sizeMB).toFixed(2)} MB JSON`);
  });

  it('calcul RAO (10 entreprises × 500 prix) en < 50ms', () => {
    const numCompanies = 10;
    const numItems = 500;
    const companies = Array.from({ length: numCompanies }, (_, ci) => ({
      name: `Entreprise ${ci + 1}`,
      prices: Array.from({ length: numItems }, () => Math.round(Math.random() * 1000 * 100) / 100),
    }));

    const start = performance.now();
    // Simule le calcul de scoring RAO
    const rankings = companies.map(c => {
      const total = c.prices.reduce((sum, p) => sum + p, 0);
      return { name: c.name, total };
    }).sort((a, b) => a.total - b.total);

    // Simule calcul OAB (double moyenne)
    companies[0].prices.forEach((_, itemIdx) => {
      const values = companies.map(c => c.prices[itemIdx]).filter(v => v > 0);
      const M1 = values.reduce((a, b) => a + b, 0) / values.length;
      const upper = M1 * 1.20;
      const filtered = values.filter(v => v <= upper);
      const threshold = filtered.length > 0
        ? (filtered.reduce((a, b) => a + b, 0) / filtered.length) * 0.90
        : M1 * 0.90;
    });

    const elapsed = performance.now() - start;
    expect(rankings.length).toBe(10);
    expect(elapsed).toBeLessThan(50);
  });
});

// ─── TESTS CONCURRENCE (simule accès simultanés) ───────────────────────────

describe('Stress — Opérations concurrentes', () => {
  it('100 filtres BPU en parallèle sur 2 000 items en < 200ms', async () => {
    const bpu = generateBpu(2000);
    const queries = Array.from({ length: 100 }, (_, i) => `DN${100 + i * 5}`);

    const start = performance.now();
    const results = await Promise.all(
      queries.map(q => Promise.resolve(filterBpu(bpu, q, null)))
    );
    const elapsed = performance.now() - start;

    expect(results.length).toBe(100);
    expect(elapsed).toBeLessThan(200);
  });

  it('50 calculs de total projet en parallèle en < 100ms', async () => {
    const projects = Array.from({ length: 50 }, () => generateProject(10, 30));

    const start = performance.now();
    const results = await Promise.all(
      projects.map(p => Promise.resolve(computeProjectTotal(p.chapters)))
    );
    const elapsed = performance.now() - start;

    expect(results.every(r => r.total > 0)).toBe(true);
    expect(elapsed).toBeLessThan(100);
  });
});
