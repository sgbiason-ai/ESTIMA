// src/utils/pdfCctpRcGenerator.js
//
// Export PDF CCTP / RC.
// Tables HTML rendues via jspdf-autotable avec marges correctes.

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DEFAULT_BRANDING } from '../data/branding';
import { sanitizeFilename, loadLogos } from './pdf/pdfSharedHelpers';
import { buildTheme as _buildTheme } from './pdf/buildTheme';

// ─── COULEURS ────────────────────────────────────────────────────────────────
// CCTP/RC utilise des defaults bleu et chapterBg à facteur 0.88 (= tableBg central).

const CCTP_DEFAULTS = {
  primary:   [37, 99, 235],
  accent:    [99, 102, 241],
  text:      [30, 41, 59],
  secondary: [241, 245, 249],
  chapterBg: [219, 234, 254],
  borders:   [203, 213, 225],
};

const buildTheme = (branding) => {
  const theme = _buildTheme(branding, {}, CCTP_DEFAULTS);
  // CCTP chapterBg = facteur 0.88 (identique à tableBg)
  if (branding?.colors) theme.chapterBg = theme.tableBg;
  return theme;
};

// ─── VARIABLES ───────────────────────────────────────────────────────────────

const applyVars = (text, vars) => {
  if (!text || !vars) return text || '';
  return Object.keys(vars).reduce(
    (t,k) => t.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(vars[k]||'')), text
  );
};

// ─── PARSEUR HTML → BLOCS ────────────────────────────────────────────────────
//
// Stratégie : on split la chaîne HTML sur les <table>…</table>
// → chaque partie non-table est du texte riche, chaque partie table est parsée avec le DOM.
// Ça évite tous les problèmes de position dans l'arbre DOM.

const richHtmlToText = (html) => {
  if (!html?.trim()) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p\s*>/gi, '\n').replace(/<p[^>]*>/gi, '')
    .replace(/<\/div\s*>/gi, '\n').replace(/<div[^>]*>/gi, '')
    .replace(/<\/li\s*>/gi, '\n').replace(/<li[^>]*>/gi, '• ')
    .replace(/<ul[^>]*>/gi, '').replace(/<\/ul\s*>/gi, '')
    .replace(/<\/h[1-6]\s*>/gi, '\n').replace(/<h[1-6][^>]*>/gi, '')
    .replace(/<[^>]+>/g, '');
  return (tmp.textContent || tmp.innerText || '')
    .replace(/\r/g,'').replace(/\u00A0/g,' ')
    .replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim();
};

const parseTableEl = (tableEl) => {
  const head = [], body = [];
  // richHtmlToText (et non domTextOf) pour préserver la séparation des fragments
  // inline d'une cellule (<strong>…</strong><br/><span>…</span>) → multi-lignes.
  const cellText = (el) => richHtmlToText(el?.innerHTML || '');
  Array.from(tableEl.querySelectorAll('tr')).forEach(tr => {
    const ths = Array.from(tr.querySelectorAll('th'));
    const tds = Array.from(tr.querySelectorAll('td'));
    if (ths.length > 0) head.push(ths.map(cellText));
    else if (tds.length > 0) body.push(tds.map(cellText));
  });
  // Pas de <th> → 1ère ligne de body = en-tête
  if (head.length === 0 && body.length > 1) head.push(body.shift());
  return { head, body };
};

const parseHtmlBlocks = (html, vars) => {
  if (!html?.trim()) return [];
  const applied = applyVars(html, vars);
  const blocks  = [];

  // Séparer les tables du reste (non-greedy, case-insensitive, dotAll)
  const parts = applied.split(/(<table[\s\S]*?<\/table\s*>)/gi);

  parts.forEach(part => {
    const trimmed = part.trim();
    if (!trimmed) return;

    if (/^<table/i.test(trimmed)) {
      const tmp = document.createElement('div');
      tmp.innerHTML = trimmed;
      const tbl = tmp.querySelector('table');
      if (tbl) {
        const { head, body } = parseTableEl(tbl);
        if (head.length || body.length) blocks.push({ type:'table', head, body });
      }
    } else {
      const text = richHtmlToText(trimmed);
      if (text) blocks.push({ type:'text', content:text });
    }
  });

  return blocks;
};

// ─── CONSTANTES MISE EN PAGE ─────────────────────────────────────────────────

const M  = { top:26, bottom:16, left:15, right:15 };
const PH = 297, PW = 210;
const CW = PW - M.left - M.right;   // largeur utile

// ─── GESTION PAGES ───────────────────────────────────────────────────────────

const addNewPage = (doc, ctx, cursor) => {
  doc.addPage();
  drawPageHeader(doc, ctx);
  cursor.y = M.top;
};

const ensureSpace = (doc, ctx, cursor, need) => {
  if (cursor.y + need > PH - M.bottom) addNewPage(doc, ctx, cursor);
};

// ─── EN-TÊTE ─────────────────────────────────────────────────────────────────

const drawPageHeader = (doc, ctx) => {
  const { project, logoMoe, docLabel, THEME, fontH, fontB } = ctx;

  doc.setFillColor(255,255,255);
  doc.rect(0, 0, PW, M.top-2, 'F');

  if (logoMoe) {
    const mxW=32, mxH=12, r=logoMoe.width/logoMoe.height;
    let w=mxW, h=w/r;
    if (h>mxH) { h=mxH; w=h*r; }
    doc.addImage(logoMoe, 'JPEG', PW-M.right-w, 4, w, h);
  }

  const rEdge = logoMoe ? PW-M.right-36 : PW-M.right;
  doc.setFont(fontH,'bold'); doc.setFontSize(8); doc.setTextColor(...THEME.primary);
  doc.text(docLabel, M.left, 10);

  doc.setFont(fontB,'normal'); doc.setFontSize(6.5); doc.setTextColor(...THEME.lightText);
  const truncatedProjectName = doc.splitTextToSize((project.name||'PROJET').toUpperCase(), rEdge-M.left-4)[0];
  doc.text(truncatedProjectName, M.left, 15);

  doc.setDrawColor(...THEME.borders); doc.setLineWidth(0.25);
  doc.line(M.left, M.top-2, PW-M.right, M.top-2);
};

// ─── PIED DE PAGE ────────────────────────────────────────────────────────────

const drawPageFooter = (doc, num, total, THEME, fontB) => {
  doc.setDrawColor(...THEME.borders); doc.setLineWidth(0.2);
  doc.line(M.left, PH-M.bottom+2, PW-M.right, PH-M.bottom+2);
  doc.setFont(fontB,'normal'); doc.setFontSize(6.5); doc.setTextColor(...THEME.lightText);
  doc.text(`Page ${num} / ${total}`, PW/2, PH-M.bottom+6, {align:'center'});
};

// ─── PAGE DE GARDE ───────────────────────────────────────────────────────────

const drawCoverPage = (doc, project, logoMoe, logoClient, docLabel, today, branding, THEME, logoCoTraitants = []) => {
  const W=PW, H=PH;
  const fH = branding?.fonts?.headings || 'Helvetica';
  const fB = branding?.fonts?.main     || 'Helvetica';

  doc.setFillColor(255,255,255); doc.rect(0,0,W,H,'F');
  doc.setFillColor(...THEME.primary); doc.rect(0,0,5,H,'F');

  const addLogoAt = (img, x, y, mxW, mxH) => {
    if (!img) return;
    const r=img.width/img.height;
    let w=mxW, h=w/r;
    if (h>mxH) { h=mxH; w=h*r; }
    doc.addImage(img, 'JPEG', x, y+(mxH-h)/2, w, h);
  };
  // MOE en haut à gauche + co-traitants (groupement) empilés dessous
  let leftY = 18;
  if (logoMoe) { addLogoAt(logoMoe, 18, leftY, 45, 25); leftY += 25 + 3; }
  (logoCoTraitants || []).forEach((img) => { if (img) { addLogoAt(img, 18, leftY, 45, 18); leftY += 18 + 3; } });
  // Logo client à droite
  if (logoClient) {
    const r=logoClient.width/logoClient.height;
    let w=45, h=w/r;
    if (h>25) { h=25; w=h*r; }
    addLogoAt(logoClient, W-18-w, 18, w, 25);
  }

  doc.setFont(fH,'bold'); doc.setFontSize(9); doc.setTextColor(...THEME.lightText);
  doc.text(docLabel.toUpperCase(), W-18, 52, {align:'right'});
  doc.setDrawColor(...THEME.borders); doc.setLineWidth(0.4);
  doc.line(W-90, 56, W-18, 56);

  doc.setFont(fH,'bold'); doc.setFontSize(30); doc.setTextColor(...THEME.primary);
  const st = doc.splitTextToSize((project.name||'NOM DU PROJET').toUpperCase(), W-36);
  doc.text(st, 18, 95);
  const tH = st.length*11;
  let so=0;
  if (project.subtitle1?.trim()) {
    so+=9; doc.setFont(fB,'normal'); doc.setFontSize(12); doc.setTextColor(...THEME.lightText);
    doc.text(project.subtitle1.trim().toUpperCase(), 18, 95+tH+so);
  }
  if (project.subtitle2?.trim()) {
    so+=7; doc.setFont(fB,'normal'); doc.setFontSize(10); doc.setTextColor(...THEME.lightText);
    doc.text(project.subtitle2.trim().toUpperCase(), 18, 95+tH+so);
  }
  doc.setDrawColor(...THEME.accent); doc.setLineWidth(1.5);
  doc.line(18, 95+tH+4, 58, 95+tH+4);

  const bY=118+tH+so;
  doc.setFillColor(...THEME.secondary); doc.roundedRect(18, bY, W-36, 62, 3,3,'F');
  const c1=28, c2=W/2+10, y1=bY+13;

  doc.setFont(fH,'bold'); doc.setFontSize(7); doc.setTextColor(...THEME.lightText);
  doc.text("MAÎTRE D'OUVRAGE", c1, y1);
  doc.setFont(fH,'bold'); doc.setFontSize(11); doc.setTextColor(...THEME.text);
  const sc = doc.splitTextToSize((project.client||'Non renseigné').toUpperCase(), W/2-36);
  doc.text(sc, c1, y1+6);
  let cy=y1+6+sc.length*5;
  doc.setFont(fB,'normal'); doc.setFontSize(8.5); doc.setTextColor(...THEME.lightText);
  if (project.clientAddress) { doc.text(project.clientAddress.toUpperCase(), c1, cy); cy+=5; }
  const cz=[project.clientZip,project.clientCity].filter(Boolean).join(' ');
  if (cz) { doc.text(cz.toUpperCase(), c1, cy); cy+=5; }
  cy+=5;
  doc.setFont(fH,'bold'); doc.setFontSize(7); doc.setTextColor(...THEME.lightText);
  doc.text('LIEU DE RÉALISATION', c1, cy);
  doc.setFont(fH,'bold'); doc.setFontSize(10); doc.setTextColor(...THEME.text);
  doc.text((project.location||'Non renseigné').toUpperCase(), c1, cy+6);

  doc.setFont(fH,'bold'); doc.setFontSize(7); doc.setTextColor(...THEME.lightText);
  doc.text('PHASE DU PROJET', c2, y1);
  doc.setFillColor(...THEME.primary); doc.roundedRect(c2, y1+3, 26, 6, 1.5,1.5,'F');
  doc.setFont(fH,'bold'); doc.setFontSize(8); doc.setTextColor(255,255,255);
  doc.text((project.phase||'DCE').toUpperCase(), c2+13, y1+7.5, {align:'center'});
  let ry=y1+22;
  doc.setFont(fH,'bold'); doc.setFontSize(7); doc.setTextColor(...THEME.lightText);
  doc.text('RÉFÉRENCE PROJET', c2, ry);
  doc.setFont(fH,'bold'); doc.setFontSize(10); doc.setTextColor(...THEME.text);
  doc.text((project.code||'Non défini').toUpperCase(), c2, ry+6);

  const fy=H-18;
  doc.setDrawColor(...THEME.borders); doc.setLineWidth(0.2);
  doc.line(18, fy-6, W-18, fy-6);
  if (branding?.companyName) {
    doc.setFont(fH,'bold'); doc.setFontSize(6.5); doc.setTextColor(...THEME.primary);
    doc.text(branding.companyName.toUpperCase(), 18, fy-1);
    const ct=[branding.address,branding.phone,branding.email,branding.website].filter(Boolean);
    if (ct.length) {
      doc.setFont(fB,'normal'); doc.setFontSize(6); doc.setTextColor(...THEME.lightText);
      doc.text(ct.join('  ·  '), W-18, fy-1, {align:'right'});
    }
    if (branding.tagline) {
      doc.setFont(fB,'normal'); doc.setFontSize(5.5); doc.setTextColor(...THEME.lightText);
      doc.text(branding.tagline, 18, fy+4);
    }
    doc.setFont(fB,'normal'); doc.setFontSize(6); doc.text(`Édité le ${today}`, W-18, fy+4, {align:'right'});
  } else {
    doc.setFont(fB,'normal'); doc.setFontSize(7); doc.setTextColor(...THEME.lightText);
    doc.text(`Édité le ${today}`, W-18, fy-1, {align:'right'});
  }
};

// ─── SOMMAIRE ────────────────────────────────────────────────────────────────

const drawSommaire = (doc, ctx, cursor, treeData, selectedIds) => {
  const { THEME, fontH, fontB } = ctx;
  ensureSpace(doc, ctx, cursor, 20);
  doc.setFont(fontH,'bold'); doc.setFontSize(13); doc.setTextColor(...THEME.primary);
  doc.text('SOMMAIRE', PW/2, cursor.y, {align:'center'});
  cursor.y += 3;
  doc.setDrawColor(...THEME.accent); doc.setLineWidth(0.8);
  doc.line(M.left, cursor.y, PW-M.right, cursor.y);
  cursor.y += 8;

  const renderSommaireNode = (nodes, prefix, depth) => {
    let n = 0;
    nodes.forEach(node => {
      if (!selectedIds.has(node.id)) return;
      n++;
      const currentPrefix = prefix ? `${prefix}.${n}` : `${n}`;

      if (depth === 1) {
        ensureSpace(doc, ctx, cursor, 8);
        doc.setFont(fontH,'bold'); doc.setFontSize(9.5); doc.setTextColor(...THEME.primary);
        doc.text(`${currentPrefix}.`, M.left, cursor.y);
        doc.setTextColor(...THEME.text);
        doc.text((node.title||'').toUpperCase(), M.left+8, cursor.y);
        cursor.y += 6;
      } else if (depth === 2) {
        ensureSpace(doc, ctx, cursor, 6);
        doc.setFont(fontB,'normal'); doc.setFontSize(8); doc.setTextColor(...THEME.lightText);
        doc.text(`   ${currentPrefix}  ${node.title||''}`, M.left+8, cursor.y);
        cursor.y += 5;
      } else if (depth === 3) {
        ensureSpace(doc, ctx, cursor, 5);
        doc.setFont(fontB,'normal'); doc.setFontSize(7.5); doc.setTextColor(...THEME.lightText);
        doc.text(`      ${currentPrefix}  ${node.title||''}`, M.left+8, cursor.y);
        cursor.y += 4.5;
      }

      if (node.children?.length && depth < 3) {
        renderSommaireNode(node.children, currentPrefix, depth + 1);
      }
    });
  };

  renderSommaireNode(treeData, '', 1);
};

// ─── RENDU TABLE via autoTable ───────────────────────────────────────────────

const renderTable = (doc, ctx, cursor, head, body) => {
  if (!body.length && !head.length) return;
  const { THEME, fontH, fontB } = ctx;

  ensureSpace(doc, ctx, cursor, 30);
  cursor.y += 2;

  autoTable(doc, {
    startY: cursor.y,
    margin: {
      top:    M.top,
      bottom: M.bottom + 4,
      left:   M.left + 4,
      right:  M.right,
    },
    head:  head.length ? head : undefined,
    body,
    tableWidth: CW - 4,
    theme: 'grid',
    styles: {
      font:      fontB,
      fontSize:  7.5,
      cellPadding: 2.5,
      overflow:  'linebreak',
      textColor: THEME.text,
      lineColor: THEME.borders,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor:  THEME.primary,
      textColor:  [255,255,255],
      fontStyle:  'bold',
      font:       fontH,
      halign:     'center',
      fontSize:   7.5,
    },
    alternateRowStyles: {
      fillColor: THEME.secondary,
    },
    bodyStyles: {
      fillColor: [255,255,255],
    },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) {
        drawPageHeader(doc, ctx);
      }
    },
  });

  cursor.y = doc.lastAutoTable.finalY + 5;
};

// ─── RENDU CONTENU (texte + tables) ──────────────────────────────────────────

const renderContent = (doc, ctx, cursor, html, vars) => {
  const { THEME, fontB } = ctx;
  const blocks = parseHtmlBlocks(html, vars);
  if (!blocks.length) return;
  cursor.y += 1;

  blocks.forEach(block => {
    if (block.type === 'table') {
      renderTable(doc, ctx, cursor, block.head, block.body);
    } else {
      block.content.split('\n').forEach(para => {
        const t = para.trim();
        if (!t) { cursor.y += 1.5; return; }
        
        const bullet  = t.startsWith('•');
        const baseX   = M.left + 12;
        const textMaxW = CW - 12;

        if (bullet) {
          const textContent = t.substring(1).trim();
          const lines = doc.splitTextToSize(textContent, textMaxW - 4);
          ensureSpace(doc, ctx, cursor, lines.length * 4.2 + 1);
          
          doc.setFont(fontB, 'normal');
          doc.setFontSize(8.5);
          doc.setTextColor(...THEME.text);

          doc.text('•', baseX, cursor.y);
          doc.text(textContent, baseX + 4, cursor.y, { align: 'justify', maxWidth: textMaxW - 4 });
          
          cursor.y += lines.length * 4.2 + 0.6;
        } else {
          const lines = doc.splitTextToSize(t, textMaxW);
          ensureSpace(doc, ctx, cursor, lines.length * 4.2 + 1);
          
          doc.setFont(fontB, 'normal');
          doc.setFontSize(8.5);
          doc.setTextColor(...THEME.text);
          
          doc.text(t, baseX, cursor.y, { align: 'justify', maxWidth: textMaxW });
          
          cursor.y += lines.length * 4.2 + 0.6;
        }
      });
      cursor.y += 2;
    }
  });
};

// ─── STYLES NIVEAUX ──────────────────────────────────────────────────────────

const buildLVL = (branding) => {
  const h1 = ((branding?.sizes?.title1 || 28) / 2);
  const bd = ((branding?.sizes?.body   || 22) / 2);

  const h2 = Math.max(bd,        h1 - 2);
  const h3 = Math.max(bd - 1,    h1 - 3.5);
  const h4 = Math.max(8.5 + 1,   h1 - 4.5);
  const h5 = Math.max(8.5,       h1 - 5.5);

  return {
    1: { fs: h1,           bold:true,  caps:true,  bg:'ch', indent:0,  sp:10 },
    2: { fs: h2,           bold:true,  caps:false, bg:'se', indent:3,  sp:7  },
    3: { fs: Math.round(h3 * 2) / 2, bold:true,  caps:false, bg:null, indent:6,  sp:5  },
    4: { fs: Math.round(h4 * 2) / 2, bold:true,  caps:false, bg:null, indent:10, sp:4  },
    5: { fs: Math.round(h5 * 2) / 2, bold:false, caps:false, bg:null, indent:14, sp:3  },
  };
};

// ─── RENDU CLAUSES ───────────────────────────────────────────────────────────

const renderNodes = (doc, ctx, cursor, nodes, selectedIds, vars, prefix) => {
  const { THEME, fontH, fontB, LVL } = ctx;
  let idx = 0;
  nodes.forEach(node => {
    if (!selectedIds.has(node.id)) return;
    idx++;
    const num   = prefix ? `${prefix}.${idx}` : `${idx}`;
    const level = Math.min(node.level||1, 5);
    const st    = LVL[level];
    const font  = st.bold ? fontH : fontB;

    const titleTxt = st.caps ? `${num}  ${(node.title||'').toUpperCase()}` : `${num}  ${node.title||''}`;
    const ix  = M.left + st.indent;
    const mxW = CW - st.indent - 2;
    doc.setFont(font, st.bold?'bold':'normal'); doc.setFontSize(st.fs);
    const sp  = doc.splitTextToSize(titleTxt, mxW);
    const lh   = st.fs * 0.45;
    const th   = sp.length * lh;
    
    const padV = st.bg ? 2.5 : 1.5;
    const bh   = th + 2 * padV;

    if (level === 1 && cursor.y > M.top) {
      addNewPage(doc, ctx, cursor);
    } else {
      ensureSpace(doc, ctx, cursor, st.sp + bh + 15);
      cursor.y += st.sp;
    }

    doc.setFont(font, st.bold ? 'bold' : 'normal');
    doc.setFontSize(st.fs);

    const rectY  = cursor.y;
    const textY  = rectY + padV + lh * 0.72;

    if (st.bg) {
      doc.setFillColor(...(st.bg==='ch' ? THEME.chapterBg : THEME.secondary));
      doc.rect(ix-1, rectY, CW-st.indent+2, bh, 'F');
    }
    doc.setTextColor(...(level===1 ? THEME.primary : level===2 ? THEME.accent : [40,40,40]));
    doc.text(sp, ix+1, textY);
    cursor.y = rectY + bh + 2;

    if (level===1) {
      doc.setDrawColor(...THEME.borders); doc.setLineWidth(0.15);
      doc.line(M.left, cursor.y, PW-M.right, cursor.y);
      cursor.y += 2;
    }

    if (node.content) renderContent(doc, ctx, cursor, node.content, vars);
    if (node.children?.length) renderNodes(doc, ctx, cursor, node.children, selectedIds, vars, num);
  });
};

// ─── EXPORT PRINCIPAL ────────────────────────────────────────────────────────

export const generatePdfCctpRc = async (
  docType, selectedIds, treeData, variables, project,
  branding = DEFAULT_BRANDING
) => {
  const LABELS = {
    CCTP: 'Cahier des Clauses Techniques Particulières',
    RC:   'Règlement de la Consultation',
    CCAP: 'Cahier des Clauses Administratives Particulières',
  };
  const docLabel = LABELS[docType] || docType;
  const THEME    = buildTheme(branding);
  const today    = new Date().toLocaleDateString('fr-FR');
  const doc      = new jsPDF({ unit:'mm', format:'a4' });

  const { logoMoe, logoClient, logoCoTraitants } = await loadLogos(branding, project);

  const ctx = {
    doc, project, logoMoe, docLabel, THEME, branding, today,
    fontH: branding?.fonts?.headings || 'Helvetica',   
    fontB: branding?.fonts?.main     || 'Helvetica',   
    LVL:   buildLVL(branding),                         
  };

  // 1. Page de garde
  drawCoverPage(doc, project, logoMoe, logoClient, docLabel, today, branding, THEME, logoCoTraitants);

  // 2. Sommaire
  doc.addPage(); drawPageHeader(doc, ctx);
  const cursor = { y: M.top };
  drawSommaire(doc, ctx, cursor, treeData, selectedIds);

  // 3. Contenu
  doc.addPage(); drawPageHeader(doc, ctx);
  cursor.y = M.top;
  renderNodes(doc, ctx, cursor, treeData, selectedIds, variables, '');

  // 4. Numérotation (skip page de garde)
  const total = doc.internal.getNumberOfPages();
  for (let p=2; p<=total; p++) {
    doc.setPage(p);
    drawPageFooter(doc, p-1, total-1, THEME, ctx.fontB);
  }

  // 5. Sauvegarde
  const safeName = sanitizeFilename(project.name || 'PROJET').toUpperCase();
  doc.save(`${docType}_${safeName}_${new Date().toISOString().split('T')[0]}.pdf`);
};