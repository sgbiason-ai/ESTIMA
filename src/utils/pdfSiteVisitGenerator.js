// src/utils/pdfSiteVisitGenerator.js
// Export PDF simple pour les visites de site.

import jsPDF from 'jspdf';

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

export const generateSiteVisitPdf = async (visit) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const PW = 210, PH = 297;
  const M = { top: 15, left: 15, right: 15, bottom: 15 };
  const CW = PW - M.left - M.right;
  let y = M.top;

  // ── Header ──
  doc.setFillColor(30, 64, 175); // blue-800
  doc.rect(0, 0, PW, 3, 'F');

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(30, 64, 175);
  doc.text(visit.nom || 'Visite de Site', M.left, y + 10);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  const infos = [visit.lieu, visit.client, visit.date ? new Date(visit.date).toLocaleDateString('fr-FR') : ''].filter(Boolean).join(' — ');
  doc.text(infos, M.left, y + 17);

  doc.setDrawColor(200);
  doc.line(M.left, y + 20, PW - M.right, y + 20);
  y += 27;

  // ── Observations ──
  const observations = visit.observations || [];

  for (const obs of observations) {
    // Vérifier saut de page
    if (y > PH - 50) { doc.addPage(); y = M.top; }

    // Texte
    if (obs.text) {
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(50, 50, 50);
      const lines = doc.splitTextToSize(obs.text, CW);
      const textH = lines.length * 4.5;
      if (y + textH > PH - M.bottom) { doc.addPage(); y = M.top; }
      doc.text(lines, M.left, y);
      y += textH + 3;
    }

    // Images
    const images = obs.images || [];
    for (const img of images) {
      const imgSrc = typeof img === 'string' ? img : img.src;
      try {
        const loaded = await loadImage(imgSrc);
        const aspect = loaded.width / loaded.height;
        let imgW = Math.min(CW, 120);
        let imgH = imgW / aspect;
        if (imgH > 80) { imgH = 80; imgW = imgH * aspect; }

        if (y + imgH + 5 > PH - M.bottom) { doc.addPage(); y = M.top; }

        doc.addImage(imgSrc, 'JPEG', M.left, y, imgW, imgH);

        // Lien localisation
        if (typeof img === 'object' && img.lat != null && img.lng != null) {
          const url = `https://www.google.com/maps?q=${img.lat},${img.lng}`;
          doc.setFont('Helvetica', 'italic');
          doc.setFontSize(7);
          doc.setTextColor(59, 130, 246);
          doc.textWithLink('Localisation', M.left, y + imgH + 3, { url });
          doc.setTextColor(50, 50, 50);
          y += imgH + 7;
        } else {
          y += imgH + 4;
        }
      } catch { /* image non chargée */ }
    }

    // Séparateur
    doc.setDrawColor(230);
    doc.line(M.left, y, PW - M.right, y);
    y += 5;
  }

  // Date
  if (y > PH - 20) { doc.addPage(); y = M.top; }
  doc.setFont('Helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`Exporté le ${new Date().toLocaleDateString('fr-FR')}`, M.left, PH - 10);

  // Télécharger
  const filename = `Visite_${(visit.nom || 'site').replace(/\s+/g, '_')}_${visit.date || 'nd'}.pdf`;
  doc.save(filename);
};
