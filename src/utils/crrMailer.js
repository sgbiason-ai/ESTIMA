// src/utils/crrMailer.js
//
// Workflow envoi CR via Outlook :
// 1. Archive le PDF dans le dossier choisi (retenu via IndexedDB) - best-effort
// 2. Genere un VBS auto-porte (PDF embarque en base64) telecharge par le navigateur
// 3. L'utilisateur clique "Ouvrir" depuis la barre de telechargements -> Outlook s'ouvre
// 4. Le VBS extrait le PDF dans %TEMP%, attache au mail, puis se supprime

import { MEETING_TYPES } from '../data/crrData';

// ─── HELPERS ────────────────────────────────────────────────────────────────

export const formatDateFR = (dateStr) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
};

// ─── HTML du mail (entities ASCII-safe pour le VBS) ─────────────────────────

const htmlEsc = (s) =>
  (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/[^\x20-\x7E]/g, (ch) => `&#${ch.codePointAt(0)};`);

export const buildMailHtml = (meeting, projectName) => {
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

// ─── Sujet et corps texte brut (reutilises par vue mobile + fallback mailto) ──

export const buildMailSubject = (meeting, projectName) => {
  const typeLabel =
    MEETING_TYPES.find((t) => t.value === meeting.type)?.label || 'Reunion';
  return `${typeLabel} n\u00B0${meeting.number} - ${projectName || 'Projet'} - ${formatDateFR(meeting.date)}`;
};

export const buildMailBodyPlainText = (meeting, projectName) => {
  const date = formatDateFR(meeting.date);
  const num = meeting.number || '';
  let body = 'Bonjour,\n\n';
  body += 'Vous trouverez ci-joint le compte rendu';
  if (num) body += ` n\u00B0${num}`;
  body += ` de l'op\u00E9ration \u00AB ${projectName || ''} \u00BB`;
  if (date) body += ` en date du ${date}`;
  body += '.\n\n';
  if (meeting.nextMeeting?.date) {
    const parts = [];
    if (meeting.nextMeeting.lieu) parts.push(meeting.nextMeeting.lieu);
    if (meeting.nextMeeting.heure) parts.push(`\u00E0 ${meeting.nextMeeting.heure}`);
    parts.push(`le ${formatDateFR(meeting.nextMeeting.date)}`);
    body += `Prochaine r\u00E9union : ${parts.join(' ')}\n\n`;
  }
  body += 'Ce compte rendu est consid\u00E9r\u00E9 comme approuv\u00E9 sous 48h ';
  body += "en l'absence d'observations \u00E9crites.";
  return body;
};

// ─── Helpers VBS auto-porte (PDF embarque en base64) ────────────────────────

// Encode un Blob en base64 (sans le prefixe data: URI)
const blobToBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || '');
      const idx = result.indexOf(',');
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

// Echappe une chaine pour insertion dans un litteral VBS.
// Les chars non-ASCII sont remplaces par ChrW(code) pour rester ASCII pur.
const escapeVbsLiteral = (s) => {
  const str = String(s || '');
  let out = '';
  let inQuote = false;
  for (const ch of str) {
    const code = ch.codePointAt(0);
    if (ch === '"') {
      if (!inQuote) { out += (out ? ' & ' : '') + '"'; inQuote = true; }
      out += '""';
    } else if (code < 0x20 || code > 0x7E) {
      if (inQuote) { out += '"'; inQuote = false; }
      out += (out ? ' & ' : '') + `ChrW(${code})`;
    } else {
      if (!inQuote) { out += (out ? ' & ' : '') + '"'; inQuote = true; }
      out += ch;
    }
  }
  if (inQuote) out += '"';
  return out || '""';
};

// Decoupe le base64 en chunks de taille fixe, declares dans un tableau VBS.
// On evite la concatenation par "& _" (limite de continuation) et la
// concatenation iterative (couteuse en O(n2)) en utilisant Join().
const buildBase64VbsArray = (b64, chunkSize = 800) => {
  const chunks = [];
  for (let i = 0; i < b64.length; i += chunkSize) {
    chunks.push(b64.slice(i, i + chunkSize));
  }
  const lines = [`Dim b64Chunks(${chunks.length - 1})`];
  chunks.forEach((c, i) => lines.push(`b64Chunks(${i}) = "${c}"`));
  lines.push('base64Pdf = Join(b64Chunks, "")');
  return lines.join('\r\n');
};

// Genere le VBS auto-porte (PDF embarque, pure ASCII).
const buildSelfContainedVbs = (base64Pdf, mailTo, mailSubject, mailHtml, pdfFilename) => {
  const script = `' EstimaVRD - VBS auto-porte : PDF embarque en base64.
' L'utilisateur clique "Ouvrir" depuis la barre de telechargements -> Outlook s'ouvre.
' Le PDF est extrait dans %TEMP%, attache au mail, puis le VBS se supprime.

On Error Resume Next

Dim mailTo, mailSubject, mailHtml, pdfFilename, base64Pdf
mailTo = ${escapeVbsLiteral(mailTo)}
mailSubject = ${escapeVbsLiteral(mailSubject)}
mailHtml = ${escapeVbsLiteral(mailHtml)}
pdfFilename = ${escapeVbsLiteral(pdfFilename)}

${buildBase64VbsArray(base64Pdf)}

' --- Decoder le PDF dans %TEMP% ---
Dim sh, tempPath
Set sh = CreateObject("WScript.Shell")
tempPath = sh.ExpandEnvironmentStrings("%TEMP%") & "\\" & pdfFilename

Dim xml, node, stream
Set xml = CreateObject("MSXML2.DOMDocument")
Set node = xml.createElement("base64")
node.dataType = "bin.base64"
node.text = base64Pdf

Set stream = CreateObject("ADODB.Stream")
stream.Type = 1
stream.Open
stream.Write node.nodeTypedValue
stream.SaveToFile tempPath, 2
stream.Close
Set stream = Nothing
Set node = Nothing
Set xml = Nothing

If Err.Number <> 0 Then
    MsgBox "Erreur lors de l'extraction du PDF dans le dossier temporaire.", vbCritical, "EstimaVRD"
    WScript.Quit
End If

' --- Ouvrir Outlook ---
Dim objOutlook, objMail
Set objOutlook = CreateObject("Outlook.Application")
If Err.Number <> 0 Then
    MsgBox "Impossible de demarrer Outlook. Verifiez qu'il est installe.", vbCritical, "EstimaVRD"
    WScript.Quit
End If

Set objMail = objOutlook.CreateItem(0)
Dim attachOk
attachOk = True
With objMail
    .To = mailTo
    .Subject = mailSubject
    .BodyFormat = 2
    .HTMLBody = mailHtml
    ' On Error Resume Next est actif : sans ce test, un echec de la piece
    ' jointe (antivirus verrouillant le PDF fraichement ecrit) ouvrirait le
    ' mail SANS piece jointe, sans aucun message.
    Err.Clear
    .Attachments.Add tempPath
    If Err.Number <> 0 Then
        attachOk = False
        Err.Clear
        MsgBox "Le PDF n'a pas pu etre joint automatiquement." & vbCrLf & "Joignez-le manuellement depuis :" & vbCrLf & tempPath, vbExclamation, "EstimaVRD"
    End If
    .Display
End With

' --- Nettoyage : suppression du PDF temporaire et du script ---
' (le PDF est conserve si la jointure a echoue, pour attachement manuel)
On Error Resume Next
Dim fso
Set fso = CreateObject("Scripting.FileSystemObject")
If attachOk Then fso.DeleteFile tempPath
fso.DeleteFile WScript.ScriptFullName

Set objMail = Nothing
Set objOutlook = Nothing
Set fso = Nothing
Set sh = Nothing
`;
  return script.replace(/\r?\n/g, '\r\n');
};

// ─── VBS leger : reference le PDF par nom (pas de base64) ──────────────────

export const buildLightVbs = (pdfFilename, mailTo, mailSubject, mailHtml) => {
  const script = `' EstimaVRD - Ouvrir Outlook avec le CR en piece jointe.
' Double-cliquez ce fichier pour lancer Outlook.

On Error Resume Next

Dim fso, pdfPath, scriptDir
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
pdfPath = scriptDir & "\\" & ${escapeVbsLiteral(pdfFilename)}

If Not fso.FileExists(pdfPath) Then
    MsgBox "Le fichier PDF n'a pas ete trouve :" & vbCrLf & pdfPath, vbCritical, "EstimaVRD"
    WScript.Quit
End If

Dim objOutlook, objMail
Set objOutlook = CreateObject("Outlook.Application")
If Err.Number <> 0 Then
    MsgBox "Impossible de demarrer Outlook. Verifiez qu'il est installe.", vbCritical, "EstimaVRD"
    WScript.Quit
End If

Set objMail = objOutlook.CreateItem(0)
With objMail
    .To = ${escapeVbsLiteral(mailTo)}
    .Subject = ${escapeVbsLiteral(mailSubject)}
    .BodyFormat = 2
    .HTMLBody = ${escapeVbsLiteral(mailHtml)}
    ' On Error Resume Next est actif : sans ce test, un echec de la piece
    ' jointe ouvrirait le mail SANS piece jointe, sans aucun message.
    Err.Clear
    .Attachments.Add pdfPath
    If Err.Number <> 0 Then
        Err.Clear
        MsgBox "Le PDF n'a pas pu etre joint automatiquement." & vbCrLf & "Joignez-le manuellement depuis :" & vbCrLf & pdfPath, vbExclamation, "EstimaVRD"
    End If
    .Display
End With

On Error Resume Next
fso.DeleteFile WScript.ScriptFullName
Set objMail = Nothing
Set objOutlook = Nothing
Set fso = Nothing
`;
  return script.replace(/\r?\n/g, '\r\n');
};

// ─── FONCTION PRINCIPALE ────────────────────────────────────────────────────

// Construit le VBS auto-porte du CR — retourne un .vbs direct (utilise `<a download>` cote caller)
export const buildMailScript = async (meeting, projectName, emails, pdfData) => {
  const subject = buildMailSubject(meeting, projectName);
  const to = emails.join(';');
  const htmlBody = buildMailHtml(meeting, projectName);
  const base64Pdf = await blobToBase64(pdfData.blob);
  const vbsContent = buildSelfContainedVbs(base64Pdf, to, subject, htmlBody, pdfData.filename);
  return {
    blob: new Blob([vbsContent], { type: 'application/octet-stream' }),
    filename: 'Envoyer_CR.vbs',
  };
};
