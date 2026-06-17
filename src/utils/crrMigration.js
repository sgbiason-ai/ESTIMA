// src/utils/crrMigration.js
//
// Migration idempotente du schema CRC vers le modele de numerotation stable.
//
// Objectif : garantir que CHAQUE observation possede
//   - obsKey               : identite STABLE de cycle de vie (survit aux reports)
//   - seq                  : compteur fige DANS la categorie ("CHANTIER.04")
//   - originMeetingNumber  : reunion d'emission (pour le calcul de l'Age)
// et que le document porte
//   - project.crrObsCounters         : { [categorie]: dernierSeq }  (jamais reutilise)
//   - project.crrConfig.categoryCodes: { [categorie]: code court }   (prefixe de numero)
//
// La fonction est PURE et idempotente : un second appel sur un projet deja
// migre renvoie { changed:false } et les memes references (aucune ecriture).

import { defaultCategoryCode } from '../data/crrData';

// Resout la categorie d'une observation (fallback defensif).
const obsCategory = (obs) => obs?.category || '';

/**
 * Calcule la version migree d'un projet CRC.
 * @param {object} project  doc CRC ({ crrMeetings, crrConfig, crrObsCounters })
 * @returns {{ changed:boolean, crrMeetings:Array, crrConfig:object, crrObsCounters:object }}
 */
export const migrateCrrData = (project) => {
  const meetings = project?.crrMeetings || [];
  const config = project?.crrConfig || {};
  const categories = config.categories || [];

  // Compteurs par categorie, amorces sur l'existant pour ne JAMAIS reutiliser un seq.
  const counters = { ...(project?.crrObsCounters || {}) };

  // Maps de resolution de chaine de reports.
  const keyByInstanceId = {};   // id d'instance      → obsKey
  const seqByKey = {};          // obsKey             → seq
  const originByKey = {};       // obsKey             → originMeetingNumber

  // On parcourt les reunions par numero croissant : la 1re instance rencontree
  // d'une chaine de reports est donc sa racine (ou la plus ancienne survivante).
  const sortedMeetings = [...meetings].sort(
    (a, b) => (a.number || 0) - (b.number || 0)
  );

  for (const m of sortedMeetings) {
    for (const obs of (m.observations || [])) {
      // 1. obsKey : reprise / heritage de la chaine / nouvelle racine deterministe
      let key;
      if (obs.obsKey) {
        key = obs.obsKey;
      } else if (obs.originObsId && keyByInstanceId[obs.originObsId]) {
        key = keyByInstanceId[obs.originObsId];
      } else {
        key = `k_${obs.id}`; // deterministe (ids d'instance uniques) → tests stables
      }
      keyByInstanceId[obs.id] = key;

      // 2. seq : fige une seule fois par obsKey (par categorie de la 1re instance)
      if (seqByKey[key] == null) {
        if (obs.seq != null) {
          seqByKey[key] = obs.seq;
        } else {
          const cat = obsCategory(obs);
          counters[cat] = (counters[cat] || 0) + 1;
          seqByKey[key] = counters[cat];
        }
      }
      // Garde le compteur >= au plus grand seq deja present (coherence)
      if (obs.seq != null) {
        const cat = obsCategory(obs);
        counters[cat] = Math.max(counters[cat] || 0, obs.seq);
      }

      // 3. originMeetingNumber : reunion d'emission, figee une fois par obsKey
      if (originByKey[key] == null) {
        originByKey[key] = obs.originMeetingNumber ?? m.number ?? null;
      }
    }
  }

  // ── Application aux observations (ordre d'origine conserve) ──
  let meetingsChanged = false;
  const newMeetings = meetings.map((m) => {
    let mChanged = false;
    const newObs = (m.observations || []).map((obs) => {
      const key = keyByInstanceId[obs.id];
      const seq = seqByKey[key];
      const origin = obs.originMeetingNumber ?? originByKey[key] ?? null;
      if (obs.obsKey === key && obs.seq === seq && obs.originMeetingNumber === origin) {
        return obs;
      }
      mChanged = true;
      return { ...obs, obsKey: key, seq, originMeetingNumber: origin };
    });
    if (!mChanged) return m;
    meetingsChanged = true;
    return { ...m, observations: newObs };
  });

  // ── Codes de categorie par defaut (sans ecraser ceux deja definis) ──
  const existingCodes = config.categoryCodes || {};
  const newCodes = { ...existingCodes };
  let codesChanged = false;
  for (const cat of categories) {
    if (!newCodes[cat]) {
      newCodes[cat] = defaultCategoryCode(cat);
      codesChanged = true;
    }
  }

  // ── Compteurs : detecte un ecart vs l'existant ──
  const existingCounters = project?.crrObsCounters || {};
  let countersChanged = Object.keys(counters).some(
    (cat) => (existingCounters[cat] || 0) !== (counters[cat] || 0)
  );

  const changed = meetingsChanged || codesChanged || countersChanged;

  return {
    changed,
    crrMeetings: meetingsChanged ? newMeetings : meetings,
    crrConfig: codesChanged ? { ...config, categoryCodes: newCodes } : config,
    crrObsCounters: countersChanged || meetingsChanged ? counters : existingCounters,
  };
};
