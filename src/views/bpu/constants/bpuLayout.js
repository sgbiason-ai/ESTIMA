// ── DIMENSIONS PAGE A4 ────────────────────────────────────────────────────────
export const PAGE_WIDTH_PX = 794;
export const PAGE_HEIGHT_PX = 1123;
export const MARGIN_X_PX = 57;
export const MARGIN_TOP_PX = 40;
export const MARGIN_BOTTOM_PX = 60;
export const CONTENT_WIDTH_PX = PAGE_WIDTH_PX - (MARGIN_X_PX * 2);
export const CONTENT_HEIGHT_PX = PAGE_HEIGHT_PX - MARGIN_TOP_PX - MARGIN_BOTTOM_PX - 16;

// ── HAUTEURS DES ZONES ────────────────────────────────────────────────────────
export const HEADER_HEIGHT = 200;
export const TABLE_HEADER_HEIGHT = 35;
export const SIGNATURE_BLOCK_HEIGHT = 160;
export const MIN_SPACE_TO_FILL = 0;

// ── LARGEURS DES COLONNES ─────────────────────────────────────────────────────
export const COL_NUM_WIDTH = Math.floor(CONTENT_WIDTH_PX * 0.08);
export const COL_UNIT_WIDTH = Math.floor(CONTENT_WIDTH_PX * 0.08);
export const COL_PRICE_WIDTH = Math.floor(CONTENT_WIDTH_PX * 0.10);
export const COL_DESC_WIDTH = CONTENT_WIDTH_PX - COL_NUM_WIDTH - COL_UNIT_WIDTH - COL_PRICE_WIDTH - 2;

// ── SÉCURITÉ PERF (anti-crash sur grosses descriptions) ──────────────────────
export const MAX_DESC_CHARS_FOR_SPLIT = 10000;
export const MAX_SPLIT_ATTEMPTS = 25;
