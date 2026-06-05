// ── DIMENSIONS PAGE A4 ────────────────────────────────────────────────────────
// Marges calquées sur l'export Word (section contenu : 700 twips ≈ 47 px) pour
// que la largeur de colonne « désignation » — et donc le retour à la ligne du
// texte, principal moteur de la pagination — soit identique au Word.
export const PAGE_WIDTH_PX = 794;
export const PAGE_HEIGHT_PX = 1123;
export const MARGIN_X_PX = 47;
export const MARGIN_TOP_PX = 40;
export const MARGIN_BOTTOM_PX = 47;
export const HEADER_TO_BODY_GAP_PX = 8;     // espace en-tête → tableau (mb-2)
export const CONTENT_WIDTH_PX = PAGE_WIDTH_PX - (MARGIN_X_PX * 2);
export const CONTENT_HEIGHT_PX = PAGE_HEIGHT_PX - MARGIN_TOP_PX - MARGIN_BOTTOM_PX - HEADER_TO_BODY_GAP_PX;

// ── HAUTEURS DES ZONES ────────────────────────────────────────────────────────
// HEADER_HEIGHT = hauteur réservée en haut de chaque page (≈ en-tête du Word).
export const HEADER_HEIGHT = 150;
export const TABLE_HEADER_HEIGHT = 40;       // ≈ 600 twips (≥ 30 pt) du Word
export const SIGNATURE_BLOCK_HEIGHT = 160;
export const MIN_SPACE_TO_FILL = 0;

// ── RÉGLAGE FIN PAGINATION ↔ WORD ─────────────────────────────────────────────
// Ajuste la capacité d'une page (en px) pour caler les sauts de page sur le Word.
//  > 0  → moins de place par page → l'aperçu coupe PLUS TÔT (moins d'articles/page)
//  < 0  → plus de place par page  → l'aperçu coupe PLUS TARD (plus d'articles/page)
// Seul nombre à toucher pour l'affinage « au cas par cas » avec le Word.
export const ROW_CAPACITY_ADJUST_PX = 0;

// ── LARGEURS DES COLONNES (10 / 70 / 10 / 10, calquées sur le Word) ───────────
export const COL_NUM_WIDTH = Math.floor(CONTENT_WIDTH_PX * 0.10);
export const COL_UNIT_WIDTH = Math.floor(CONTENT_WIDTH_PX * 0.10);
export const COL_PRICE_WIDTH = Math.floor(CONTENT_WIDTH_PX * 0.10);
export const COL_DESC_WIDTH = CONTENT_WIDTH_PX - COL_NUM_WIDTH - COL_UNIT_WIDTH - COL_PRICE_WIDTH - 2;

// ── SÉCURITÉ PERF (anti-crash sur grosses descriptions) ──────────────────────
export const MAX_DESC_CHARS_FOR_SPLIT = 10000;
export const MAX_SPLIT_ATTEMPTS = 25;
