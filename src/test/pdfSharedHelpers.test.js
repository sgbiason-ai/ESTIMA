// Tests pour src/utils/pdf/pdfSharedHelpers.js
import { describe, it, expect } from 'vitest';
import {
  hexToRgbArray, lightenRgb, darkenRgb,
  formatDateFr, formatDateLong, sanitizeFilename,
  cleanText, formatNumberFr,
  renderLogo, drawSignatureBoxes, drawMoeFooter, drawCoverPage,
} from '../utils/pdf/pdfSharedHelpers';

// ─── hexToRgbArray ──────────────────────────────────────────────────────────

describe('hexToRgbArray', () => {
  it('convertit un hex standard avec #', () => {
    expect(hexToRgbArray('#FF0000')).toEqual([255, 0, 0]);
    expect(hexToRgbArray('#00FF00')).toEqual([0, 255, 0]);
    expect(hexToRgbArray('#0000FF')).toEqual([0, 0, 255]);
  });

  it('convertit un hex sans #', () => {
    expect(hexToRgbArray('286E55')).toEqual([40, 110, 85]);
  });

  it('gere les couleurs mixtes', () => {
    expect(hexToRgbArray('#1E3A8A')).toEqual([30, 58, 138]);
    expect(hexToRgbArray('#FFFFFF')).toEqual([255, 255, 255]);
    expect(hexToRgbArray('#000000')).toEqual([0, 0, 0]);
  });

  it('retourne null pour valeurs invalides', () => {
    expect(hexToRgbArray(null)).toBeNull();
    expect(hexToRgbArray(undefined)).toBeNull();
    expect(hexToRgbArray('')).toBeNull();
    expect(hexToRgbArray(123)).toBeNull();
    expect(hexToRgbArray('#FFF')).toBeNull(); // trop court
    expect(hexToRgbArray('#GGHHII')).toEqual([NaN, NaN, NaN]); // hex invalide
  });

  it('est insensible a la casse', () => {
    expect(hexToRgbArray('#ff0000')).toEqual([255, 0, 0]);
    expect(hexToRgbArray('#Ff00fF')).toEqual([255, 0, 255]);
  });
});

// ─── lightenRgb ─────────────────────────────────────────────────────────────

describe('lightenRgb', () => {
  it('eclaircit avec facteur par defaut (0.85)', () => {
    const result = lightenRgb([40, 110, 85]);
    expect(result).toEqual([223, 233, 230]); // Math.round(c + (255-c)*0.85)
  });

  it('eclaircit avec facteur 0', () => {
    expect(lightenRgb([100, 100, 100], 0)).toEqual([100, 100, 100]);
  });

  it('eclaircit avec facteur 1 → blanc', () => {
    expect(lightenRgb([100, 100, 100], 1)).toEqual([255, 255, 255]);
  });

  it('eclaircit le noir', () => {
    expect(lightenRgb([0, 0, 0], 0.5)).toEqual([128, 128, 128]);
  });

  it('ne change pas le blanc', () => {
    expect(lightenRgb([255, 255, 255], 0.5)).toEqual([255, 255, 255]);
  });
});

// ─── darkenRgb ──────────────────────────────────────────────────────────────

describe('darkenRgb', () => {
  it('assombrit avec facteur par defaut (0.15)', () => {
    const result = darkenRgb([200, 200, 200]);
    expect(result).toEqual([170, 170, 170]);
  });

  it('assombrit avec facteur 0 → inchange', () => {
    expect(darkenRgb([100, 100, 100], 0)).toEqual([100, 100, 100]);
  });

  it('assombrit avec facteur 1 → noir', () => {
    expect(darkenRgb([100, 100, 100], 1)).toEqual([0, 0, 0]);
  });

  it('ne change pas le noir', () => {
    expect(darkenRgb([0, 0, 0], 0.5)).toEqual([0, 0, 0]);
  });
});

// ─── formatDateFr ───────────────────────────────────────────────────────────

describe('formatDateFr', () => {
  it('formate une date ISO en DD/MM/YYYY', () => {
    expect(formatDateFr('2026-04-04')).toBe('04/04/2026');
    expect(formatDateFr('2025-12-31')).toBe('31/12/2025');
    expect(formatDateFr('2024-01-01')).toBe('01/01/2024');
  });

  it('retourne vide pour valeurs falsy', () => {
    expect(formatDateFr('')).toBe('');
    expect(formatDateFr(null)).toBe('');
    expect(formatDateFr(undefined)).toBe('');
  });
});

// ─── formatDateLong ─────────────────────────────────────────────────────────

describe('formatDateLong', () => {
  it('formate en format long francais', () => {
    const result = formatDateLong('2026-04-04');
    expect(result).toMatch(/samedi/i);
    expect(result).toMatch(/4/);
    expect(result).toMatch(/avril/i);
    expect(result).toMatch(/2026/);
  });

  it('retourne vide pour valeurs falsy', () => {
    expect(formatDateLong('')).toBe('');
    expect(formatDateLong(null)).toBe('');
  });
});

// ─── sanitizeFilename ───────────────────────────────────────────────────────

describe('sanitizeFilename', () => {
  it('retire les accents', () => {
    expect(sanitizeFilename('Résumé été')).toBe('Resume_ete');
  });

  it('retire les caracteres speciaux', () => {
    expect(sanitizeFilename('file<>:"/\\|?*name')).toBe('filename');
  });

  it('condense les underscores multiples', () => {
    expect(sanitizeFilename('a   b   c')).toBe('a_b_c');
  });

  it('tronque a 60 caracteres', () => {
    const long = 'A'.repeat(80);
    expect(sanitizeFilename(long).length).toBe(60);
  });

  it('retourne Document pour valeurs invalides', () => {
    expect(sanitizeFilename(null)).toBe('Document');
    expect(sanitizeFilename('')).toBe('Document');
    expect(sanitizeFilename(123)).toBe('Document');
  });

  it('retire les underscores en debut/fin', () => {
    expect(sanitizeFilename(' test ')).toBe('test');
  });
});

// ─── cleanText ──────────────────────────────────────────────────────────────

describe('cleanText', () => {
  it('retire les retours a la ligne', () => {
    expect(cleanText('ligne1\nligne2\rligne3')).toBe('ligne1 ligne2 ligne3');
  });

  it('trim les espaces', () => {
    expect(cleanText('  hello  ')).toBe('hello');
  });

  it('retourne vide pour non-string', () => {
    expect(cleanText(null)).toBe('');
    expect(cleanText(undefined)).toBe('');
    expect(cleanText(123)).toBe('');
  });

  it('gere les retours multiples', () => {
    expect(cleanText('a\n\n\nb')).toBe('a b');
  });
});

// ─── formatNumberFr ─────────────────────────────────────────────────────────

describe('formatNumberFr', () => {
  it('formate un entier avec decimales', () => {
    expect(formatNumberFr(1234)).toBe('1 234,00');
  });

  it('formate un decimal', () => {
    expect(formatNumberFr(1234.56)).toBe('1 234,56');
  });

  it('formate un grand nombre', () => {
    expect(formatNumberFr(1234567.89)).toBe('1 234 567,89');
  });

  it('formate zero', () => {
    expect(formatNumberFr(0)).toBe('0,00');
  });

  it('formate un nombre negatif', () => {
    expect(formatNumberFr(-1234.56)).toBe('-1 234,56');
  });

  it('accepte une string numerique', () => {
    expect(formatNumberFr('5000')).toBe('5 000,00');
  });

  it('retourne tiret pour valeurs invalides', () => {
    expect(formatNumberFr(null)).toBe('-');
    expect(formatNumberFr(undefined)).toBe('-');
    expect(formatNumberFr('')).toBe('-');
    expect(formatNumberFr('abc')).toBe('-');
    expect(formatNumberFr(NaN)).toBe('-');
  });

  it('arrondit a 2 decimales', () => {
    expect(formatNumberFr(1.999)).toBe('2,00');
    expect(formatNumberFr(1.005)).toBe('1,00'); // JS floating point: 1.005 rounds to 1.00
  });
});

// ─── renderLogo ─────────────────────────────────────────────────────────────

describe('renderLogo', () => {
  const mockDoc = {
    addImage: () => {},
  };

  it('retourne {w:0, h:0} si logo est null', () => {
    expect(renderLogo(mockDoc, null, 0, 0, 45, 25)).toEqual({ w: 0, h: 0 });
  });

  it('calcule les dimensions en respectant maxW', () => {
    const logo = { width: 200, height: 100 }; // ratio 2:1
    const addImageCalls = [];
    const doc = { addImage: (...args) => addImageCalls.push(args) };
    const result = renderLogo(doc, logo, 10, 20, 40, 30);
    // w=40, h=40/2=20 (dans les limites maxH=30)
    expect(result).toEqual({ w: 40, h: 20 });
    expect(addImageCalls.length).toBe(1);
    // Vérifie le centrage vertical : y = 20 + (30-20)/2 = 25
    expect(addImageCalls[0][3]).toBe(25); // y position
  });

  it('calcule les dimensions en respectant maxH si le ratio est portrait', () => {
    const logo = { width: 100, height: 200 }; // ratio 0.5
    const doc = { addImage: () => {} };
    const result = renderLogo(doc, logo, 0, 0, 45, 25);
    // w=45, h=45/0.5=90 > maxH=25 → h=25, w=25*0.5=12.5
    expect(result.h).toBe(25);
    expect(result.w).toBe(12.5);
  });
});

// ─── drawSignatureBoxes ────────────────────────────────────────────────────

describe('drawSignatureBoxes', () => {
  it('ne dessine rien si zoneHeight < 25', () => {
    const calls = [];
    const doc = {
      internal: { pageSize: { width: 210 } },
      setFillColor: (...args) => calls.push(['fill', args]),
      setDrawColor: () => {},
      setLineWidth: () => {},
      setFontSize: () => {},
      setFont: () => {},
      setTextColor: () => {},
      roundedRect: () => {},
      rect: () => {},
      text: () => {},
      line: () => {},
    };
    const theme = { primary: [40, 110, 85], secondary: [245, 250, 248], borders: [220, 235, 230], lightText: [100, 116, 139] };
    drawSignatureBoxes(doc, theme, { signatories: [], zoneTop: 200, zoneHeight: 20 });
    expect(calls.length).toBe(0);
  });

  it('dessine 4 colonnes quand zoneHeight >= 25', () => {
    const rectCalls = [];
    const doc = {
      internal: { pageSize: { width: 210 } },
      setFillColor: () => {},
      setDrawColor: () => {},
      setLineWidth: () => {},
      setFontSize: () => {},
      setFont: () => {},
      setTextColor: () => {},
      roundedRect: (...args) => rectCalls.push(args),
      rect: () => {},
      text: () => {},
      line: () => {},
    };
    const theme = { primary: [40, 110, 85], secondary: [245, 250, 248], borders: [220, 235, 230], lightText: [100, 116, 139] };
    drawSignatureBoxes(doc, theme, { signatories: ['A', 'B', 'C', 'D'], zoneTop: 200, zoneHeight: 50 });
    // 4 colonnes × 3 roundedRect chacune (fond, contour, bandeau) = 12
    expect(rectCalls.length).toBe(12);
  });
});

// ─── drawMoeFooter ──────────────────────────────────────────────────────────

describe('drawMoeFooter', () => {
  const makeDoc = () => {
    const textCalls = [];
    return {
      internal: { pageSize: { width: 210, height: 297 } },
      setDrawColor: () => {},
      setLineWidth: () => {},
      setFont: () => {},
      setFontSize: () => {},
      setTextColor: () => {},
      line: () => {},
      text: (...args) => textCalls.push(args),
      getTextWidth: () => 30,
      _textCalls: textCalls,
    };
  };
  const theme = { primary: [40, 110, 85], borders: [220, 235, 230], lightText: [100, 116, 139] };

  it('affiche la date simple si pas de branding.companyName', () => {
    const doc = makeDoc();
    drawMoeFooter(doc, null, theme, '15/04/2026');
    const hasDate = doc._textCalls.some(c => c[0].includes('15/04/2026'));
    expect(hasDate).toBe(true);
  });

  it('affiche le nom société si branding.companyName present', () => {
    const doc = makeDoc();
    drawMoeFooter(doc, { companyName: 'PAPYRUS VRD' }, theme, '15/04/2026');
    const hasCompany = doc._textCalls.some(c => c[0].includes('PAPYRUS VRD'));
    expect(hasCompany).toBe(true);
  });

  it('affiche les contacts si fournis', () => {
    const doc = makeDoc();
    drawMoeFooter(doc, { companyName: 'Test', phone: '0600', email: 'a@b.c' }, theme, '15/04/2026');
    const hasContacts = doc._textCalls.some(c => typeof c[0] === 'string' && c[0].includes('0600'));
    expect(hasContacts).toBe(true);
  });
});

// ─── drawCoverPage ──────────────────────────────────────────────────────────

describe('drawCoverPage', () => {
  const makeDoc = () => ({
    internal: { pageSize: { width: 210, height: 297 } },
    setFillColor: () => {},
    setDrawColor: () => {},
    setLineWidth: () => {},
    setFont: () => {},
    setFontSize: () => {},
    setTextColor: () => {},
    rect: () => {},
    roundedRect: () => {},
    line: () => {},
    text: () => {},
    addImage: () => {},
    splitTextToSize: (t) => [t],
    getTextWidth: (t) => String(t).length * 2,
  });

  const theme = {
    primary: [40, 110, 85], accent: [50, 180, 130], text: [40, 40, 40],
    lightText: [100, 116, 139], secondary: [245, 250, 248], borders: [220, 235, 230],
    white: [255, 255, 255],
  };

  it('retourne blockEndY', () => {
    const result = drawCoverPage(makeDoc(), {
      docType: 'TEST', title: 'Projet', phaseLabel: 'DCE',
      clientName: 'Client', locationRaw: 'Lieu', codeAffaire: 'C001',
      branding: null, today: '15/04/2026',
    }, theme, { logoMoe: null, logoClient: null });
    expect(result).toHaveProperty('blockEndY');
    expect(typeof result.blockEndY).toBe('number');
  });

  it('gere les extraBlocks sans crash', () => {
    const result = drawCoverPage(makeDoc(), {
      docType: 'RAO', title: 'Projet RAO', phaseLabel: 'DCE',
      clientName: 'Client', locationRaw: 'Lieu', codeAffaire: 'C002',
      branding: null, today: '15/04/2026',
      extraBlocks: [{ height: 40, rows: [{ label: 'TEST', value: 'val', col: 1 }] }],
    }, theme, { logoMoe: null, logoClient: null });
    expect(result.blockEndY).toBeGreaterThan(0);
  });

  it('dessine les signatures si showSignatures=true et assez de place', () => {
    const roundedRectCalls = [];
    const doc = {
      ...makeDoc(),
      roundedRect: (...args) => roundedRectCalls.push(args),
    };
    drawCoverPage(doc, {
      docType: 'TEST', title: 'P', phaseLabel: 'DCE',
      clientName: 'C', locationRaw: 'L', codeAffaire: 'X',
      showSignatures: true, signatories: ['A', 'B', 'C', 'D'],
      branding: null, today: '15/04/2026',
    }, theme, { logoMoe: null, logoClient: null });
    // Au moins les 12 roundedRect des signatures (4 × 3) + ceux de la page
    expect(roundedRectCalls.length).toBeGreaterThanOrEqual(12);
  });
});
