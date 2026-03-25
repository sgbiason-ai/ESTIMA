// src/utils/migrateResources.js
//
// Script de migration one-shot.
// À exécuter UNE SEULE FOIS depuis AdminView ou la console navigateur.
//
// Ce qu'il fait :
//   1. Lit les ressources globales (resources/master_cctp, resources/master_rc, resources/branding)
//   2. Pour chaque companyId fourni, copie les données dans companies/{id}/resources/
//   3. Ne supprime PAS les anciennes données (sécurité — à faire manuellement)
//
// Usage dans AdminView :
//   import { migrateResourcesToCompany } from '../utils/migrateResources';
//   await migrateResourcesToCompany(['company_id_1', 'company_id_2']);
//
// Ou depuis la console navigateur (après avoir exposé la fonction) :
//   window.migrateResources(['company_id_1']);

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Migre les ressources globales vers les chemins par entreprise.
 *
 * @param {string[]} companyIds  — liste des companyId à migrer
 * @param {object}   options
 * @param {boolean}  options.dryRun  — si true, affiche ce qui serait fait sans écrire
 * @returns {Promise<{ success: string[], errors: string[] }>}
 */
export async function migrateResourcesToCompany(companyIds, { dryRun = false } = {}) {
  const success = [];
  const errors  = [];

  console.log(`[migrateResources] Début migration — ${companyIds.length} entreprise(s) — dryRun: ${dryRun}`);

  // 1. Lire les ressources globales
  let globalCctp     = null;
  let globalRc       = null;
  let globalBranding = null;

  try {
    const [cctpSnap, rcSnap, brandSnap] = await Promise.all([
      getDoc(doc(db, 'resources', 'master_cctp')),
      getDoc(doc(db, 'resources', 'master_rc')),
      getDoc(doc(db, 'resources', 'branding')),
    ]);

    if (cctpSnap.exists())  globalCctp     = cctpSnap.data();
    if (rcSnap.exists())    globalRc       = rcSnap.data();
    if (brandSnap.exists()) globalBranding = brandSnap.data();

    console.log('[migrateResources] Ressources globales lues :', {
      cctp:     globalCctp     ? '✅' : '⚠️ absent',
      rc:       globalRc       ? '✅' : '⚠️ absent',
      branding: globalBranding ? '✅' : '⚠️ absent',
    });
  } catch (e) {
    console.error('[migrateResources] Erreur lecture ressources globales:', e);
    errors.push(`Lecture globale: ${e.message}`);
    return { success, errors };
  }

  // 2. Copier vers chaque entreprise
  for (const companyId of companyIds) {
    console.log(`[migrateResources] → Migration de: ${companyId}`);

    try {
      const writes = [];

      if (globalCctp) {
        const destRef = doc(db, 'companies', companyId, 'resources', 'master_cctp');
        // Vérifier si une version locale existe déjà (ne pas écraser)
        const existing = await getDoc(destRef);
        if (existing.exists()) {
          console.log(`  ⏭️  CCTP déjà présent pour ${companyId} — ignoré`);
        } else {
          if (!dryRun) {
            writes.push(setDoc(destRef, {
              ...globalCctp,
              migratedAt: new Date().toISOString(),
              migratedFrom: 'resources/master_cctp',
            }));
          }
          console.log(`  📄 CCTP → companies/${companyId}/resources/master_cctp`);
        }
      }

      if (globalRc) {
        const destRef = doc(db, 'companies', companyId, 'resources', 'master_rc');
        const existing = await getDoc(destRef);
        if (existing.exists()) {
          console.log(`  ⏭️  RC déjà présent pour ${companyId} — ignoré`);
        } else {
          if (!dryRun) {
            writes.push(setDoc(destRef, {
              ...globalRc,
              migratedAt: new Date().toISOString(),
              migratedFrom: 'resources/master_rc',
            }));
          }
          console.log(`  📄 RC → companies/${companyId}/resources/master_rc`);
        }
      }

      if (globalBranding) {
        const destRef = doc(db, 'companies', companyId, 'resources', 'branding');
        const existing = await getDoc(destRef);
        if (existing.exists()) {
          console.log(`  ⏭️  Branding déjà présent pour ${companyId} — ignoré`);
        } else {
          if (!dryRun) {
            writes.push(setDoc(destRef, {
              ...globalBranding,
              migratedAt: new Date().toISOString(),
              migratedFrom: 'resources/branding',
            }));
          }
          console.log(`  🎨 Branding → companies/${companyId}/resources/branding`);
        }
      }

      if (!dryRun && writes.length > 0) {
        await Promise.all(writes);
      }

      success.push(companyId);
      console.log(`  ✅ ${companyId} migré (${writes.length} document(s) écrits)`);

    } catch (e) {
      console.error(`  ❌ Erreur pour ${companyId}:`, e);
      errors.push(`${companyId}: ${e.message}`);
    }
  }

  console.log(`[migrateResources] Terminé — ${success.length} succès, ${errors.length} erreurs`);
  if (errors.length > 0) {
    console.warn('[migrateResources] Erreurs:', errors);
  }

  // Rappel : ne pas supprimer les ressources globales automatiquement
  if (!dryRun && success.length > 0) {
    console.info(
      '[migrateResources] ⚠️  Les ressources globales (resources/master_cctp, etc.) ' +
      'sont conservées. Supprimez-les manuellement dans la console Firebase ' +
      'une fois la migration vérifiée.'
    );
  }

  return { success, errors };
}