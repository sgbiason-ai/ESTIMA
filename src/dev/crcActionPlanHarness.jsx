// src/dev/crcActionPlanHarness.jsx — Banc d'essai Plan d'actions CRC sans authentification.
// Monte CrcActionPlanModal avec des chantiers factices (le module vit derriere
// le login Firebase : c'est le seul moyen de verifier le rendu du texte riche et
// le changement de statut). Servi par /crc-harness.html en dev uniquement —
// jamais reference par l'app (exclu du build, rollup n'a qu'index.html en input).
import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import CrcActionPlanModal from '../views/crc/CrcActionPlanModal.jsx';
import CrrObservations from '../components/crr/CrrObservations.jsx';
import { ToastProvider } from '../contexts/ToastContext';
import { DialogProvider } from '../contexts/DialogContext';
import { setObsStatusInLastMeeting } from '../utils/crcActionPlan';
import '../index.css';

const ME = 'user-moi';

// Aujourd'hui + n jours, en ISO local (les sections dependent de la date reelle)
const iso = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const CHANTIERS_INIT = [
  {
    id: 'ch1',
    ownerId: ME,
    crrConfig: { chantierInfo: { nom: 'Rue des Écoles — Tranche 1' }, categoryCodes: { Travaux: 'TRX' } },
    crrMeetings: [
      { id: 'm1', number: 1, observations: [{ id: 'vieux', actionDeadline: iso(-90), status: 'open', text: 'CR anterieur — ne doit PAS apparaitre' }] },
      {
        id: 'm2',
        number: 2,
        observations: [
          {
            id: 'o1', seq: 1, category: 'Travaux', status: 'open',
            actionBy: 'ENTREPRISE, MOE', actionDeadline: iso(-4),
            // Cas du bug : HTML (gras + surlignage) qui s'affichait en balises brutes
            text: '<div>Reprendre le <b>regard EP</b> devant le n°12 — <span style="background-color:#fef08a">cote non conforme</span></div>',
          },
          {
            id: 'o2', seq: 2, category: 'Travaux', status: 'in_progress',
            actionBy: 'MOE', actionDeadline: iso(3),
            // Liste a puces : doit tenir sur 2 lignes sans casser la cellule
            text: '<ul><li>Fournir le PV de reception</li><li>Transmettre les <u>plans de recolement</u></li></ul>',
          },
          {
            id: 'o3', seq: 3, category: 'Travaux', status: 'open',
            actionBy: 'ENTREPRISE', actionDeadline: iso(20),
            text: 'Observation en texte simple (sans mise en forme)',
          },
        ],
      },
    ],
  },
  {
    id: 'ch2',
    // Chantier d'un AUTRE utilisateur : statut en lecture seule
    ownerId: 'un-autre',
    crrConfig: { chantierInfo: { nom: 'Giratoire RD920 (autre créateur)' }, categoryCodes: { Réseaux: 'RES' } },
    crrMeetings: [
      {
        id: 'm1', number: 1,
        observations: [{
          id: 'o4', seq: 1, category: 'Réseaux', status: 'open',
          actionBy: 'CONCESSIONNAIRE', actionDeadline: iso(-1),
          text: '<div>Dévoiement <b>ENEDIS</b> à confirmer</div>',
        }],
      },
    ],
  },
  {
    id: 'ch3',
    ownerId: ME,
    archivedAt: new Date().toISOString(),
    crrConfig: { chantierInfo: { nom: 'Chantier terminé — exclu du plan' } },
    crrMeetings: [{ id: 'm1', number: 1, observations: [{ id: 'o5', actionDeadline: iso(2), status: 'open', text: 'Ne doit pas apparaitre' }] }],
  },
];

export default function Harness() {
  const [chantiers, setChantiers] = useState(CHANTIERS_INIT);
  const [isOpen, setIsOpen] = useState(true);
  const [log, setLog] = useState([]);
  // Simule CrcView : l'observation ciblee par un clic dans le plan
  const [focusObsId, setFocusObsId] = useState(null);

  // Dernier CR du chantier « ouvert » (ch1), rendu sous le plan pour verifier
  // le parcours complet : clic dans le plan → depliage + scroll + surbrillance.
  const meeting = chantiers[0].crrMeetings[1];
  const observationsByCategory = { Travaux: meeting.observations };

  const onChangeStatus = (row, status) => {
    setChantiers((prev) => prev.map((c) => {
      if (c.id !== row.chantierId) return c;
      const next = setObsStatusInLastMeeting(c, row.obsId, status);
      return next ? { ...c, crrMeetings: next } : c;
    }));
    setLog((l) => [`${row.number || row.obsId} → ${status}`, ...l]);
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <h1 className="text-lg font-bold mb-2">Banc d'essai — Plan d'actions CRC</h1>
      <button onClick={() => setIsOpen(true)} className="px-3 py-2 bg-gray-900 text-white rounded-xl text-sm">
        Ouvrir le plan d'actions
      </button>
      <pre data-testid="log" className="mt-4 text-xs bg-white p-3 rounded-xl border">{log.join('\n') || '(aucun changement)'}</pre>

      {/* Marge haute : force un scroll reel pour verifier le scrollIntoView */}
      <div className="h-[900px] flex items-center justify-center text-gray-300 text-sm">
        (espace — l'observation ciblée doit défiler jusqu'ici)
      </div>

      <CrrObservations
        meeting={meeting}
        categories={['Travaux']}
        categoryCodes={{ Travaux: 'TRX' }}
        observationsByCategory={observationsByCategory}
        addObservation={() => {}}
        updateObservation={(id, patch) => setLog((l) => [`update ${id} ${JSON.stringify(patch)}`, ...l])}
        deleteObservation={() => {}}
        removeObservationImage={() => {}}
        reorderObservations={() => {}}
        legalText=""
        participantGroups={[]}
        focusObsId={focusObsId}
        onFocusHandled={() => setFocusObsId(null)}
      />

      <CrcActionPlanModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        chantiers={chantiers}
        onOpenChantier={(row) => {
          setIsOpen(false);
          setFocusObsId(row.obsId);
          setLog((l) => [`aller à ${row.number} (${row.obsId})`, ...l]);
        }}
        onChangeStatus={onChangeStatus}
        currentUserId={ME}
      />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ToastProvider>
    <DialogProvider>
      <Harness />
    </DialogProvider>
  </ToastProvider>
);
