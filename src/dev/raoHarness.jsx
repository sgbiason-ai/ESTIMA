// src/dev/raoHarness.jsx — Banc d'essai RAO sans authentification.
// Monte RaoView avec un projet factice (aucun id → pas de Firestore) pour
// vérifier le workflow 10 étapes hors login. Servi par /rao-harness.html en dev
// uniquement — jamais référencé par l'app (exclu du build via rollup input unique).
import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import RaoView from '../views/RaoView.jsx';
import { ToastProvider } from '../contexts/ToastContext';
import { DialogProvider } from '../contexts/DialogContext';
import '../index.css';

const COMPANIES = [
  { id: 'c1', name: 'ALPHA TP', aeAmount: 100000, computedTotal: 100000, offers: { i1: 10 }, variants: [] },
  { id: 'c2', name: 'BETA VRD', aeAmount: 120000, computedTotal: 120000, offers: { i1: 12 }, variants: [] },
];

const STATS_INITIAL = {
  companiesTotals: { c1: 100000, c2: 120000 },
  companyScores: { c1: 40, c2: 33.33 },
  companyEcarts: { c1: { abs: -10000, pct: -9.1 }, c2: { abs: 10000, pct: 9.1 } },
  totalEstimation: 110000,
  Pmin: 100000, Pmax: 120000, Pmoy: 110000,
};

const PROJECT_INIT = {
  name: 'Banc d\'essai — Aménagement VRD',
  client: 'Commune de Test',
  dateRemise: '2026-07-30',
  timeRemise: '12:00',
  chapters: [],
  rao: {
    consultation: {
      procedure: 'Procédure adaptée ouverte',
      lot: 'Lot 1 — VRD',
      variantsAllowed: 'forbidden',
      dateOuverturePLis: '2026-07-01',
    },
    companies: {
      'ALPHA TP': {
        admin: { conclusion: 'reguliere', pieces: {} },
        technical: {
          c2: { note: 4, noteMax: 5, text: '<p>Phasage clair et planning détaillé.</p>' },
          c3: { note: 3, noteMax: 5, text: '<p>Moyens humains corrects.</p>' },
        },
      },
      'BETA VRD': {
        admin: { conclusion: 'irreguliere', pieces: {} },
        technical: {
          c2: { note: 3, noteMax: 5, text: '<p>Méthodologie succincte.</p>' },
          c3: { note: 4, noteMax: 5, text: '<p>Parc matériel complet.</p>' },
        },
      },
    },
  },
};

function Harness() {
  const [project, setProject] = useState(PROJECT_INIT);
  const scoringConfig = { maxScore: 40, mode: 'f1', basis: 'initial' };
  return (
    <div style={{ height: '100vh' }}>
      <RaoView
        project={project}
        setProject={setProject}
        companyId={null}
        analysisCompanies={COMPANIES}
        analysisLoaded={true}
        analysisStats={STATS_INITIAL}
        analysisStatsInitial={STATS_INITIAL}
        analysisStatsNego={null}
        negoActive={false}
        hasNegoOffers={false}
        scoringConfig={scoringConfig}
        handleSaveProject={async () => {}}
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
