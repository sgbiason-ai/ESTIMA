// src/utils/crrMailer.js
//
// Workflow envoi CR via Outlook :
// 1. Sauvegarde le PDF dans un dossier choisi (retenu en memoire via IndexedDB)
// 2. Genere un script VBS qui ouvre Outlook avec le PDF en piece jointe
// 3. L'utilisateur double-clique le VBS -> Outlook s'ouvre avec tout pre-rempli
// 4. Le VBS et le fichier de donnees se suppriment automatiquement

import { MEETING_TYPES } from '../data/crrData';

// ─── HELPERS ────────────────────────────────────────────────────────────────

const formatDateFR = (dateStr) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
};

// ─── IndexedDB : retenir le dossier d'export ────────────────────────────────

const DB_NAME = 'estima-crr';
const STORE = 'handles';
const DIR_KEY = 'export-dir';

const idbOpen = () =>
  new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });

const idbSave = async (handle) => {
  const db = await idbOpen();
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).put(handle, DIR_KEY);
  await new Promise((res, rej) => {
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
};

const idbLoad = async () => {
  try {
    const db = await idbOpen();
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(DIR_KEY);
    return new Promise((res) => {
      req.onsuccess = () => res(req.result || null);
      req.onerror = () => res(null);
    });
  } catch {
    return null;
  }
};

// ─── Obtenir le dossier d'export (reutilise ou picker) ──────────────────────

const getExportDir = async () => {
  // Tenter de reutiliser le handle sauvegarde dans IndexedDB
  const saved = await idbLoad();
  if (saved) {
    try {
      const perm = await saved.requestPermission({ mode: 'readwrite' });
      if (perm === 'granted') return saved;
    } catch {
      /* handle invalide, on passe au picker */
    }
  }
  // Picker de dossier
  const handle = await window.showDirectoryPicker({
    id: 'crr-export',
    mode: 'readwrite',
    startIn: 'documents',
  });
  await idbSave(handle);
  return handle;
};

// ─── Ecriture fichier dans le dossier ───────────────────────────────────────

const writeFile = async (dirHandle, filename, content) => {
  const fh = await dirHandle.getFileHandle(filename, { create: true });
  const w = await fh.createWritable();
  await w.write(content);
  await w.close();
};

// ─── HTML du mail (entities ASCII-safe pour le VBS) ─────────────────────────

const htmlEsc = (s) =>
  (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const buildMailHtml = (meeting, projectName) => {
  const date = formatDateFR(meeting.date);
  const num = meeting.number || '';

  let h = '<p>Bonjour,</p>';
  h += '<p>Vous trouverez ci-joint le compte rendu';
  if (num) h += ` n&deg;${htmlEsc(String(num))}`;
  h += ` de l'op&eacute;ration &laquo;&nbsp;${htmlEsc(projectName)}&nbsp;&raquo;`;
  if (date) h += ` en date du ${date}`;
  h += '.</p><br>';

  if (meeting.nextMeeting?.date) {
    const parts = [];
    if (meeting.nextMeeting.lieu) parts.push(htmlEsc(meeting.nextMeeting.lieu));
    if (meeting.nextMeeting.heure) parts.push(`&agrave; ${htmlEsc(meeting.nextMeeting.heure)}`);
    parts.push(`le ${formatDateFR(meeting.nextMeeting.date)}`);
    h += '<hr style="margin:15px 0;border:0;border-top:1px solid #eee;">';
    h += `<p><b>Prochaine r&eacute;union :</b> ${parts.join(' ')}</p>`;
    h += '<hr style="margin:15px 0;border:0;border-top:1px solid #eee;">';
  }

  h += '<p style="color:#888;font-size:11px;">';
  h += 'Ce compte rendu est consid&eacute;r&eacute; comme approuv&eacute; sous 48h ';
  h += "en l'absence d'observations &eacute;crites.</p>";
  return h;
};

// ─── Fichier de donnees mail (UTF-8, lu par le VBS via ADODB.Stream) ────────

const buildMailData = (pdfFilename, to, subject, htmlBody) =>
  ['[TO]', to, '[SUBJECT]', subject, '[PDF]', pdfFilename, '[BODY]', htmlBody].join('\r\n');

// ─── Script VBS (pur ASCII, lit _crr_mail.txt en UTF-8) ────────────────────

const VBS_SCRIPT = `' EstimaVRD - Ouvre Outlook avec le compte rendu en piece jointe.
' Lit les donnees du mail depuis _crr_mail.txt (UTF-8).
' Se supprime automatiquement apres execution.

On Error Resume Next

Dim fso, scriptDir, dataPath
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
dataPath = scriptDir & "\\_crr_mail.txt"

' --- Lecture du fichier de donnees (UTF-8) ---
If Not fso.FileExists(dataPath) Then
    MsgBox "Fichier de donnees introuvable :" & vbCrLf & dataPath, vbCritical, "EstimaVRD"
    WScript.Quit
End If

Dim stream, content
Set stream = CreateObject("ADODB.Stream")
stream.Charset = "UTF-8"
stream.Open
stream.LoadFromFile dataPath
content = stream.ReadText
stream.Close
Set stream = Nothing

' --- Parsing des sections ---
Dim lines, i, section
Dim mailTo, mailSubject, mailPdf, mailBody
lines = Split(content, vbCrLf)
section = ""
mailTo = ""
mailSubject = ""
mailPdf = ""
mailBody = ""

For i = 0 To UBound(lines)
    Select Case Trim(lines(i))
        Case "[TO]":      section = "TO"
        Case "[SUBJECT]": section = "SUBJECT"
        Case "[PDF]":     section = "PDF"
        Case "[BODY]":    section = "BODY"
        Case Else
            Select Case section
                Case "TO":      If mailTo = "" Then mailTo = Trim(lines(i))
                Case "SUBJECT": If mailSubject = "" Then mailSubject = Trim(lines(i))
                Case "PDF":     If mailPdf = "" Then mailPdf = Trim(lines(i))
                Case "BODY":
                    If mailBody <> "" Then mailBody = mailBody & vbCrLf
                    mailBody = mailBody & lines(i)
            End Select
    End Select
Next

' --- Verification du PDF ---
Dim pdfPath
pdfPath = scriptDir & "\\" & mailPdf

If Not fso.FileExists(pdfPath) Then
    MsgBox "PDF non trouve :" & vbCrLf & pdfPath, vbCritical, "EstimaVRD"
    WScript.Quit
End If

' --- Ouverture Outlook ---
Dim objOutlook, objMail
Set objOutlook = CreateObject("Outlook.Application")

If Err.Number <> 0 Then
    MsgBox "Impossible de demarrer Outlook. Verifiez qu'il est installe.", vbCritical, "EstimaVRD"
    WScript.Quit
End If

Set objMail = objOutlook.CreateItem(0)

With objMail
    .To = mailTo
    .Subject = mailSubject
    .BodyFormat = 2
    .HTMLBody = mailBody
    .Attachments.Add pdfPath
    .Display
End With

' --- Nettoyage : suppression du fichier de donnees et du script ---
On Error Resume Next
fso.DeleteFile dataPath
fso.DeleteFile WScript.ScriptFullName

Set objMail = Nothing
Set objOutlook = Nothing
Set fso = Nothing
`;

// ─── FONCTION PRINCIPALE ────────────────────────────────────────────────────

/**
 * Workflow complet d'envoi du CR par mail via Outlook :
 * 1. Sauvegarde le PDF dans le dossier d'export (retenu en memoire)
 * 2. Genere _crr_mail.txt (donnees UTF-8) + Envoyer_CR.vbs (script Outlook)
 * 3. L'utilisateur double-clique le VBS pour ouvrir Outlook avec le PDF joint
 *
 * @returns {{ pdfSaved: boolean, vbsCreated?: boolean, fallback?: boolean }}
 */
export const openOutlookMail = async (meeting, crrConfig, projectName, emails, pdfData, options = {}) => {
  // ── Fallback si File System Access API indisponible ──
  if (!window.showDirectoryPicker) {
    const url = URL.createObjectURL(pdfData.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = pdfData.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    const typeLabel =
      MEETING_TYPES.find((t) => t.value === meeting.type)?.label || 'Reunion';
    const subject = `${typeLabel} n\u00B0${meeting.number} - ${projectName || 'Projet'} - ${formatDateFR(meeting.date)}`;
    const to = emails.join(';');
    window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}`;
    return { pdfSaved: true, vbsCreated: false, fallback: true };
  }

  // ── Obtenir le dossier d'export (priorite au handle configure dans Info Chantier) ──
  let dir;
  try {
    if (options.dirHandle) {
      // Verifier/redemander la permission sur le handle configure
      const perm = await options.dirHandle.queryPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        dir = options.dirHandle;
      } else {
        const req = await options.dirHandle.requestPermission({ mode: 'readwrite' });
        dir = req === 'granted' ? options.dirHandle : await getExportDir();
      }
    } else {
      dir = await getExportDir();
    }
  } catch (err) {
    if (err.name === 'AbortError') return { pdfSaved: false };
    throw err;
  }

  // ── 1. Sauvegarder le PDF ──
  await writeFile(dir, pdfData.filename, pdfData.blob);

  // ── 2. Generer le fichier de donnees mail (UTF-8) ──
  const typeLabel =
    MEETING_TYPES.find((t) => t.value === meeting.type)?.label || 'Reunion';
  const subject = `${typeLabel} n\u00B0${meeting.number} - ${projectName || 'Projet'} - ${formatDateFR(meeting.date)}`;
  const to = emails.join(';');
  const htmlBody = buildMailHtml(meeting, projectName);
  const mailData = buildMailData(pdfData.filename, to, subject, htmlBody);

  // Sauvegarder en UTF-8 avec BOM (pour ADODB.Stream)
  const BOM = new Uint8Array([0xEF, 0xBB, 0xBF]);
  const dataBytes = new TextEncoder().encode(mailData);
  const dataBlob = new Blob([BOM, dataBytes], { type: 'text/plain' });
  await writeFile(dir, '_crr_mail.txt', dataBlob);

  // ── 3. Sauvegarder le script VBS (ASCII pur) ──
  await writeFile(dir, 'Envoyer_CR.vbs', VBS_SCRIPT);

  return { pdfSaved: true, vbsCreated: true };
};
