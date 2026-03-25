import React from 'react';

const MobileStyles = () => (
  <style>{`
    .prose-mobile {
      font-size: 12.5px;
      line-height: 1.6;
      color: #94a3b8;
    }
    .prose-mobile p {
      margin: 0 0 8px 0;
    }
    .prose-mobile p:last-child {
      margin-bottom: 0;
    }
    .prose-mobile strong, .prose-mobile b {
      font-weight: 700;
      color: #cbd5e1;
    }
    .prose-mobile em, .prose-mobile i {
      font-style: italic;
    }
    .prose-mobile ul, .prose-mobile ol {
      margin: 4px 0 8px 0;
      padding-left: 18px;
    }
    .prose-mobile li {
      margin-bottom: 3px;
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
      color: #e2e8f0;
      margin: 8px 0 4px 0;
      font-size: 13px;
    }
    .prose-mobile table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      margin: 6px 0;
    }
    .prose-mobile td, .prose-mobile th {
      border: 1px solid rgba(255,255,255,0.1);
      padding: 4px 6px;
    }
    .prose-mobile th {
      background: rgba(255,255,255,0.05);
      font-weight: 700;
    }
  `}</style>
);

export default MobileStyles;
