import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";

/**
 * Input numérique "draft" : n'écrit dans le state global qu'à la validation.
 * Validation: onBlur, Enter, Tab
 * Annulation: Escape
 */
export default function DeferredNumberInput({
  value,
  onCommit,
  disabled = false,
  className = "",
  inputMode = "decimal",
  placeholder = "",
  min,
  max,
  step,
}) {
  const [draft, setDraft] = useState(value ?? "");
  const lastExternalValueRef = useRef(value ?? "");

  // Resync si la valeur externe change (DnD, undo, chargement, etc.)
  useEffect(() => {
    const ext = value ?? "";
    // évite d'écraser pendant la frappe si c'est la même valeur
    if (String(ext) !== String(lastExternalValueRef.current)) {
      setDraft(ext);
      lastExternalValueRef.current = ext;
    }
  }, [value]);

  const normalize = useCallback((v) => {
    // Autorise la virgule FR, trim, etc.
    const s = String(v ?? "").trim().replace(",", ".");
    if (s === "") return { ok: true, num: 0, raw: "" };

    const n = Number(s);
    if (Number.isNaN(n)) return { ok: false, num: null, raw: s };

    // clamp si min/max fournis
    let clamped = n;
    if (typeof min === "number") clamped = Math.max(min, clamped);
    if (typeof max === "number") clamped = Math.min(max, clamped);

    return { ok: true, num: clamped, raw: s };
  }, [min, max]);

  const commit = useCallback(() => {
    const { ok, num } = normalize(draft);
    if (!ok) {
      // revert si invalide
      setDraft(value ?? "");
      return;
    }

    const current = Number(value ?? 0);
    if (num !== current) {
      onCommit(num);
      lastExternalValueRef.current = num;
    } else {
      // remet proprement si besoin (ex: "01" -> 1)
      setDraft(value ?? "");
    }
  }, [draft, normalize, onCommit, value]);

  const canType = useMemo(() => !disabled, [disabled]);

  return (
    <input
      disabled={disabled}
      value={draft}
      onChange={(e) => {
        if (!canType) return;
        setDraft(e.target.value); // <-- AUCUN recalcul global ici
      }}
      onBlur={() => {
        if (!canType) return;
        commit(); // <-- commit uniquement ici
      }}
      onKeyDown={(e) => {
        if (!canType) return;

        if (e.key === "Enter" || e.key === "Tab") {
          commit(); // <-- commit sur validation clavier
          // Enter: on peut blur pour figer l’édition
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }

        if (e.key === "Escape") {
          e.preventDefault();
          setDraft(value ?? "");
          e.currentTarget.blur();
        }
      }}
      className={className}
      inputMode={inputMode}
      placeholder={placeholder}
      min={min}
      max={max}
      step={step}
    />
  );
}
