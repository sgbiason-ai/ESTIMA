import { useState } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { stampPdfCredit } from '../../../utils/estimaCredit';
import { cleanText } from '../../../utils/helpers';
import { toast } from '../../../utils/globalUI';
import { PAGE_WIDTH_PX, PAGE_HEIGHT_PX } from '../constants/bpuLayout';

/**
 * useBpuPdfExport
 * Génère et télécharge le PDF du BPU via html2canvas (page de garde + pages A4).
 *
 * Les indicateurs visuels d'override (fond amber, ring) sont retirés directement
 * sur le clone DOM avant capture — plus fiable qu'un <style> injecté que
 * html2canvas peut ignorer.
 */
// Échelle de capture html2canvas. 1.5 = bon compromis netteté/perf.
// Scale 2 doublait la taille du canvas (×4 pixels) pour un gain visuel
// quasi nul à l'impression A4 et un coût temps ~+70%.
const PDF_CAPTURE_SCALE = 1.5;

export const useBpuPdfExport = ({ project }) => {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState({ current: 0, total: 0 });

  // ── Nettoie les classes visuelles UI sur un nœud cloné ──────────────────────
  // Appelé après cloneNode() pour s'assurer que le PDF ne montre jamais
  // le fond amber ni le ring des champs modifiés.
  const stripOverrideStyles = (root) => {
    const targets = root.querySelectorAll(
      '.bg-amber-50, .ring-amber-300, .ring-1'
    );
    targets.forEach((el) => {
      el.classList.remove('bg-amber-50', 'ring-amber-300', 'ring-1');
      el.style.backgroundColor = 'transparent';
      el.style.boxShadow = 'none';
    });
  };

  // ── Convertit les puces natives en puces textuelles ──────────────────────
  // html2canvas rend mal `list-style-type: disc` (puces décentrées, marker
  // sur sa propre ligne au-dessus du texte). On reconstruit chaque <li> en
  // flex layout avec un span dédié au marker — résultat aligné et stable.
  const wrapLiWithMarker = (li, markerText) => {
    li.style.display = 'flex';
    li.style.alignItems = 'flex-start';
    li.style.gap = '0.4em';
    li.style.padding = '0';
    li.style.margin = '0';
    li.style.textIndent = '0';
    const marker = document.createElement('span');
    marker.textContent = markerText;
    marker.style.flexShrink = '0';
    marker.style.lineHeight = 'inherit';
    const content = document.createElement('span');
    content.style.flex = '1';
    content.style.minWidth = '0';
    while (li.firstChild) content.appendChild(li.firstChild);
    li.appendChild(marker);
    li.appendChild(content);
  };

  const convertListsForPdf = (root) => {
    root.querySelectorAll('.html-content ul').forEach((ul) => {
      ul.style.listStyle = 'none';
      ul.style.paddingLeft = '1.2em';
      ul.style.margin = '0.2em 0';
      Array.from(ul.children).forEach((li) => {
        if (li.tagName === 'LI') wrapLiWithMarker(li, '•');
      });
    });
    root.querySelectorAll('.html-content ol').forEach((ol) => {
      ol.style.listStyle = 'none';
      ol.style.paddingLeft = '1.5em';
      ol.style.margin = '0.2em 0';
      let idx = 1;
      Array.from(ol.children).forEach((li) => {
        if (li.tagName !== 'LI') return;
        wrapLiWithMarker(li, `${idx}.`);
        idx += 1;
      });
    });
  };

  const handleDownloadPdf = async () => {
    const coverElement = document.getElementById('bpu-pdf-cover');
    const pageElements = document.querySelectorAll('.bpu-page-to-pdf');
    const total = (coverElement ? 1 : 0) + pageElements.length;

    setIsGeneratingPdf(true);
    setPdfProgress({ current: 0, total });
    await new Promise((resolve) => setTimeout(resolve, 100));
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      const pageWidth  = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let done = 0;

      // ── PAGE DE GARDE (div cachée #bpu-pdf-cover) ────────────────────────
      if (coverElement) {
        coverElement.style.display = 'block';
        const coverCanvas = await html2canvas(coverElement, {
          scale: PDF_CAPTURE_SCALE, useCORS: true, logging: false,
          backgroundColor: '#ffffff',
          windowWidth: PAGE_WIDTH_PX, windowHeight: PAGE_HEIGHT_PX,
        });
        coverElement.style.display = 'none';
        doc.addImage(coverCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
        done += 1;
        setPdfProgress({ current: done, total });
      }

      // ── PAGES CONTENU (.bpu-page-to-pdf) ────────────────────────────────
      for (let i = 0; i < pageElements.length; i++) {
        doc.addPage();

        const clone = pageElements[i].cloneNode(true);

        // Retirer les styles visuels d'override AVANT la capture
        stripOverrideStyles(clone);
        // Convertir les puces natives en texte (fix rendu html2canvas)
        convertListsForPdf(clone);
        // Retirer les éléments d'UI non imprimables (boutons ✕ des photos)
        clone.querySelectorAll('[data-ui]').forEach((n) => n.remove());

        Object.assign(clone.style, {
          position: 'fixed', top: '0', left: '0', zIndex: '-9999',
          margin: '0', width: `${PAGE_WIDTH_PX}px`, height: `${PAGE_HEIGHT_PX}px`,
          transform: 'none', overflow: 'hidden',
        });

        document.body.appendChild(clone);
        const canvas = await html2canvas(clone, {
          scale: PDF_CAPTURE_SCALE, useCORS: true, logging: false,
          backgroundColor: '#ffffff',
          windowWidth: PAGE_WIDTH_PX, windowHeight: PAGE_HEIGHT_PX,
        });
        document.body.removeChild(clone);

        doc.addImage(canvas.toDataURL('image/jpeg', 0.80), 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
        done += 1;
        setPdfProgress({ current: done, total });
      }

      stampPdfCredit(doc);
      doc.save(`BPU_${project?.name ? cleanText(project.name) : 'PROJET'}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Erreur PDF:', error);
      toast.error('Erreur lors de la génération PDF.');
    } finally {
      setIsGeneratingPdf(false);
      setPdfProgress({ current: 0, total: 0 });
    }
  };

  return { isGeneratingPdf, pdfProgress, handleDownloadPdf };
};