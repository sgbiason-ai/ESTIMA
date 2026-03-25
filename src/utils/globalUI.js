// src/utils/globalUI.js
// ═══════════════════════════════════════════════════════════════════════════════
// Singleton global pour toast & confirm — accessible même hors composants React
// Les providers (ToastProvider / DialogProvider) enregistrent leurs fonctions ici.
// ═══════════════════════════════════════════════════════════════════════════════

const _state = {
  toast: null,
  confirm: null,
  prompt: null,
};

/** Enregistre les fonctions toast (appelé par ToastProvider au mount) */
export const registerToast = (fns) => { _state.toast = fns; };

/** Enregistre les fonctions dialog (appelé par DialogProvider au mount) */
export const registerDialog = (fns) => {
  _state.confirm = fns.confirm;
  _state.prompt = fns.prompt;
};

// ── TOAST shortcuts ─────────────────────────────────────────────────────────

export const toast = {
  success: (msg, opts) => _state.toast?.success(msg, opts),
  error:   (msg, opts) => _state.toast?.error(msg, opts),
  warning: (msg, opts) => _state.toast?.warning(msg, opts),
  info:    (msg, opts) => _state.toast?.info(msg, opts),
};

// ── DIALOG shortcuts ────────────────────────────────────────────────────────

/**
 * Confirm dialog — retourne une Promise<boolean>
 * @param {string} message
 * @param {object} [opts] - { title, danger, confirmLabel, cancelLabel }
 */
export const confirm = (message, opts) => {
  if (_state.confirm) return _state.confirm(message, opts);
  // Fallback si pas encore enregistré (ne devrait jamais arriver)
  return Promise.resolve(window.confirm(message));
};

/**
 * Prompt dialog — retourne une Promise<string|null>
 */
export const prompt = (message, defaultValue, opts) => {
  if (_state.prompt) return _state.prompt(message, defaultValue, opts);
  return Promise.resolve(window.prompt(message, defaultValue));
};
