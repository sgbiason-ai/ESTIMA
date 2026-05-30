// src/components/feedback/FeedbackWidget.jsx
// Bouton flottant (FAB) + modale de feedback utilisateur — desktop.
// Capture automatiquement : version de l'app, utilisateur, module actif,
// navigateur/appareil et (optionnel) une capture d'écran.
// Rendu via portal sur document.body pour flotter au-dessus de tous les modules.

import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MessageSquarePlus, X, Camera, Loader2, Check } from 'lucide-react';
import { APP_VERSION } from '../../data/changelog';
import { toast } from '../../utils/globalUI';
import { reoptimizeDataUrl } from '../../utils/imageCompressor';
import { submitFeedback } from '../../hooks/useFeedback';
import { useScreenShareSession } from '../../hooks/useSupportSession';
import SupportShareControls from './SupportShareControls';
import { FEEDBACK_TYPES, moduleLabel } from './feedbackConstants';

// Classes de couleur par type (boutons de sélection)
const TYPE_ACTIVE = {
  red:    'bg-red-50 border-red-300 text-red-700',
  amber:  'bg-amber-50 border-amber-300 text-amber-700',
  blue:   'bg-blue-50 border-blue-300 text-blue-700',
  violet: 'bg-violet-50 border-violet-300 text-violet-700',
};

const FeedbackWidget = ({ user, companyId, activeModule, isTablet = false }) => {
  const [open, setOpen]             = useState(false);
  const [type, setType]            = useState('bug');
  const [comment, setComment]      = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [shot, setShot]             = useState(null);   // dataURL capture
  const [shotLoading, setShotLoading] = useState(false);
  const [includeShot, setIncludeShot] = useState(true);

  // Assistance écran en direct (WebRTC)
  const share = useScreenShareSession({ user, companyId, activeModule });

  // ── Capture d'écran (html2canvas, lazy) ───────────────────────────────────
  const captureScreenshot = useCallback(async () => {
    setShotLoading(true);
    setShot(null);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(document.body, {
        // Ne pas capturer l'UI du widget (FAB + modale)
        ignoreElements: (el) => el?.dataset?.feedbackUi === 'true',
        scale: 1,
        logging: false,
        useCORS: true,
        backgroundColor: '#f5f5f7',
      });
      let dataUrl = canvas.toDataURL('image/jpeg', 0.6);
      // Réduction pour rester sous la limite Firestore (1 Mo / doc)
      dataUrl = await reoptimizeDataUrl(dataUrl, 1280, 0.55);
      if (dataUrl.length > 800000) {
        dataUrl = await reoptimizeDataUrl(dataUrl, 900, 0.45);
      }
      setShot(dataUrl);
    } catch {
      setShot(null);
    } finally {
      setShotLoading(false);
    }
  }, []);

  const openWidget = () => {
    setType('bug');
    setComment('');
    setIncludeShot(true);
    setShot(null);
    setOpen(true);
    // Capture l'écran tel que vu par l'utilisateur (la modale est ignorée)
    captureScreenshot();
  };

  const handleSubmit = async () => {
    if (!comment.trim() || submitting) return;
    setSubmitting(true);
    try {
      await submitFeedback({
        comment:     comment.trim(),
        type,
        version:     APP_VERSION,
        userEmail:   user?.email || null,
        userUid:     user?.uid || null,
        companyId:   companyId || null,
        module:      activeModule || null,
        moduleLabel: moduleLabel(activeModule),
        screenshot:  (includeShot && shot) ? shot : null,
        context: {
          userAgent: navigator.userAgent,
          screen:    `${window.screen.width}×${window.screen.height}`,
          viewport:  `${window.innerWidth}×${window.innerHeight}`,
          url:       window.location.href,
        },
      });
      toast.success('Merci ! Votre retour a bien été envoyé.');
      setOpen(false);
    } catch {
      toast.error("Échec de l'envoi. Réessayez dans un instant.");
    } finally {
      setSubmitting(false);
    }
  };

  const fabRight = isTablet ? '4.75rem' : '1rem';

  return createPortal(
    <div data-feedback-ui="true">
      {/* ── Assistance écran : bandeau + pointeur (persistant) ───────────── */}
      <SupportShareControls mode="overlay" share={share} />

      {/* ── FAB ─────────────────────────────────────────────────────────── */}
      {!open && (
        <button
          onClick={openWidget}
          aria-label="Donner un avis"
          title="Donner un avis / signaler un problème"
          style={{ position: 'fixed', bottom: '1rem', right: fabRight, zIndex: 9998 }}
          className="w-12 h-12 rounded-full bg-gray-900 hover:bg-gray-800 text-white shadow-lg
                     flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        >
          <MessageSquarePlus size={20} strokeWidth={1.75} />
        </button>
      )}

      {/* ── Modale ──────────────────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center
                     bg-black/20 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget && !submitting) setOpen(false); }}
        >
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            {/* En-tête */}
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <div>
                <h2 className="text-base font-bold text-gray-900">Votre avis nous intéresse</h2>
                <p className="text-gray-400 text-xs mt-0.5">
                  {moduleLabel(activeModule)} · v{APP_VERSION}
                </p>
              </div>
              <button
                onClick={() => !submitting && setOpen(false)}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-6 pb-6 space-y-4">
              {/* Type */}
              <div className="grid grid-cols-2 gap-2">
                {FEEDBACK_TYPES.map((t) => {
                  const Icon = t.icon;
                  const active = type === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setType(t.id)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                        active ? TYPE_ACTIVE[t.color] : 'bg-gray-50 border-gray-200/60 text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      <Icon size={15} strokeWidth={1.75} />
                      {t.label}
                    </button>
                  );
                })}
              </div>

              {/* Commentaire */}
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                autoFocus
                rows={4}
                placeholder="Décrivez votre retour, votre idée ou le problème rencontré…"
                className="w-full bg-gray-50 border border-gray-200/60 rounded-xl px-4 py-3 text-sm text-gray-800
                           placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100
                           focus:bg-white transition-all resize-none"
              />

              {/* Capture d'écran */}
              <div className="flex items-center gap-3 rounded-xl border border-gray-200/60 bg-gray-50 px-3 py-2.5">
                {shotLoading ? (
                  <div className="flex items-center gap-2 text-gray-400 text-xs">
                    <Loader2 size={14} className="animate-spin" /> Capture en cours…
                  </div>
                ) : shot ? (
                  <>
                    <img src={shot} alt="capture" className="w-12 h-9 object-cover rounded-md border border-gray-200" />
                    <label className="flex items-center gap-2 text-gray-600 text-xs cursor-pointer select-none flex-1">
                      <input
                        type="checkbox"
                        checked={includeShot}
                        onChange={(e) => setIncludeShot(e.target.checked)}
                        className="accent-blue-500 rounded"
                      />
                      Joindre la capture d'écran
                    </label>
                  </>
                ) : (
                  <button
                    onClick={captureScreenshot}
                    className="flex items-center gap-2 text-gray-500 hover:text-gray-800 text-xs transition-colors"
                  >
                    <Camera size={14} /> Joindre une capture d'écran
                  </button>
                )}
              </div>

              {/* Assistance écran en direct */}
              <SupportShareControls mode="modal" share={share} />

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => !submitting && setOpen(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-xs font-medium text-gray-500 hover:bg-gray-100 transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!comment.trim() || submitting}
                  className="flex-1 px-4 py-2.5 bg-gray-900 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed
                             text-white font-medium text-xs rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Envoyer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};

export default FeedbackWidget;
