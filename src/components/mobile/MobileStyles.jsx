import React from 'react';

const MobileStyles = () => (
  <style>{`
    /* ─── BASE : écrans >= 400px (Pixel 8 Pro, Galaxy S24, etc.) ── */
    @media (min-width: 400px) {
      /* Agrandir les tailles de texte de base */
      .mobile-text-xs  { font-size: 13px !important; }
      .mobile-text-sm  { font-size: 15px !important; }
      .mobile-text-base { font-size: 17px !important; }
      .mobile-text-lg  { font-size: 20px !important; }
      .mobile-text-xl  { font-size: 24px !important; }
    }

    /* ─── Prose mobile (observations, descriptions) ────────── */
    .prose-mobile {
      font-size: 13.5px;
      line-height: 1.65;
      color: #6b7280;
    }
    @media (min-width: 400px) {
      .prose-mobile {
        font-size: 15px;
        line-height: 1.7;
      }
    }
    .prose-mobile p {
      margin: 0 0 10px 0;
    }
    .prose-mobile p:last-child {
      margin-bottom: 0;
    }
    .prose-mobile strong, .prose-mobile b {
      font-weight: 700;
      color: #374151;
    }
    .prose-mobile em, .prose-mobile i {
      font-style: italic;
    }
    .prose-mobile ul, .prose-mobile ol {
      margin: 4px 0 10px 0;
      padding-left: 20px;
    }
    .prose-mobile li {
      margin-bottom: 4px;
    }
    .prose-mobile ul li {
      list-style-type: disc;
    }
    .prose-mobile ol li {
      list-style-type: decimal;
    }
    .prose-mobile br {
      display: block;
      margin-top: 4px;
      content: "";
    }
    .prose-mobile h1, .prose-mobile h2, .prose-mobile h3,
    .prose-mobile h4, .prose-mobile h5, .prose-mobile h6 {
      font-weight: 700;
      color: #111827;
      margin: 10px 0 5px 0;
      font-size: 14px;
    }
    @media (min-width: 400px) {
      .prose-mobile h1, .prose-mobile h2, .prose-mobile h3,
      .prose-mobile h4, .prose-mobile h5, .prose-mobile h6 {
        font-size: 16px;
      }
    }
    .prose-mobile table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      margin: 8px 0;
    }
    @media (min-width: 400px) {
      .prose-mobile table {
        font-size: 13px;
      }
    }
    .prose-mobile td, .prose-mobile th {
      border: 1px solid #e5e7eb;
      padding: 5px 8px;
    }
    .prose-mobile th {
      background: #f9fafb;
      font-weight: 700;
      color: #374151;
    }

    /* ─── Zones tactiles minimales (48px recommandé Material) ─ */
    @media (min-width: 400px) {
      .touch-target {
        min-height: 48px;
        min-width: 48px;
      }
    }
  `}</style>
);

export default MobileStyles;
