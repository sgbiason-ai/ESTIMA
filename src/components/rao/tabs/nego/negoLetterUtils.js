// src/components/rao/tabs/nego/negoLetterUtils.js
//
// Fonctions pures de construction / transformation du courrier de négociation.
// Aucune dépendance React → testables isolément (les fonctions DOM dégradent
// proprement hors navigateur).

// ── Échappement HTML ──
export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

// Détecte si une chaîne contient du HTML (issu de ReactQuill) ou du texte brut (ancien format)
export const looksLikeHtml = (s) => /<\/?(p|div|ul|ol|li|strong|em|u|br|h\d)\b/i.test(s || '');

// Convertit HTML Quill (bold, underline, italic, lists) en texte brut compatible
// avec parseQuestionsBlocks du PDF de négociation. Préserve les puces "- " et sauts de ligne.
export const htmlToPlainText = (html) => {
  if (!looksLikeHtml(html)) return html || '';
  if (typeof document === 'undefined') return html.replace(/<[^>]+>/g, '');
  const container = document.createElement('div');
  container.innerHTML = html;
  const walk = (node) => {
    let out = '';
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 3) { out += child.textContent; continue; }
      if (child.nodeType !== 1) continue;
      const tag = child.tagName.toLowerCase();
      if (tag === 'br') out += '\n';
      else if (tag === 'li') out += '- ' + walk(child).trim() + '\n';
      else if (tag === 'ul' || tag === 'ol') out += walk(child);
      else if (tag === 'p' || tag === 'div' || /^h\d$/.test(tag)) out += walk(child).trim() + '\n';
      else out += walk(child);
    }
    return out;
  };
  return walk(container).replace(/\n{3,}/g, '\n\n').trim();
};

// Construit une section "Prix atypiques" (HTML) wrappée dans data-anomaly="low|high".
// `items` peut contenir des objets {ref,label,pu,unit} ou des chaînes (ancien format).
export const buildAnomalySectionHtml = (type, templateText, items) => {
  let html;

  if (looksLikeHtml(templateText)) {
    // Éditeur riche (ReactQuill) → on prend le HTML tel quel, en injectant les
    // styles d'alignement / marges au passage pour rester cohérent avec la trame.
    html = (templateText || '')
      // Quill génère <p> sans style → ajouter le style justify + marges
      .replace(/<p(\s[^>]*)?>/gi, (m, attrs) => {
        const a = attrs || '';
        if (/style=/.test(a)) return m; // déjà stylé
        return `<p style="margin:6px 0; text-align:justify;"${a}>`;
      })
      .replace(/<ul>/gi, '<ul style="margin:4px 0; padding-left:24px; text-align:justify;">')
      .replace(/<ol>/gi, '<ol style="margin:4px 0; padding-left:24px; text-align:justify;">')
      .replace(/<li>/gi, '<li style="margin-bottom:3px;">');
  } else {
    // Ancien format texte brut : première ligne = titre, "- " = bullet, autre = paragraphe
    const rawLines = (templateText || '').split('\n').map(l => l.trim()).filter(Boolean);
    html = '';
    let inList = false;
    rawLines.forEach((line, idx) => {
      if (idx === 0) {
        const title = line.replace(/^➡️\s*/, '');
        html += `<p style="margin:10px 0 4px 0; text-align:justify;"><strong>${escapeHtml(title)}</strong></p>`;
        return;
      }
      if (line.startsWith('- ')) {
        if (!inList) { html += '<ul style="margin:4px 0; padding-left:24px; text-align:justify;">'; inList = true; }
        html += `<li style="margin-bottom:3px;">${escapeHtml(line.substring(2))}</li>`;
        return;
      }
      if (inList) { html += '</ul>'; inList = false; }
      html += `<p style="margin:0 0 4px 0; text-align:justify;">${escapeHtml(line)}</p>`;
    });
    if (inList) html += '</ul>';
  }

  if (items && items.length > 0) {
    // Items peuvent être des chaînes (ancien format) OU des objets {ref,label,pu,unit}
    const structured = items.map(it => {
      if (typeof it === 'object' && it !== null) return it;
      // Parse chaîne "Prix n°XXX — Label : PU proposé de YY € HT[/UNIT]."
      const m = String(it).match(/^Prix\s*n[°o]?\s*([^\s—-]+)\s*[—-]\s*(.+?)\s*:\s*PU\s*(?:proposé\s+)?de\s*([\d\s.,]+)\s*€\s*HT(?:\s*\/\s*([^\s.]+))?\s*\.?\s*$/i);
      return m ? { ref: m[1], label: m[2], pu: m[3].trim(), unit: m[4] || '' } : { ref: '—', label: String(it), pu: '', unit: '' };
    });
    const hasAnyUnit = structured.some(it => (it.unit || '').trim());
    // red-600 (bas) / amber-600 (haut) / slate-600 (unifié, neutre) — couleurs alignées sur le PDF
    const headBg   = type === 'low' ? '#dc2626' : type === 'high' ? '#d97706' : '#475569';
    const headText = '#ffffff';
    html += `<p style="margin:6px 0 4px 0; text-align:justify;"><strong>Articles concernés :</strong></p>`;
    html += `<table style="width:100%; border-collapse:collapse; margin:4px 0 8px 0; font-size:10pt;">`;
    html += `<thead><tr>`;
    html += `<th style="background:${headBg}; color:${headText}; padding:4px 6px; border:1px solid ${headBg}; text-align:left; font-weight:bold;">Réf.</th>`;
    html += `<th style="background:${headBg}; color:${headText}; padding:4px 6px; border:1px solid ${headBg}; text-align:left; font-weight:bold;">Désignation</th>`;
    if (hasAnyUnit) html += `<th style="background:${headBg}; color:${headText}; padding:4px 6px; border:1px solid ${headBg}; text-align:center; font-weight:bold;">Unité</th>`;
    html += `<th style="background:${headBg}; color:${headText}; padding:4px 6px; border:1px solid ${headBg}; text-align:right; font-weight:bold;">PU proposé (HT)</th>`;
    html += `</tr></thead><tbody>`;
    structured.forEach(it => {
      html += `<tr>`;
      html += `<td style="padding:3px 6px; border:1px solid #d1d5db;">${escapeHtml(it.ref || '—')}</td>`;
      html += `<td style="padding:3px 6px; border:1px solid #d1d5db;">${escapeHtml(it.label || '')}</td>`;
      if (hasAnyUnit) html += `<td style="padding:3px 6px; border:1px solid #d1d5db; text-align:center;">${escapeHtml(it.unit || '—')}</td>`;
      html += `<td style="padding:3px 6px; border:1px solid #d1d5db; text-align:right;">${it.pu ? escapeHtml(it.pu) + ' €' : '—'}</td>`;
      html += `</tr>`;
    });
    html += `</tbody></table>`;
  }
  return `<div data-anomaly="${type}">${html}</div>`;
};

// ── Injection des variables {{...}} dans la trame ──
export const applyTemplate = (templateHtml, companyName, questionsHtml, letterConfig, consultation, project = null) => {
  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  // Sources : project (fiche projet) prioritaire, fallback consultation rao
  const get = (projectField, consultationField, fallback) =>
    project?.[projectField] || consultation?.[consultationField] || fallback;
  const city = letterConfig.city || project?.clientCity || '[Ville]';
  const deadline = letterConfig.deadline
    ? new Date(letterConfig.deadline).toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '[Date limite]';
  const signatory = letterConfig.signatoryName || '[Nom du signataire]';
  const adresseEntreprise = letterConfig.adresseEntreprise || '';
  const adresseExpediteur = letterConfig.adresseExpediteur || '';

  return templateHtml
    .replace(/{{VILLE}}/g, city)
    .replace(/{{DATE_EMISSION}}/g, today)
    .replace(/{{NOM_ENTREPRISE}}/g, companyName)
    .replace(/{{OBJET_MARCHE}}/g, get('name', 'objet', '[Objet du marché]'))
    .replace(/{{LOT}}/g, consultation?.lot || '[Lot concerné]')
    .replace(/{{CLIENT}}/g, get('client', 'client', '[Nom du Client]'))
    .replace(/{{MOE}}/g, get('moe', 'moe', '[Maître d\'Œuvre]'))
    .replace(/{{CODE_AFFAIRE}}/g, get('code', 'code', '[Code Affaire]'))
    .replace(/{{LIEU}}/g, get('location', 'lieu', '[Lieu]'))
    // Phase forcée à ACT dans le RAO (Assistance aux Contrats de Travaux)
    .replace(/{{PHASE}}/g, 'ACT')
    // Si questionsHtml vide, on laisse un marker invisible pour l'ancrage
    // des sections "Prix atypiques" injectées après coup.
    .replace(/{{QUESTIONS}}/g, questionsHtml || '<div data-questions-marker style="display:none"></div>')
    .replace(/{{DATE_LIMITE}}/g, deadline)
    .replace(/{{SIGNATAIRE}}/g, signatory)
    .replace(/{{ADRESSE_ENTREPRISE}}/g, adresseEntreprise.replace(/\n/g, '<br/>'))
    .replace(/{{ADRESSE_EXPEDITEUR}}/g, adresseExpediteur.replace(/\n/g, '<br/>'));
};

// Injecte les sections data-anomaly (low/high) dans un HTML de trame fraîche.
// Ancre prioritaire : marker [data-questions-marker] ; fallback : paragraphe connu.
export const injectSectionsIntoHtml = (html, lowSection, highSection) => {
  if (!lowSection && !highSection) return html;
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div id="__estima_root">${html}</div>`, 'text/html');
  const root = doc.getElementById('__estima_root');
  if (!root) return html;
  const findAnchor = () => {
    const marker = root.querySelector('[data-questions-marker]');
    if (marker) return marker;
    for (const p of root.querySelectorAll('p')) {
      if (p.textContent && p.textContent.includes('vous remercions de bien vouloir nous confirmer')) {
        return p;
      }
    }
    return null;
  };
  const anchor = findAnchor();
  if (!anchor) return html;
  if (lowSection) {
    const tmp = document.createElement('div');
    tmp.innerHTML = lowSection;
    const node = tmp.firstElementChild;
    if (node) anchor.after(node);
  }
  if (highSection) {
    const tmp = document.createElement('div');
    tmp.innerHTML = highSection;
    const node = tmp.firstElementChild;
    if (node) {
      const lowEl = root.querySelector('[data-anomaly="low"]');
      if (lowEl) lowEl.after(node);
      else anchor.after(node);
    }
  }
  return root.innerHTML;
};

// Extrait le corps de lettre (depuis "Monsieur,") du HTML complet, en retirant
// les éléments structurels (date, dest/exp, OBJET) rendus séparément par l'aperçu.
export const stripStructuralFromHtml = (html) => {
  if (!html || typeof DOMParser === 'undefined') return html || '';
  const doc = new DOMParser().parseFromString(`<div id="__root">${html}</div>`, 'text/html');
  const root = doc.getElementById('__root');
  if (!root) return html;

  // Stratégie : extraire le body en commençant au paragraphe "Monsieur,"
  // (ou "Madame," / "Dans le cadre de la consultation"). Tout ce qui précède
  // est structurel (date, dest/exp, OBJET, Négociation) — rendu séparément.
  // S'il existe un cadre <div style="border..."> englobant le corps, on prend
  // son contenu. Sinon on flatten tous les <p>/<ul>/<table>/<div> à partir de
  // "Monsieur,".
  const bodyBox = Array.from(root.querySelectorAll('div')).find(d => {
    const s = d.getAttribute('style') || '';
    return /border\s*:\s*\d+px\s+solid/i.test(s)
      && !/display\s*:\s*flex/i.test(s)
      && /Monsieur|Madame|Dans le cadre/i.test(d.textContent || '');
  });
  if (bodyBox) {
    // Retire le footer "NOMBRE DE PAGES" s'il est dans le bodyBox
    Array.from(bodyBox.querySelectorAll('p'))
      .filter(p => /NOMBRE\s+DE\s+PAGES/i.test(p.textContent || ''))
      .forEach(p => p.remove());
    return bodyBox.innerHTML;
  }

  // Pas de bodyBox détecté (Quill a tout aplati) : on cherche le 1er paragraphe
  // commençant par Monsieur/Madame/"Dans le cadre" et on prend tout depuis lui
  const allBlocks = Array.from(root.children);
  let startIdx = -1;
  const isBodyStart = (el) => {
    const t = (el.textContent || '').trim();
    return /^(monsieur|madame)[\s,.]|^Dans\s+le\s+cadre\s+de\s+la\s+consultation/i.test(t);
  };
  for (let i = 0; i < allBlocks.length; i++) {
    if (isBodyStart(allBlocks[i])) { startIdx = i; break; }
    // Cherche aussi dans les enfants directs (cas div imbriqués)
    const inner = Array.from(allBlocks[i].children || []).find(isBodyStart);
    if (inner) { startIdx = i; break; }
  }
  if (startIdx < 0) {
    // Fallback : on retire juste les markers connus
    root.querySelector('p[style*="text-align:right"]')?.remove();
    const flexDiv = Array.from(root.querySelectorAll('div')).find(d => /display\s*:\s*flex/i.test(d.getAttribute('style') || ''));
    if (flexDiv) flexDiv.remove();
    Array.from(root.querySelectorAll('p'))
      .filter(p => /NOMBRE\s+DE\s+PAGES/i.test(p.textContent || ''))
      .forEach(p => p.remove());
    return root.innerHTML;
  }
  const bodyOnly = allBlocks.slice(startIdx)
    .map(el => el.outerHTML)
    .join('');
  // Retire le NOMBRE DE PAGES s'il a été inclus
  const bodyDoc = new DOMParser().parseFromString(`<div id="__b">${bodyOnly}</div>`, 'text/html');
  const bRoot = bodyDoc.getElementById('__b');
  Array.from(bRoot.querySelectorAll('p'))
    .filter(p => /NOMBRE\s+DE\s+PAGES/i.test(p.textContent || ''))
    .forEach(p => p.remove());
  return bRoot.innerHTML;
};
