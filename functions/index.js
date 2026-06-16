// EstimaVRD - Cloud Functions
//
// Endpoints HTTPS Callable pour envoi mail SMTP par utilisateur :
//   - saveSmtpConfig   : sauvegarde la config SMTP (mot de passe chiffre AES-256-GCM)
//   - testSmtp         : teste la connexion SMTP (verify nodemailer)
//   - sendCrcEmail     : envoie le CR par email avec PDF en piece jointe
//   - deleteSmtpConfig : supprime la config SMTP (public + chiffree)
//
// Securite :
//   - Mot de passe SMTP chiffre AES-256-GCM avec une cle stockee dans Firebase Secret Manager
//     (parametre SMTP_ENC_KEY, 32 bytes en hex = 64 chars)
//   - Config publique dans /users/{uid}/preferences/smtp (lisible par le user)
//   - Mot de passe chiffre dans /users/{uid}/private/smtpPassword (lisible seulement par admin SDK)
//   - Logs d'envoi dans /companies/{companyId}/crr/{crrId}/emails/{emailId}

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const { defineSecret } = require('firebase-functions/params');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

admin.initializeApp();

// Region Paris pour proximite utilisateur europeen, max 10 instances (budget control)
setGlobalOptions({ region: 'europe-west9', maxInstances: 10 });

// Cle maitre pour chiffrement (32 bytes hex = 64 chars)
// Definie via : firebase functions:secrets:set SMTP_ENC_KEY
const SMTP_ENC_KEY = defineSecret('SMTP_ENC_KEY');

// ─── Helpers chiffrement AES-256-GCM ────────────────────────────────────────

const encrypt = (plaintext, keyHex) => {
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) throw new Error('SMTP_ENC_KEY invalide (32 bytes attendus)');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format : [iv(12)][tag(16)][ciphertext] en base64
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
};

const decrypt = (blobB64, keyHex) => {
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) throw new Error('SMTP_ENC_KEY invalide (32 bytes attendus)');
  const data = Buffer.from(blobB64, 'base64');
  const iv = data.subarray(0, 12);
  const tag = data.subarray(12, 28);
  const ciphertext = data.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
};

// ─── Helpers communs ────────────────────────────────────────────────────────

const requireAuth = (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Connexion requise.');
  }
  return request.auth.uid;
};

const PWD_SENTINEL = '•'.repeat(8); // 8 puces : indique "mot de passe inchange"

const buildTransporter = (creds) => nodemailer.createTransport({
  host: creds.host,
  port: Number(creds.port),
  secure: Boolean(creds.secure),
  auth: { user: creds.user, pass: creds.password },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
});

// ─── saveSmtpConfig ────────────────────────────────────────────────────────

exports.saveSmtpConfig = onCall(
  { secrets: [SMTP_ENC_KEY], cors: true },
  async (request) => {
    const uid = requireAuth(request);
    const { host, port, secure, user, password, fromEmail, fromName } = request.data || {};

    if (!host || !port || !user || !fromEmail) {
      throw new HttpsError('invalid-argument', 'Champs obligatoires manquants (host, port, user, fromEmail).');
    }

    const db = admin.firestore();
    const publicData = {
      host: String(host).trim(),
      port: Number(port),
      secure: Boolean(secure),
      user: String(user).trim(),
      fromEmail: String(fromEmail).trim(),
      fromName: fromName ? String(fromName).trim() : '',
      isConfigured: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.doc(`users/${uid}/preferences/smtp`).set(publicData, { merge: true });

    // Mot de passe : chiffre uniquement si fourni et non sentinel
    if (password && password !== PWD_SENTINEL) {
      const encrypted = encrypt(String(password), SMTP_ENC_KEY.value());
      await db.doc(`users/${uid}/private/smtpPassword`).set({
        encrypted,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    logger.info('SMTP config saved', { uid, host: publicData.host });
    return { success: true };
  }
);

// ─── testSmtp ──────────────────────────────────────────────────────────────

exports.testSmtp = onCall(
  { secrets: [SMTP_ENC_KEY], cors: true },
  async (request) => {
    const uid = requireAuth(request);
    const db = admin.firestore();

    // Soit creds fournis directement (test depuis form non sauvegarde),
    // soit lecture Firestore (test apres sauvegarde)
    let creds = request.data || {};

    if (!creds.host || !creds.password || creds.password === PWD_SENTINEL) {
      const pubSnap = await db.doc(`users/${uid}/preferences/smtp`).get();
      const privSnap = await db.doc(`users/${uid}/private/smtpPassword`).get();
      if (!pubSnap.exists || !privSnap.exists) {
        throw new HttpsError('failed-precondition', 'SMTP non configure. Saisissez le mot de passe pour tester.');
      }
      const pub = pubSnap.data();
      const priv = privSnap.data();
      creds = {
        host: creds.host || pub.host,
        port: creds.port || pub.port,
        secure: creds.secure !== undefined ? creds.secure : pub.secure,
        user: creds.user || pub.user,
        password: decrypt(priv.encrypted, SMTP_ENC_KEY.value()),
      };
    }

    const transporter = buildTransporter(creds);

    try {
      await transporter.verify();
      logger.info('SMTP test OK', { uid, host: creds.host });
      return { success: true, message: 'Connexion SMTP etablie avec succes.' };
    } catch (err) {
      logger.warn('SMTP test failed', { uid, host: creds.host, error: err.message });
      throw new HttpsError('internal', `Echec connexion SMTP : ${err.message}`);
    }
  }
);

// ─── sendCrcEmail ──────────────────────────────────────────────────────────

exports.sendCrcEmail = onCall(
  { secrets: [SMTP_ENC_KEY], cors: true, memory: '512MiB', timeoutSeconds: 60 },
  async (request) => {
    const uid = requireAuth(request);
    const {
      companyId, crrId, meetingId, meetingNumber,
      to, cc, bcc, subject, htmlBody,
      pdfBase64, pdfFilename,
    } = request.data || {};

    if (!Array.isArray(to) || to.length === 0) {
      throw new HttpsError('invalid-argument', 'Au moins un destinataire est requis.');
    }
    if (!subject || !htmlBody || !pdfBase64 || !pdfFilename) {
      throw new HttpsError('invalid-argument', 'Champs requis manquants (subject, htmlBody, pdfBase64, pdfFilename).');
    }

    const db = admin.firestore();

    // Verifie l'appartenance a la company (defense en profondeur)
    if (companyId) {
      const userDoc = (await db.doc(`users/${uid}`).get()).data();
      if (!userDoc || userDoc.companyId !== companyId) {
        throw new HttpsError('permission-denied', 'Acces refuse a cette entreprise.');
      }
    }

    // Recupere config SMTP
    const pubSnap = await db.doc(`users/${uid}/preferences/smtp`).get();
    const privSnap = await db.doc(`users/${uid}/private/smtpPassword`).get();
    if (!pubSnap.exists || !privSnap.exists) {
      throw new HttpsError('failed-precondition', 'SMTP non configure. Voir Parametres > Email.');
    }
    const pub = pubSnap.data();
    const priv = privSnap.data();
    const password = decrypt(priv.encrypted, SMTP_ENC_KEY.value());

    const transporter = buildTransporter({ ...pub, password });
    const from = pub.fromName ? `"${pub.fromName}" <${pub.fromEmail}>` : pub.fromEmail;

    // Prepare log d'envoi
    let logRef = null;
    if (companyId && crrId) {
      logRef = db.collection(`companies/${companyId}/crr/${crrId}/emails`).doc();
      await logRef.set({
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        sentBy: uid,
        senderEmail: request.auth.token.email || pub.user,
        from: pub.fromEmail,
        fromName: pub.fromName || '',
        to,
        cc: cc || [],
        bcc: bcc || [],
        subject,
        meetingId: meetingId || null,
        meetingNumber: meetingNumber || null,
        pdfFilename,
        status: 'sending',
      });
    }

    try {
      const info = await transporter.sendMail({
        from,
        to: to.join(', '),
        cc: (cc && cc.length) ? cc.join(', ') : undefined,
        bcc: (bcc && bcc.length) ? bcc.join(', ') : undefined,
        replyTo: request.auth.token.email || undefined,
        subject,
        html: htmlBody,
        attachments: [{
          filename: pdfFilename,
          content: Buffer.from(pdfBase64, 'base64'),
          contentType: 'application/pdf',
        }],
      });

      if (logRef) {
        await logRef.update({
          status: 'sent',
          messageId: info.messageId,
          response: info.response || null,
        });
      }

      logger.info('CRC email sent', { uid, to: to.length, messageId: info.messageId });
      return { success: true, messageId: info.messageId };
    } catch (err) {
      if (logRef) {
        await logRef.update({ status: 'failed', error: err.message });
      }
      logger.error('CRC email failed', { uid, error: err.message });
      throw new HttpsError('internal', `Echec envoi : ${err.message}`);
    }
  }
);

// ─── deleteSmtpConfig ──────────────────────────────────────────────────────

exports.deleteSmtpConfig = onCall({ cors: true }, async (request) => {
  const uid = requireAuth(request);
  const db = admin.firestore();
  await Promise.all([
    db.doc(`users/${uid}/preferences/smtp`).delete(),
    db.doc(`users/${uid}/private/smtpPassword`).delete(),
  ]);
  logger.info('SMTP config deleted', { uid });
  return { success: true };
});

// ─── backfillMemberEmails ───────────────────────────────────────────────────
// Renseigne email/displayName des profils /users depuis Firebase Authentication.
// Le client ne peut pas lire l'email d'un AUTRE utilisateur (pas de listUsers
// côté navigateur) : seul l'Admin SDK y accède. Réservé au super-admin applicatif.
const APP_SUPER_ADMIN_EMAIL = 'samuel.biason@papyrus-be.fr';

exports.backfillMemberEmails = onCall({ cors: true }, async (request) => {
  requireAuth(request);
  if (request.auth.token.email !== APP_SUPER_ADMIN_EMAIL) {
    throw new HttpsError('permission-denied', 'Réservé au super-administrateur.');
  }

  const db = admin.firestore();
  const docs = (await db.collection('users').get()).docs;

  let updated = 0;
  const orphans = []; // docs /users sans compte Auth correspondant

  // getUsers accepte jusqu'à 100 identifiants par appel → on traite par paquets.
  for (let i = 0; i < docs.length; i += 100) {
    const chunk = docs.slice(i, i + 100);
    const res = await admin.auth().getUsers(chunk.map(d => ({ uid: d.id })));
    const byUid = new Map(res.users.map(u => [u.uid, u]));
    res.notFound.forEach(nf => orphans.push(nf.uid));

    await Promise.all(chunk.map(async (d) => {
      const authUser = byUid.get(d.id);
      if (!authUser) return;
      const data = d.data() || {};
      const patch = {};
      if (authUser.email && data.email !== authUser.email) patch.email = authUser.email;
      if (authUser.displayName && data.displayName !== authUser.displayName) patch.displayName = authUser.displayName;
      if (Object.keys(patch).length) {
        await d.ref.set(patch, { merge: true });
        updated++;
      }
    }));
  }

  logger.info('backfillMemberEmails', {
    by: request.auth.token.email, total: docs.length, updated, orphans: orphans.length,
  });
  return { total: docs.length, updated, orphans };
});
