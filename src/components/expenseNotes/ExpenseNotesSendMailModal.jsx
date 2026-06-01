// src/components/expenseNotes/ExpenseNotesSendMailModal.jsx
//
// Modale d'envoi d'une note de frais kilometrique par email via Cloud Function SMTP.
// Le PDF est genere localement, encode base64, envoye au serveur (sendCrcEmail)
// qui le joint au mail. Reutilise l'infra SMTP par utilisateur (cf. module CRC).

import React, { useEffect, useMemo, useState } from 'react';
import {
  X, Send, Loader2, Plus, Paperclip, Mail, AlertTriangle, Eye,
} from 'lucide-react';
import { toast } from '../../utils/globalUI';
import { buildExpenseMailSubject, buildExpenseDefaultMessage, messageToHtml } from '../../utils/expenseMailer';
import { generateExpenseNotesPdf } from '../../utils/pdf/pdfExpenseNotesGenerator';
import { sendCrcEmail } from '../../services/mailService';

// ─── Helpers ────────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isValidEmail = (e) => EMAIL_RE.test(String(e || '').trim());

// Blob -> base64 (sans prefixe data:)
const blobToBase64 = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onloadend = () => {
    const result = String(reader.result || '');
    const idx = result.indexOf(',');
    resolve(idx >= 0 ? result.slice(idx + 1) : result);
  };
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});

// ─── Champ chips emails ─────────────────────────────────────────────────────

const EmailChips = ({ label, emails, setEmails, placeholder }) => {
  const [input, setInput] = useState('');

  const add = (raw) => {
    const parts = String(raw).split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
    const next = [...emails];
    parts.forEach((p) => { if (!next.includes(p)) next.push(p); });
    setEmails(next);
    setInput('');
  };

  const remove = (e) => setEmails(emails.filter((x) => x !== e));

  const handleKey = (ev) => {
    if (ev.key === 'Enter' || ev.key === ',' || ev.key === ';') {
      ev.preventDefault();
      if (input.trim()) add(input);
    } else if (ev.key === 'Backspace' && !input && emails.length) {
      setEmails(emails.slice(0, -1));
    }
  };

  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 bg-gray-100 border border-gray-200/60 rounded-xl focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 min-h-[42px]">
        {emails.map((e) => {
          const valid = isValidEmail(e);
          return (
            <span
              key={e}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] ${
                valid ? 'bg-white border border-gray-200/60 text-gray-800' : 'bg-red-50 border border-red-200 text-red-700'
              }`}
              title={valid ? e : 'Adresse invalide'}
            >
              {e}
              <button type="button" onClick={() => remove(e)} className="text-gray-400 hover:text-gray-700">
                <X size={11} />
              </button>
            </span>
          );
        })}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          onBlur={() => input.trim() && add(input)}
          placeholder={emails.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] bg-transparent outline-none text-sm py-0.5"
        />
      </div>
    </div>
  );
};

// ─── Modale principale ──────────────────────────────────────────────────────

const ExpenseNotesSendMailModal = ({
  open, onClose,
  pdfPayload,          // opts pour generateExpenseNotesPdf (sans returnBlob)
  monthLabel,          // ex: "Mai 2026"
  userName,
  totalKm, totalAmount, tripCount, vehicleLabel, trancheLabel,
  smtpConfig,
  defaultRecipients = [],
}) => {
  const [to, setTo] = useState([]);
  const [showCc, setShowCc] = useState(false);
  const [cc, setCc] = useState([]);
  const [showBcc, setShowBcc] = useState(false);
  const [bcc, setBcc] = useState([]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [pdfStatus, setPdfStatus] = useState('idle'); // idle | building

  // Initialisation a l'ouverture uniquement (sur la transition false -> true).
  // NB : on ne met QUE `open` en dependance — sinon le defaut `defaultRecipients = []`
  // (nouveau tableau a chaque render) relancerait l'effet en boucle infinie.
  useEffect(() => {
    if (!open) return;
    setTo(Array.isArray(defaultRecipients) ? [...defaultRecipients] : []);
    setCc([]);
    setBcc([]);
    setSubject(buildExpenseMailSubject(monthLabel, userName));
    setMessage(buildExpenseDefaultMessage({
      monthLabel, userName, totalKm, totalAmount, tripCount, vehicleLabel, trancheLabel,
    }));
    setShowPreview(false);
    setShowCc(false);
    setShowBcc(false);
    setPdfStatus('idle');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Corps HTML = message edite par l'utilisateur, converti en HTML
  const htmlBody = useMemo(() => messageToHtml(message), [message]);

  if (!open) return null;

  const invalidEmails = [...to, ...cc, ...bcc].filter((e) => !isValidEmail(e));
  const canSend = to.length > 0 && invalidEmails.length === 0
    && subject.trim() && message.trim() && smtpConfig?.isConfigured;

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      // 1. Genere le PDF localement (blob)
      setPdfStatus('building');
      const pdfData = await generateExpenseNotesPdf({ ...pdfPayload, returnBlob: true });
      if (!pdfData?.blob) throw new Error('Echec generation PDF.');
      const filename = pdfData.filename;
      setPdfStatus('idle');

      // 2. Encode base64
      const pdfBase64 = await blobToBase64(pdfData.blob);

      // 3. Appelle Cloud Function (companyId/crrId omis -> pas de log CRC, simple envoi)
      await sendCrcEmail({
        to, cc, bcc,
        subject: subject.trim(),
        htmlBody,
        pdfBase64,
        pdfFilename: filename,
      });

      toast.success(`Note de frais envoyee a ${to.length} destinataire${to.length > 1 ? 's' : ''}.`);
      onClose();
    } catch (err) {
      console.error('Erreur envoi note de frais:', err);
      toast.error(`Echec envoi : ${err.message}`);
    } finally {
      setSending(false);
      setPdfStatus('idle');
    }
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/60">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-100 p-2 rounded-xl">
              <Mail size={18} className="text-emerald-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-base">Envoyer la note de frais</h2>
              <p className="text-[11px] text-gray-500">{monthLabel}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
            title="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {!smtpConfig?.isConfigured ? (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
              <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-bold text-amber-900 mb-1">SMTP non configure</p>
                <p className="text-[12px] text-amber-800">
                  Pour envoyer des emails depuis le serveur, configurez d'abord votre serveur SMTP
                  dans <strong>Hub → Mon Compte → Email</strong>. Le mail partira ensuite directement
                  avec le PDF en piece jointe (pas besoin d'Outlook).
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-100 text-[11px] text-emerald-800">
              <Mail size={14} />
              Envoi depuis <strong>{smtpConfig.fromName ? `${smtpConfig.fromName} <${smtpConfig.fromEmail}>` : smtpConfig.fromEmail}</strong>
            </div>
          )}

          {/* Destinataires */}
          <EmailChips label="A *" emails={to} setEmails={setTo} placeholder="email@exemple.fr, separe par virgule ou entree" />

          <div className="flex items-center gap-3 text-[11px]">
            {!showCc && (
              <button type="button" onClick={() => setShowCc(true)} className="text-blue-600 hover:underline flex items-center gap-1">
                <Plus size={11} /> Cc
              </button>
            )}
            {!showBcc && (
              <button type="button" onClick={() => setShowBcc(true)} className="text-blue-600 hover:underline flex items-center gap-1">
                <Plus size={11} /> Cci
              </button>
            )}
          </div>

          {showCc && <EmailChips label="Cc" emails={cc} setEmails={setCc} placeholder="" />}
          {showBcc && <EmailChips label="Cci" emails={bcc} setEmails={setBcc} placeholder="" />}

          {invalidEmails.length > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-700">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              <span>Adresse(s) invalide(s) : {invalidEmails.join(', ')}</span>
            </div>
          )}

          {/* Sujet */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Sujet
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-gray-100 border border-gray-200/60 rounded-xl px-4 py-2.5 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
            />
          </div>

          {/* Message du mail — pre-rempli et entierement editable */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={12}
              placeholder="Corps du mail…"
              className="w-full bg-gray-100 border border-gray-200/60 rounded-xl px-4 py-2.5 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none resize-y leading-relaxed"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Pre-rempli avec le recapitulatif — modifiable librement. Une ligne vide cree un nouveau paragraphe.
            </p>
          </div>

          {/* Toggle preview */}
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="flex items-center gap-2 text-[11px] text-blue-600 hover:underline"
          >
            <Eye size={12} /> {showPreview ? 'Masquer' : 'Apercu'} du message
          </button>
          {showPreview && (
            <div className="rounded-xl border border-gray-200/60 p-4 bg-gray-50 max-h-[200px] overflow-y-auto text-[12px]">
              <div dangerouslySetInnerHTML={{ __html: htmlBody }} />
            </div>
          )}

          {/* PDF attache */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 border border-gray-200/60 text-[12px] text-gray-700">
            <Paperclip size={14} className="text-gray-400" />
            Piece jointe : <strong>note de frais {monthLabel} (PDF, genere a l'envoi)</strong>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-200/60 bg-gray-50">
          <div className="text-[11px] text-gray-500">
            {pdfStatus === 'building' && (
              <span className="flex items-center gap-1.5"><Loader2 size={11} className="animate-spin" /> Generation du PDF…</span>
            )}
            {sending && pdfStatus !== 'building' && (
              <span className="flex items-center gap-1.5"><Loader2 size={11} className="animate-spin" /> Envoi en cours…</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={sending}
              className="px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-100 text-sm font-medium transition-colors disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              onClick={handleSend}
              disabled={!canSend || sending}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
            >
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Envoyer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExpenseNotesSendMailModal;
