import { useState, useEffect, useRef } from 'react';

// Parse tolérant d'une saisie utilisateur : virgule décimale FR, espaces
// (\s couvre les insécables U+00A0/U+202F des séparateurs de milliers), €.
// Vide/invalide → null.
export const parseNumericInput = (v) => {
  if (v == null) return null;
  const cleaned = String(v).replace(/[\s€]/g, '').replace(',', '.');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

// Affichage en saisie : virgule décimale, sans séparateur de milliers.
export const formatNumericDraft = (v) => (v == null || v === '' ? '' : String(v).replace('.', ','));

// ─── Saisie numérique tamponnée ──────────────────────────────────────────────
// Le champ est piloté par un état local pendant la frappe et ne remonte sa
// valeur qu'au blur ou à Entrée ; Échap annule.
//
// Pourquoi : un <input type="number"> contrôlé par la valeur distante se vide
// dès que la saisie est transitoirement invalide (« 12, », « 12. », « - ») — la
// spec HTML impose alors `.value === ''`. Le 0 réinjecté effaçait la frappe en
// cours, puis partait en base au bout des 800 ms d'auto-save. Le tampon règle
// aussi la latence : pendant la frappe seule la cellule se re-rend, au lieu de
// tout le tableau (displayColumns dépend de `companies`).
//
// Mêmes garanties que AeAmountInput (TabDepouillement) : resync depuis le prop
// hors focus uniquement, pour ne pas écraser une saisie en cours lors d'un
// import Excel ou d'un réimport négocié.
export const useNumericDraft = ({ value, onCommit, onDone }) => {
  const [draft, setDraft] = useState(() => formatNumericDraft(value));
  const [focused, setFocused] = useState(false);
  const cancelRef = useRef(false);

  useEffect(() => {
    if (!focused) setDraft(formatNumericDraft(value));
  }, [value, focused]);

  return {
    value: draft,
    inputMode: 'decimal',
    onChange: (e) => setDraft(e.target.value),
    onFocus: () => setFocused(true),
    onBlur: () => {
      setFocused(false);
      if (cancelRef.current) {
        cancelRef.current = false;
        setDraft(formatNumericDraft(value));
      } else {
        const parsed = parseNumericInput(draft);
        setDraft(formatNumericDraft(parsed));
        onCommit(parsed);
      }
      onDone?.();
    },
    onKeyDown: (e) => {
      if (e.key === 'Enter') e.currentTarget.blur();
      else if (e.key === 'Escape') { cancelRef.current = true; e.currentTarget.blur(); }
    },
  };
};
