// src/hooks/useCrrManager.js
//
// Gestion de l'etat du module Compte Rendu de Reunion.
// Stocke les reunions et la config participants dans le document projet.

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_PARTICIPANT_GROUPS,
  LEGAL_TEXT,
  createEmptyMeeting,
  createEmptyObservation,
  generateCrrId,
  defaultCategoryCode,
  abbreviateGroup,
  normalizeGroupBadgeName,
} from '../data/crrData';
import { migrateCrrData } from '../utils/crrMigration';
import {
  flattenAllContacts,
  addContactToTree,
  updateContactInTree,
  deleteContactFromTree,
  addSubGroupToTree,
  updateSubGroupInTree,
  deleteSubGroupFromTree,
  moveContactInTree,
  renameBadgeNameInTree,
} from '../utils/crrParticipantTree';
import { useRobustSave } from './useRobustSave';
import { useStableHash } from './useStableHash';
import { reoptimizeDataUrl } from '../utils/imageCompressor';
import { uploadCrrDataUrl, deleteCrrImage } from '../utils/crrImageStorage';

export const useCrrManager = ({
  project,
  onUpdateProject,
  onSaveProject,
  masterBranding,
}) => {
  const branding = masterBranding;

  // ── CONFIG (groupes de participants, categories, texte legal) ──────────

  const crrConfig = useMemo(() => {
    const cfg = project?.crrConfig || {};
    return {
      participantGroups: cfg.participantGroups || DEFAULT_PARTICIPANT_GROUPS,
      categories: cfg.categories || [...DEFAULT_CATEGORIES],
      categoryCodes: cfg.categoryCodes || {},
      legalText: cfg.legalText !== undefined ? cfg.legalText : LEGAL_TEXT,
      chantierInfo: {
        nom: '',
        lieu: '',
        dureePreparation: '',
        dureeChantier: '',
        dateDebut: '',
        dateFin: '',
        exportPath: '',
        exportPattern: 'CR{N}_{NOM}_{DATE}',
        ...(cfg.chantierInfo || {}),
      },
    };
  }, [project?.crrConfig]);

  // ── REUNIONS ──────────────────────────────────────────────────────────

  const meetings = useMemo(
    () => project?.crrMeetings || [],
    [project?.crrMeetings]
  );

  const [activeMeetingId, setActiveMeetingId] = useState(null);

  // Auto-selectionner la derniere reunion
  useEffect(() => {
    if (meetings.length > 0 && !activeMeetingId) {
      setActiveMeetingId(meetings[meetings.length - 1].id);
    }
  }, [meetings, activeMeetingId]);

  const activeMeeting = useMemo(
    () => meetings.find((m) => m.id === activeMeetingId) || null,
    [meetings, activeMeetingId]
  );

  // Participants stockes par reunion (fallback sur config globale pour anciens CR)
  const activeParticipantGroups = useMemo(
    () => activeMeeting?.participantGroups || crrConfig.participantGroups,
    [activeMeeting, crrConfig.participantGroups]
  );

  // Refs pour echapper aux closures stales lors d'editions rapides successives.
  // Sans ces refs, deux modifications quasi-simultanees d'observations peuvent
  // se baser sur un meme snapshot de project → la 2eme ecrase silencieusement la 1ere.
  const activeMeetingIdRef = useRef(activeMeetingId);
  const meetingsRef = useRef(meetings);
  useEffect(() => { activeMeetingIdRef.current = activeMeetingId; }, [activeMeetingId]);
  useEffect(() => { meetingsRef.current = meetings; }, [meetings]);

  // ── HELPERS PERSISTANCE ───────────────────────────────────────────────
  // Tous bases sur des functional updaters → React garantit qu'on lit toujours
  // le dernier etat, meme avec des appels rapprochees dans le meme tick.
  //
  // Chaque updater sauvegarde aussi un brouillon localStorage DANS le callback
  // setState (synchrone), ce qui couvre le gap de batching React 18 : meme si
  // le composant n'a pas encore re-rendu et que triggerSave n'a pas ete appele,
  // le brouillon est a jour quand visibilitychange/pagehide se declenchent.

  // Cle de brouillon TOUJOURS derivee de l'id de la donnee ecrite (jamais d'une
  // ref qui peut decaler pendant un changement d'affaire) → zero contamination
  // inter-affaire des brouillons localStorage.
  const syncDraft = (data) => {
    const key = data?.id ? `draft_crr_${data.id}` : null;
    if (!key) return;
    try { localStorage.setItem(key, JSON.stringify({ ...data, _draftAt: Date.now() })); } catch { /* ignore */ }
  };

  const updateProject = useCallback(
    (patch) => {
      if (!onUpdateProject) return;
      onUpdateProject((prev) => {
        if (!prev) return prev;
        const next = { ...prev, ...patch };
        syncDraft(next);
        return next;
      });
    },
    [onUpdateProject]
  );

  const updateMeetings = useCallback(
    (newMeetingsOrFn) => {
      if (!onUpdateProject) return;
      onUpdateProject((prev) => {
        if (!prev) return prev;
        const currentMeetings = prev.crrMeetings || [];
        const newMeetings = typeof newMeetingsOrFn === 'function'
          ? newMeetingsOrFn(currentMeetings)
          : newMeetingsOrFn;
        const next = { ...prev, crrMeetings: newMeetings };
        syncDraft(next);
        return next;
      });
    },
    [onUpdateProject]
  );

  const updateConfig = useCallback(
    (newConfig) => {
      updateProject({ crrConfig: newConfig });
    },
    [updateProject]
  );

  // patchOrFn peut etre :
  //  - un objet patch    : { observations: [...] }
  //  - une fonction      : (meeting) => ({ observations: [...] })
  // La forme fonctionnelle est preferee pour eviter les closures stales.
  const updateActiveMeeting = useCallback(
    (patchOrFn) => {
      const id = activeMeetingIdRef.current;
      if (!id) return;
      updateMeetings((meetings) =>
        meetings.map((m) => {
          if (m.id !== id) return m;
          const patch = typeof patchOrFn === 'function' ? patchOrFn(m) : patchOrFn;
          return { ...m, ...patch };
        })
      );
    },
    [updateMeetings]
  );

  // ── AUTOSAVE (robuste : debounce + retry + brouillon localStorage) ──

  const { saveStatus, triggerSave, forceSave } = useRobustSave({
    saveFn: onSaveProject,
    // Cle derivee de la donnee (jamais d'une cle figee) → brouillon toujours
    // ecrit sous l'id de l'affaire reellement sauvegardee, pas une autre.
    draftKey: (data) => (data?.id ? `draft_crr_${data.id}` : null),
    debounceMs: 1500,
  });

  const projectHash = useStableHash(project);
  const lastSavedHashRef = useRef(projectHash);
  useEffect(() => {
    if (projectHash === lastSavedHashRef.current) return;
    lastSavedHashRef.current = projectHash;
    triggerSave(project);
  }, [projectHash, triggerSave, project]);

  // Ref toujours a jour pour le handler visibilitychange (pas de closure stale)
  const projectRef = useRef(project);
  projectRef.current = project;

  // ── MIGRATION SCHEMA (numerotation stable) ────────────────────────────────
  // Backfill idempotent au chargement : obsKey / seq / originMeetingNumber +
  // crrObsCounters + categoryCodes. Une seule passe par projet ; ne boucle pas
  // (apres migration les obs portent deja leur obsKey → migrateCrrData renvoie
  // changed:false, et le guard par id court-circuite les rendus suivants).
  const migratedRef = useRef(null);
  useEffect(() => {
    const pid = project?.id;
    if (!pid || migratedRef.current === pid) return;
    migratedRef.current = pid;
    const result = migrateCrrData(project);
    if (!result.changed) return;
    onUpdateProject?.((prev) => {
      if (!prev) return prev;
      const next = {
        ...prev,
        crrMeetings: result.crrMeetings,
        crrConfig: result.crrConfig,
        crrObsCounters: result.crrObsCounters,
      };
      syncDraft(next);
      return next;
    });
  }, [project, onUpdateProject]);

  useEffect(() => {
    const flush = () => { forceSave(); };
    const onHidden = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('pagehide', flush);
    };
  }, [forceSave]);

  // ── ACTIONS REUNIONS ──────────────────────────────────────────────────

  const createMeeting = useCallback(() => {
    const nextNumber = meetings.length > 0
      ? Math.max(...meetings.map((m) => m.number)) + 1
      : 1;

    const newMeeting = createEmptyMeeting(nextNumber, crrConfig.categories);

    // Reporter les observations non soldees de la derniere reunion
    if (meetings.length > 0) {
      const lastMeeting = meetings[meetings.length - 1];
      // Report : uniquement les observations NON cloturees (Ouvert / En cours /
      // non classees). Les obs FAIT restent sur le CR ou elles ont ete soldees
      // et ne sont plus reportees (pas d'historique redondant). obsKey / seq /
      // date d'emission preserves par le spread → numero & age stables.
      newMeeting.observations = (lastMeeting.observations || [])
        .filter((obs) => obs.status !== 'done')
        .map((obs) => ({
          ...obs,
          id: `obs_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          originMeetingNumber: obs.originMeetingNumber || lastMeeting.number,
          originObsId: obs.id,
        }));

      // Copier le type de reunion et attendance structure (sans presences)
      newMeeting.type = lastMeeting.type === 'preparation' && nextNumber >= 5
        ? 'chantier'
        : lastMeeting.type;

      // Copier la diffusion de la derniere reunion
      newMeeting.diffusion = { ...lastMeeting.diffusion };

      // Copier les participants du dernier CR (snapshot)
      newMeeting.participantGroups = JSON.parse(JSON.stringify(
        lastMeeting.participantGroups || crrConfig.participantGroups
      ));
    } else {
      // Premier CR : copier le template global
      newMeeting.participantGroups = JSON.parse(JSON.stringify(crrConfig.participantGroups));
    }

    const newMeetings = [...meetings, newMeeting];
    updateMeetings(newMeetings);
    setActiveMeetingId(newMeeting.id);
  }, [meetings, crrConfig.categories, crrConfig.participantGroups, updateMeetings]);

  const duplicateMeeting = useCallback(
    (newDate) => {
      if (!activeMeeting) return;
      const source = activeMeeting;

      const nextNumber = meetings.length > 0
        ? Math.max(...meetings.map((m) => m.number)) + 1
        : 1;

      // Copier les observations avec de nouveaux IDs (originObsId pour l'audit)
      const newObs = (source.observations || []).map((obs, i) => ({
        ...obs,
        id: `obs_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 6)}`,
        originMeetingNumber: obs.originMeetingNumber || source.number,
        originObsId: obs.id,
      }));

      // Prochaine reunion = newDate + 7 jours
      let nextDate = '';
      if (newDate) {
        try {
          const d = new Date(newDate + 'T00:00:00');
          d.setDate(d.getDate() + 7);
          nextDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        } catch { /* ignore */ }
      }

      const newMeeting = {
        id: generateCrrId(),
        number: nextNumber,
        type: source.type,
        date: newDate || new Date().toISOString().split('T')[0],
        nextMeeting: {
          lieu: source.nextMeeting?.lieu || '',
          heure: source.nextMeeting?.heure || '',
          date: nextDate,
        },
        attendance: { ...source.attendance },
        diffusion: { ...source.diffusion },
        observations: newObs,
        participantGroups: JSON.parse(JSON.stringify(
          source.participantGroups || crrConfig.participantGroups
        )),
      };

      const newMeetings = [...meetings, newMeeting];
      updateMeetings(newMeetings);
      setActiveMeetingId(newMeeting.id);
    },
    [activeMeeting, meetings, crrConfig.participantGroups, updateMeetings]
  );

  const deleteMeeting = useCallback(
    (meetingId) => {
      // Purge Storage en arriere-plan pour toutes les images de la reunion
      const target = meetings.find((m) => m.id === meetingId);
      if (target?.observations) {
        for (const obs of target.observations) {
          for (const img of (obs.images || [])) deleteCrrImage(img);
        }
      }
      const newMeetings = meetings.filter((m) => m.id !== meetingId);
      updateMeetings(newMeetings);
      if (activeMeetingId === meetingId) {
        setActiveMeetingId(
          newMeetings.length > 0 ? newMeetings[newMeetings.length - 1].id : null
        );
      }
    },
    [meetings, activeMeetingId, updateMeetings]
  );

  // ── ACTIONS MEETING FIELDS ────────────────────────────────────────────

  const updateMeetingField = useCallback(
    (field, value) => {
      updateActiveMeeting({ [field]: value });
    },
    [updateActiveMeeting]
  );

  const updateNextMeeting = useCallback(
    (field, value) => {
      updateActiveMeeting((meeting) => ({
        nextMeeting: { ...(meeting.nextMeeting || {}), [field]: value },
      }));
    },
    [updateActiveMeeting]
  );

  // ── ACTIONS PARTICIPANTS (par reunion) ─────────────────────────────────

  const updateMeetingParticipantGroups = useCallback(
    (newGroups) => {
      if (activeMeetingId) {
        updateActiveMeeting({ participantGroups: newGroups });
      } else {
        // Aucune reunion (CR) active — cas d'un CRC neuf sans CR encore cree :
        // on ecrit dans le template global crrConfig, repris automatiquement
        // par le 1er CR cree. Sinon la creation de groupe serait un no-op muet.
        updateConfig({ ...crrConfig, participantGroups: newGroups });
      }
    },
    [activeMeetingId, updateActiveMeeting, updateConfig, crrConfig]
  );

  const addParticipantGroup = useCallback(
    (groupName = 'Nouveau groupe') => {
      const newGroup = {
        id: generateCrrId(),
        name: groupName,
        badgeName: normalizeGroupBadgeName(groupName),
        subLabel: '',
        contacts: [],
      };
      updateMeetingParticipantGroups([...activeParticipantGroups, newGroup]);
    },
    [activeParticipantGroups, updateMeetingParticipantGroups]
  );

  const updateParticipantGroup = useCallback(
    (groupId, patch) => {
      const oldGroup = activeParticipantGroups.find((g) => g.id === groupId);
      const oldName = oldGroup?.name;
      const oldBadge = normalizeGroupBadgeName(oldGroup?.badgeName) || abbreviateGroup(oldGroup?.name);
      const safePatch = patch.badgeName !== undefined
        ? { ...patch, badgeName: normalizeGroupBadgeName(patch.badgeName) }
        : patch;
      const newName = safePatch.name;
      const newBadge = safePatch.badgeName;

      let groups = activeParticipantGroups.map((g) =>
        g.id === groupId ? { ...g, ...safePatch } : g
      );
      if (safePatch.badgeName !== undefined && oldBadge && newBadge !== oldBadge) {
        groups = renameBadgeNameInTree(groups, oldBadge, newBadge);
      }

      // Sans reunion active : ecrire le template global (pas d'observations a patcher).
      if (!activeMeeting) { updateMeetingParticipantGroups(groups); return; }

      // Construire le patch complet en une seule mise à jour (évite stale closure)
      const meetingPatch = { participantGroups: groups };

      // Si le nom a changé, propager dans emitter/actionBy des observations
      if (newName && oldName && newName !== oldName) {
        const replaceGroupName = (fieldValue) => {
          if (!fieldValue) return fieldValue;
          const names = fieldValue.split(',').map((s) => s.trim());
          const updated = names.map((n) => (n === oldName ? newName : n));
          return updated.join(', ');
        };
        meetingPatch.observations = (activeMeeting.observations || []).map((o) => ({
          ...o,
          emitter: replaceGroupName(o.emitter),
          actionBy: replaceGroupName(o.actionBy),
        }));
      }

      updateActiveMeeting(meetingPatch);
    },
    [activeParticipantGroups, activeMeeting, updateActiveMeeting, updateMeetingParticipantGroups]
  );

  // Purge attendance/diffusion des contacts supprimes. Sans cela, les cles
  // orphelines s'accumulent et sont recopiees a chaque duplication de CR
  // (poids mort vers le plafond Firestore 1 Mo). Retourne null si rien a purger.
  const scrubbedPresence = useCallback(
    (removedIds) => {
      if (!activeMeeting || removedIds.length === 0) return null;
      const ids = new Set(removedIds);
      const hasOrphan = (obj) => obj && Object.keys(obj).some((k) => ids.has(k));
      if (!hasOrphan(activeMeeting.attendance) && !hasOrphan(activeMeeting.diffusion)) return null;
      const strip = (obj) => Object.fromEntries(Object.entries(obj || {}).filter(([k]) => !ids.has(k)));
      return { attendance: strip(activeMeeting.attendance), diffusion: strip(activeMeeting.diffusion) };
    },
    [activeMeeting]
  );

  // Renomme (newName) ou retire (newName=null) un nom de groupe/sous-groupe dans
  // les pastilles emetteur/actionBy des observations de la reunion active.
  // Retourne { observations } ou null (pas de reunion / rien a faire).
  const remapObsBadgeName = useCallback(
    (oldName, newName) => {
      if (!activeMeeting || !oldName) return null;
      const remap = (v) => {
        if (!v) return v;
        const out = [];
        for (const n of v.split(',').map((s) => s.trim()).filter(Boolean)) {
          if (n !== oldName) out.push(n);
          else if (newName) out.push(newName); // sinon on retire la pastille
        }
        return out.join(', ');
      };
      return {
        observations: (activeMeeting.observations || []).map((o) => ({
          ...o, emitter: remap(o.emitter), actionBy: remap(o.actionBy),
        })),
      };
    },
    [activeMeeting]
  );

  const deleteParticipantGroup = useCallback(
    (groupId) => {
      const deletedGroup = activeParticipantGroups.find((g) => g.id === groupId);
      const deletedName = deletedGroup?.name;

      const groups = activeParticipantGroups.filter((g) => g.id !== groupId);

      // Sans reunion active : ecrire le template global (pas d'observations a patcher).
      if (!activeMeeting) { updateMeetingParticipantGroups(groups); return; }

      // Construire le patch complet en une seule mise à jour (évite stale closure)
      const meetingPatch = { participantGroups: groups };

      // Purger attendance/diffusion des contacts du groupe supprime
      const scrub = scrubbedPresence(flattenAllContacts([deletedGroup].filter(Boolean)).map((c) => c.id));
      if (scrub) Object.assign(meetingPatch, scrub);

      // Nettoyer les références dans emitter/actionBy des observations
      if (deletedName) {
        const removeGroupName = (fieldValue) => {
          if (!fieldValue) return fieldValue;
          const names = fieldValue.split(',').map((s) => s.trim()).filter((n) => n !== deletedName);
          return names.join(', ');
        };
        meetingPatch.observations = (activeMeeting.observations || []).map((o) => ({
          ...o,
          emitter: removeGroupName(o.emitter),
          actionBy: removeGroupName(o.actionBy),
        }));
      }

      updateActiveMeeting(meetingPatch);
    },
    [activeParticipantGroups, activeMeeting, updateActiveMeeting, updateMeetingParticipantGroups, scrubbedPresence]
  );

  const reorderParticipantGroups = useCallback(
    (fromIndex, toIndex) => {
      const groups = [...activeParticipantGroups];
      const [moved] = groups.splice(fromIndex, 1);
      groups.splice(toIndex, 0, moved);
      updateMeetingParticipantGroups(groups);
    },
    [activeParticipantGroups, updateMeetingParticipantGroups]
  );

  // subGroupId optionnel : ajoute le contact dans un sous-groupe plutot que
  // directement dans le groupe.
  const addContact = useCallback(
    (groupId, subGroupId = null) => {
      const newContact = {
        id: generateCrrId(),
        name: '',
        fonction: '',
        email: '',
        phone: '',
        cpr: false,
      };
      updateMeetingParticipantGroups(
        addContactToTree(activeParticipantGroups, groupId, subGroupId, newContact)
      );
      return newContact.id;
    },
    [activeParticipantGroups, updateMeetingParticipantGroups]
  );

  // Le contact est retrouve par son id (groupe direct OU sous-groupe).
  const updateContact = useCallback(
    (_groupId, contactId, patch) => {
      const oldContact = flattenAllContacts(activeParticipantGroups).find((c) => c.id === contactId);
      const oldLabel = (oldContact?.subLabel || '').trim();
      const oldBadge = normalizeGroupBadgeName(oldContact?.badgeName) || abbreviateGroup(oldLabel);
      const safePatch = patch.badgeName !== undefined
        ? { ...patch, badgeName: normalizeGroupBadgeName(patch.badgeName) }
        : patch;
      let groups = updateContactInTree(activeParticipantGroups, contactId, safePatch);
      const newBadge = safePatch.badgeName;
      if (safePatch.badgeName !== undefined && oldBadge && newBadge !== oldBadge) {
        groups = renameBadgeNameInTree(groups, oldBadge, newBadge || '');
      }
      const obsPatch = (safePatch.subLabel !== undefined && oldLabel && safePatch.subLabel !== oldLabel)
        ? remapObsBadgeName(oldLabel, safePatch.subLabel || null)
        : null;
      if (obsPatch) updateActiveMeeting({ participantGroups: groups, ...obsPatch });
      else updateMeetingParticipantGroups(groups);
    },
    [activeParticipantGroups, updateMeetingParticipantGroups, updateActiveMeeting, remapObsBadgeName]
  );

  const deleteContact = useCallback(
    (_groupId, contactId) => {
      const groups = deleteContactFromTree(activeParticipantGroups, contactId);
      const scrub = scrubbedPresence([contactId]);
      if (scrub) updateActiveMeeting({ participantGroups: groups, ...scrub });
      else updateMeetingParticipantGroups(groups);
    },
    [activeParticipantGroups, updateMeetingParticipantGroups, updateActiveMeeting, scrubbedPresence]
  );

  // ── SOUS-GROUPES ───────────────────────────────────────────────────────

  const addSubGroup = useCallback(
    (groupId, name = 'Sous-groupe') => {
      const newSub = { id: generateCrrId(), name, badgeName: normalizeGroupBadgeName(name), subLabel: '', contacts: [] };
      updateMeetingParticipantGroups(
        addSubGroupToTree(activeParticipantGroups, groupId, newSub)
      );
      return newSub.id;
    },
    [activeParticipantGroups, updateMeetingParticipantGroups]
  );

  const updateSubGroup = useCallback(
    (groupId, subGroupId, patch) => {
      const parent = activeParticipantGroups.find((g) => g.id === groupId);
      const oldName = (parent?.subGroups || []).find((sg) => sg.id === subGroupId)?.name;
      const oldSubGroup = (parent?.subGroups || []).find((sg) => sg.id === subGroupId);
      const oldBadge = normalizeGroupBadgeName(oldSubGroup?.badgeName) || abbreviateGroup(oldSubGroup?.name);
      const safePatch = patch.badgeName !== undefined
        ? { ...patch, badgeName: normalizeGroupBadgeName(patch.badgeName) }
        : patch;
      let groups = updateSubGroupInTree(activeParticipantGroups, groupId, subGroupId, safePatch);
      if (safePatch.badgeName !== undefined && oldBadge && safePatch.badgeName !== oldBadge) {
        groups = renameBadgeNameInTree(groups, oldBadge, safePatch.badgeName || '');
      }
      // Propager un renommage aux pastilles des observations (comme un groupe)
      const obsPatch = (safePatch.name !== undefined && oldName && safePatch.name !== oldName)
        ? remapObsBadgeName(oldName, safePatch.name || null) : null;
      if (obsPatch) updateActiveMeeting({ participantGroups: groups, ...obsPatch });
      else updateMeetingParticipantGroups(groups);
    },
    [activeParticipantGroups, updateMeetingParticipantGroups, updateActiveMeeting, remapObsBadgeName]
  );

  const deleteSubGroup = useCallback(
    (groupId, subGroupId) => {
      const parent = activeParticipantGroups.find((g) => g.id === groupId);
      const sg = (parent?.subGroups || []).find((s) => s.id === subGroupId);
      const removedIds = (sg?.contacts || []).map((c) => c.id);
      const groups = deleteSubGroupFromTree(activeParticipantGroups, groupId, subGroupId);
      // Retirer la pastille du sous-groupe des observations + purger presence
      const scrub = scrubbedPresence(removedIds);
      const obsPatch = remapObsBadgeName(sg?.name, null);
      if (scrub || obsPatch) updateActiveMeeting({ participantGroups: groups, ...scrub, ...obsPatch });
      else updateMeetingParticipantGroups(groups);
    },
    [activeParticipantGroups, updateMeetingParticipantGroups, updateActiveMeeting, scrubbedPresence, remapObsBadgeName]
  );

  // ── IMPORT DEPUIS BIBLIOTHEQUE ─────────────────────────────────────────

  // Retourne le nombre de contacts REELLEMENT ajoutes (doublons ignores) pour
  // que l'UI puisse afficher un feedback honnete.
  const importContactsFromLibrary = useCallback(
    (contactsWithGroup) => {
      // contactsWithGroup : [{ contact, targetGroupId, targetSubGroupId?, targetIndex? }]
      const norm = (s) => (s || '').trim().toLowerCase();
      // Dedup sur l'ensemble des contacts existants (groupes + sous-groupes).
      const existing = flattenAllContacts(activeParticipantGroups);
      const allEmails = new Set(existing.filter((c) => c.email).map((c) => norm(c.email)));
      const allNames = new Set(existing.filter((c) => !c.email && c.name).map((c) => norm(c.name)));

      let groups = activeParticipantGroups;
      let addedCount = 0;

      for (const item of contactsWithGroup) {
        const lc = item.contact;
        const targetSubGroupId = item.targetSubGroupId || null;

        const lcEmail = norm(lc.email);
        const lcName = norm(lc.name);
        const isDuplicate =
          (lcEmail && allEmails.has(lcEmail)) ||
          (!lcEmail && lcName && allNames.has(lcName));
        if (isDuplicate) continue;

        // Groupe cible manquant : le creer a la volee.
        let targetGroupId = item.targetGroupId;
        if (!targetGroupId || !groups.some((g) => g.id === targetGroupId)) {
          targetGroupId = targetGroupId || generateCrrId();
          groups = [...groups, { id: targetGroupId, name: lc.subLabel || 'Participants', badgeName: normalizeGroupBadgeName(lc.subLabel || 'PART'), subLabel: '', contacts: [], subGroups: [] }];
        }

        const newContact = {
          id: generateCrrId(),
          name: lc.name || '',
          fonction: lc.fonction || '',
          email: lc.email || '',
          phone: lc.phone || '',
          subLabel: lc.subLabel || '',
          badgeName: normalizeGroupBadgeName(lc.subLabel || ''),
          cpr: false,
        };
        groups = addContactToTree(groups, targetGroupId, targetSubGroupId, newContact, item.targetIndex ?? null);
        addedCount += 1;
        if (lcEmail) allEmails.add(lcEmail);
        else if (lcName) allNames.add(lcName);
      }

      if (addedCount > 0) updateMeetingParticipantGroups(groups);
      return addedCount;
    },
    [activeParticipantGroups, updateMeetingParticipantGroups]
  );

  // ── DEPLACEMENT CONTACT (groupes / sous-groupes) ───────────────────────

  const moveContactBetweenGroups = useCallback(
    (contactId, destGroupId, destSubGroupId, toIndex) => {
      updateMeetingParticipantGroups(
        moveContactInTree(
          activeParticipantGroups,
          contactId,
          { groupId: destGroupId, subGroupId: destSubGroupId || null },
          toIndex
        )
      );
    },
    [activeParticipantGroups, updateMeetingParticipantGroups]
  );

  // ── ACTIONS PRESENCE / DIFFUSION ──────────────────────────────────────

  const setAttendance = useCallback(
    (contactId, status) => {
      updateActiveMeeting((meeting) => ({
        attendance: { ...(meeting.attendance || {}), [contactId]: status },
      }));
    },
    [updateActiveMeeting]
  );

  const setDiffusion = useCallback(
    (contactId, value) => {
      updateActiveMeeting((meeting) => ({
        diffusion: { ...(meeting.diffusion || {}), [contactId]: value },
      }));
    },
    [updateActiveMeeting]
  );

  // ── ACTIONS CATEGORIES ────────────────────────────────────────────────

  const addCategory = useCallback(
    (name) => {
      const trimmed = name?.trim();
      if (!trimmed) return;
      const cats = [...crrConfig.categories, trimmed];
      const codes = { ...(crrConfig.categoryCodes || {}) };
      if (!codes[trimmed]) codes[trimmed] = defaultCategoryCode(trimmed);
      updateConfig({ ...crrConfig, categories: cats, categoryCodes: codes });
    },
    [crrConfig, updateConfig]
  );

  const renameCategory = useCallback(
    (oldName, newName) => {
      const trimmed = newName?.trim();
      if (!trimmed || trimmed === oldName) return;
      // Patch atomique : categories + codes + compteurs + observations, en un
      // seul update projet (evite les ecritures partielles incoherentes).
      onUpdateProject?.((prev) => {
        if (!prev) return prev;
        const cfg = prev.crrConfig || {};
        const cats = (cfg.categories || []).map((c) => (c === oldName ? trimmed : c));

        const codes = { ...(cfg.categoryCodes || {}) };
        if (oldName in codes) { codes[trimmed] = codes[oldName]; delete codes[oldName]; }

        // Conserve la continuite du compteur de numerotation (seq jamais reutilise)
        const counters = { ...(prev.crrObsCounters || {}) };
        if (oldName in counters) {
          counters[trimmed] = Math.max(counters[trimmed] || 0, counters[oldName]);
          delete counters[oldName];
        }

        const newMeetings = (prev.crrMeetings || []).map((m) => ({
          ...m,
          observations: (m.observations || []).map((obs) =>
            obs.category === oldName ? { ...obs, category: trimmed } : obs
          ),
        }));

        const next = {
          ...prev,
          crrConfig: { ...cfg, categories: cats, categoryCodes: codes },
          crrMeetings: newMeetings,
          crrObsCounters: counters,
        };
        syncDraft(next);
        return next;
      });
    },
    [onUpdateProject]
  );

  const deleteCategory = useCallback(
    (name) => {
      const cats = crrConfig.categories.filter((c) => c !== name);
      const codes = { ...(crrConfig.categoryCodes || {}) };
      delete codes[name];
      // Le compteur crrObsCounters[name] est volontairement conserve : si la
      // categorie est recreee, la numerotation reprend sans reutiliser un seq.
      updateConfig({ ...crrConfig, categories: cats, categoryCodes: codes });
    },
    [crrConfig, updateConfig]
  );

  const reorderCategories = useCallback(
    (newOrder) => {
      updateConfig({ ...crrConfig, categories: newOrder });
    },
    [crrConfig, updateConfig]
  );

  // Code court de numerotation d'une categorie (prefixe "CHANTIER.04").
  const setCategoryCode = useCallback(
    (category, code) => {
      const cleaned = (code || '').toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 10);
      const codes = { ...(crrConfig.categoryCodes || {}), [category]: cleaned };
      updateConfig({ ...crrConfig, categoryCodes: codes });
    },
    [crrConfig, updateConfig]
  );

  // ── ACTIONS INFO CHANTIER ─────────────────────────────────────────────

  const updateChantierInfo = useCallback(
    (patch) => {
      updateConfig({
        ...crrConfig,
        chantierInfo: { ...crrConfig.chantierInfo, ...patch },
      });
    },
    [crrConfig, updateConfig]
  );

  // ── ACTIONS OBSERVATIONS ──────────────────────────────────────────────

  const addObservation = useCallback(
    (category) => {
      // Generer l'obs une seule fois (id + obsKey stables).
      const newObs = createEmptyObservation(category);
      const createdId = newObs.id;
      // Update projet fonctionnel : attribue un seq stable depuis le compteur
      // projet (jamais reutilise) ET ajoute l'obs au meeting actif, en un seul
      // patch atomique (date + originMeetingNumber relus sur l'etat courant).
      onUpdateProject?.((prev) => {
        if (!prev) return prev;
        const id = activeMeetingIdRef.current;
        if (!id) return prev;
        const counters = { ...(prev.crrObsCounters || {}) };
        const seq = (counters[category] || 0) + 1;
        counters[category] = seq;
        const meetings = (prev.crrMeetings || []).map((m) => {
          if (m.id !== id) return m;
          return {
            ...m,
            observations: [
              ...(m.observations || []),
              { ...newObs, seq, date: m.date, originMeetingNumber: m.number },
            ],
          };
        });
        const next = { ...prev, crrMeetings: meetings, crrObsCounters: counters };
        syncDraft(next);
        return next;
      });
      return createdId;
    },
    [onUpdateProject]
  );

  const updateObservation = useCallback(
    (obsId, patch) => {
      // Functional updater → on mappe sur les observations LES PLUS RECENTES,
      // pas sur celles capturees au moment ou onUpdate a ete passe a la ligne.
      // C'est le fix qui empeche le revert de la derniere observation editee.
      updateActiveMeeting((meeting) => ({
        observations: (meeting.observations || []).map((o) =>
          o.id === obsId ? { ...o, ...patch } : o
        ),
      }));
    },
    [updateActiveMeeting]
  );

  const deleteObservation = useCallback(
    (obsId) => {
      // Best-effort cleanup Storage : lit la derniere version connue via ref.
      // Si jamais on rate une image (race), on aura un orphelin dans Storage,
      // pas un bug fonctionnel.
      const id = activeMeetingIdRef.current;
      const currentMeeting = meetingsRef.current?.find((m) => m.id === id);
      const target = currentMeeting?.observations?.find((o) => o.id === obsId);
      if (target?.images?.length) {
        for (const img of target.images) deleteCrrImage(img);
      }
      updateActiveMeeting((meeting) => ({
        observations: (meeting.observations || []).filter((o) => o.id !== obsId),
      }));
    },
    [updateActiveMeeting]
  );

  const reorderObservations = useCallback(
    (obsId, toCategory, toIndex) => {
      updateActiveMeeting((meeting) => {
        const obs = [...(meeting.observations || [])];
        const fromIdx = obs.findIndex((o) => o.id === obsId);
        if (fromIdx === -1) return {};
        const [original] = obs.splice(fromIdx, 1);
        // Clone pour eviter de muter l'observation originale (re-render fiable)
        const moved = { ...original, category: toCategory };

        const catObs = obs.filter((o) => o.category === toCategory);
        if (toIndex >= catObs.length) {
          const lastInCat = catObs[catObs.length - 1];
          const globalIdx = lastInCat ? obs.indexOf(lastInCat) + 1 : obs.length;
          obs.splice(globalIdx, 0, moved);
        } else {
          const targetObs = catObs[toIndex];
          const globalIdx = obs.indexOf(targetObs);
          obs.splice(globalIdx, 0, moved);
        }
        return { observations: obs };
      });
    },
    [updateActiveMeeting]
  );

  // ── OBSERVATIONS GROUPEES PAR CATEGORIE ───────────────────────────────

  const observationsByCategory = useMemo(() => {
    if (!activeMeeting) return {};
    const grouped = {};
    for (const cat of crrConfig.categories) {
      grouped[cat] = [];
    }
    for (const obs of activeMeeting.observations || []) {
      if (!grouped[obs.category]) grouped[obs.category] = [];
      grouped[obs.category].push(obs);
    }
    return grouped;
  }, [activeMeeting, crrConfig.categories]);

  // ── LISTE DES CONTACTS FLAT (pour les selects emetteur) ───────────────

  const allContacts = useMemo(
    () => flattenAllContacts(activeParticipantGroups),
    [activeParticipantGroups]
  );

  // Liste des emails pour la diffusion
  const diffusionEmails = useMemo(() => {
    if (!activeMeeting) return [];
    return allContacts
      .filter((c) => activeMeeting.diffusion?.[c.id] && c.email)
      .map((c) => c.email);
  }, [activeMeeting, allContacts]);

  // Config effective : participantGroups du CR actif, reste de la config globale
  const effectiveCrrConfig = useMemo(() => ({
    ...crrConfig,
    participantGroups: activeParticipantGroups,
  }), [crrConfig, activeParticipantGroups]);

  // ── OPTIMISATION IMAGES (hotfix doc > 1 Mo) ───────────────────────────
  //
  // Parcourt toutes les reunions et recompresse les images base64 en 600px/q=0.5.
  // Utilise pour debloquer un doc CRR qui depasse la limite Firestore 1 MiB.
  // Retourne { optimized, meetingsCount, sizeBefore, sizeAfter } pour feedback.

  const optimizeAllImages = useCallback(async ({ companyId } = {}) => {
    if (!meetings.length) {
      return { optimized: 0, migrated: 0, meetingsCount: 0, sizeBefore: 0, sizeAfter: 0 };
    }

    const crrId = project?.id;
    const canMigrate = !!(companyId && crrId);

    const measure = (obj) => {
      try { return new Blob([JSON.stringify(obj)]).size; } catch { return 0; }
    };
    const sizeBefore = measure(meetings);
    let optimizedCount = 0;
    let migratedCount = 0;
    let migrationErrors = 0;

    // Recompresse un base64 puis tente de migrer vers Storage.
    // Retourne { src, path?, lat?, lng? } si migration OK,
    // sinon un string base64 recompresse (fallback robuste).
    const processDataUrl = async (dataUrl, obsId, extraMeta = {}) => {
      let recompressed = dataUrl;
      try { recompressed = await reoptimizeDataUrl(dataUrl, 600, 0.5); } catch { /* garder original */ }
      if (!canMigrate) {
        optimizedCount += 1;
        return { recompressed, uploaded: null };
      }
      try {
        const uploaded = await uploadCrrDataUrl(recompressed, {
          companyId, crrId, obsId,
          lat: extraMeta.lat, lng: extraMeta.lng,
        });
        migratedCount += 1;
        return { recompressed, uploaded };
      } catch (err) {
        console.warn('[CRC] Migration Storage echouee (obs', obsId, '):', err?.code || err?.message);
        migrationErrors += 1;
        optimizedCount += 1;
        return { recompressed, uploaded: null };
      }
    };

    const newMeetings = await Promise.all(
      meetings.map(async (m) => {
        if (!m.observations?.length) return m;
        const newObs = await Promise.all(
          m.observations.map(async (obs) => {
            const imgs = obs.images || [];
            if (!imgs.length) return obs;
            const newImgs = await Promise.all(
              imgs.map(async (img) => {
                // Cas 1 : string base64 (ancien format)
                if (typeof img === 'string') {
                  if (!img.startsWith('data:image/')) return img;
                  const { recompressed, uploaded } = await processDataUrl(img, obs.id);
                  return uploaded || recompressed;
                }
                // Cas 2 : objet { src, lat, lng, _placeholder } avec src base64
                if (img && typeof img === 'object' && typeof img.src === 'string' && img.src.startsWith('data:image/')) {
                  const { _placeholder, src, lat, lng, ...rest } = img;
                  const { recompressed, uploaded } = await processDataUrl(src, obs.id, { lat, lng });
                  if (uploaded) return { ...rest, ...uploaded };
                  // Fallback : garder le base64 recompresse avec lat/lng d'origine
                  const fallback = { ...rest, src: recompressed };
                  if (lat != null && lng != null) { fallback.lat = lat; fallback.lng = lng; }
                  return fallback;
                }
                // Cas 3 : deja Storage ({ src: url, path, ... }) → rien a faire
                return img;
              })
            );
            return { ...obs, images: newImgs };
          })
        );
        return { ...m, observations: newObs };
      })
    );

    updateMeetings(newMeetings);
    const sizeAfter = measure(newMeetings);

    return {
      optimized: optimizedCount,
      migrated: migratedCount,
      migrationErrors,
      meetingsCount: meetings.length,
      sizeBefore,
      sizeAfter,
    };
  }, [meetings, updateMeetings, project?.id]);

  // ── Scan & nettoyage des photos cassees (URLs Storage qui retournent 404) ──
  // Detecte les images dont l'URL http(s) ne repond plus (fichier supprime du
  // bucket Storage) et les retire des observations. Cas typique : ancienne
  // archive .crcestima v1 (sans embed base64) re-importee apres delete cascade.
  // @param {{ onProgress?: (p:{done:number,total:number,broken:number}) => void }} opts
  // @returns {Promise<{scanned:number, broken:number, removed:number}>}
  const cleanBrokenImages = useCallback(async ({ onProgress } = {}) => {
    // 1. Recense toutes les images avec URL http(s)
    const refs = []; // [{ mIdx, oIdx, iIdx, url }]
    meetings.forEach((m, mIdx) => {
      (m.observations || []).forEach((obs, oIdx) => {
        (obs.images || []).forEach((img, iIdx) => {
          const src = typeof img === 'object' && img ? img.src : img;
          if (typeof src === 'string' && /^https?:\/\//i.test(src)) {
            refs.push({ mIdx, oIdx, iIdx, url: src });
          }
        });
      });
    });

    if (refs.length === 0) {
      return { scanned: 0, broken: 0, removed: 0 };
    }

    // 2. Teste chaque URL en parallele (pool de 6), dedup
    let done = 0;
    let brokenCount = 0;
    const cache = new Map(); // url → bool isBroken
    onProgress?.({ done, total: refs.length, broken: brokenCount });

    const testOne = async (ref) => {
      try {
        let isBroken = cache.get(ref.url);
        if (isBroken === undefined) {
          const resp = await fetch(ref.url, { method: 'GET', cache: 'no-store' });
          isBroken = !resp.ok;
          cache.set(ref.url, isBroken);
        }
        ref.broken = isBroken;
      } catch {
        ref.broken = true;
        cache.set(ref.url, true);
      }
      if (ref.broken) brokenCount += 1;
      done += 1;
      onProgress?.({ done, total: refs.length, broken: brokenCount });
    };

    const POOL = 6;
    for (let i = 0; i < refs.length; i += POOL) {
      await Promise.all(refs.slice(i, i + POOL).map(testOne));
    }

    // 3. Retire les images cassees du tableau images de chaque observation
    const brokenKeys = new Set(
      refs.filter((r) => r.broken).map((r) => `${r.mIdx}_${r.oIdx}_${r.iIdx}`)
    );
    if (brokenKeys.size === 0) {
      return { scanned: refs.length, broken: 0, removed: 0 };
    }

    const newMeetings = meetings.map((m, mIdx) => {
      if (!m.observations?.length) return m;
      return {
        ...m,
        observations: m.observations.map((obs, oIdx) => {
          if (!obs.images?.length) return obs;
          const newImages = obs.images.filter((_, iIdx) => !brokenKeys.has(`${mIdx}_${oIdx}_${iIdx}`));
          if (newImages.length === obs.images.length) return obs;
          return { ...obs, images: newImages };
        }),
      };
    });

    updateMeetings(newMeetings);

    return { scanned: refs.length, broken: brokenKeys.size, removed: brokenKeys.size };
  }, [meetings, updateMeetings]);

  // ── RETURN ────────────────────────────────────────────────────────────

  return {
    // Config
    crrConfig: effectiveCrrConfig,
    updateConfig,
    branding,

    // Meetings
    meetings,
    activeMeetingId,
    setActiveMeetingId,
    activeMeeting,
    createMeeting,
    duplicateMeeting,
    deleteMeeting,
    updateMeetingField,
    updateNextMeeting,

    // Participants
    activeParticipantGroups,
    addParticipantGroup,
    updateParticipantGroup,
    deleteParticipantGroup,
    reorderParticipantGroups,
    addContact,
    updateContact,
    deleteContact,
    addSubGroup,
    updateSubGroup,
    deleteSubGroup,

    // Import bibliotheque
    importContactsFromLibrary,
    moveContactBetweenGroups,

    // Info Chantier
    updateChantierInfo,

    // Presence / Diffusion
    setAttendance,
    setDiffusion,

    // Categories
    addCategory,
    renameCategory,
    deleteCategory,
    reorderCategories,
    setCategoryCode,

    // Observations
    observationsByCategory,
    addObservation,
    updateObservation,
    deleteObservation,
    reorderObservations,

    // Utils
    allContacts,
    diffusionEmails,
    saveStatus,
    forceSave,
    optimizeAllImages,
    cleanBrokenImages,
  };
};
