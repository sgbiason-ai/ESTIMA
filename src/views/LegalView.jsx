// src/views/LegalView.jsx
import React, { useState } from 'react';
import { ArrowLeft, Scale, Shield, Cookie } from 'lucide-react';

const SECTIONS = [
  { id: 'mentions',       label: 'Mentions légales',             icon: Scale },
  { id: 'confidentialite', label: 'Politique de confidentialité', icon: Shield },
  { id: 'cookies',        label: 'Cookies',                      icon: Cookie },
];

export default function LegalView({ onBack }) {
  const [active, setActive] = useState('mentions');

  return (
    <div className="flex h-screen bg-[#040a0e] items-start justify-center relative overflow-auto font-sans text-slate-300">
      {/* Fond décoratif */}
      <div className="absolute top-0 right-0 w-2/3 h-2/3 bg-emerald-500/5 blur-[120px] pointer-events-none rounded-full" />
      <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-blue-600/5 blur-[100px] pointer-events-none rounded-full" />

      <div className="w-full max-w-3xl my-10 mx-4 relative z-10">
        {/* Bouton retour */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-500 hover:text-emerald-400 text-xs font-bold uppercase tracking-widest mb-6 transition-colors"
        >
          <ArrowLeft size={14} /> Retour à la connexion
        </button>

        {/* Titre */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-white uppercase tracking-wider">
            Informations légales
          </h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">
            EstimaVRD — Estimation VRD &amp; Études
          </p>
        </div>

        {/* Navigation onglets */}
        <div className="flex gap-2 mb-8 justify-center flex-wrap">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActive(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                active === id
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-slate-900/40 text-slate-500 border border-white/5 hover:text-slate-300 hover:border-white/10'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* Contenu */}
        <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          {active === 'mentions' && <MentionsLegales />}
          {active === 'confidentialite' && <PolitiqueConfidentialite />}
          {active === 'cookies' && <CookiesSection />}
        </div>

        {/* Pied de page */}
        <p className="text-center text-slate-600 text-[10px] mt-6">
          Dernière mise à jour : mars 2025
        </p>
      </div>
    </div>
  );
}

/* ─── Styles partagés ──────────────────────────────────────────────────────── */
const H2 = ({ children }) => (
  <h2 className="text-lg font-black text-white uppercase tracking-wider mb-4">{children}</h2>
);
const H3 = ({ children }) => (
  <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider mt-6 mb-2">{children}</h3>
);
const P = ({ children }) => (
  <p className="text-sm text-slate-400 leading-relaxed mb-3">{children}</p>
);
const Li = ({ children }) => (
  <li className="text-sm text-slate-400 leading-relaxed">{children}</li>
);

/* ─── Mentions légales ─────────────────────────────────────────────────────── */
function MentionsLegales() {
  return (
    <>
      <H2>Mentions légales</H2>

      <H3>Éditeur du site</H3>
      <P>
        <strong className="text-slate-200">[Nom de la société]</strong><br />
        Forme juridique : [SAS / SARL / etc.]<br />
        Capital social : [montant] €<br />
        Siège social : [adresse complète]<br />
        RCS : [ville] [numéro]<br />
        SIRET : [numéro SIRET]<br />
        N° TVA intracommunautaire : [numéro]<br />
        Directeur de la publication : [nom du responsable]<br />
        Email : <span className="text-emerald-400">[email@entreprise.com]</span><br />
        Téléphone : [numéro]
      </P>

      <H3>Hébergement</H3>
      <P>
        L'application EstimaVRD est hébergée par :<br />
        <strong className="text-slate-200">Google Cloud Platform (Firebase)</strong><br />
        Google Ireland Limited<br />
        Gordon House, Barrow Street, Dublin 4, Irlande<br />
        Les données sont stockées dans des centres de données situés dans l'Union européenne
        (région europe-west).
      </P>

      <H3>Propriété intellectuelle</H3>
      <P>
        L'ensemble du contenu de l'application EstimaVRD (textes, graphismes, logiciels,
        bases de données, structure) est la propriété exclusive de l'éditeur ou de ses
        partenaires et est protégé par les lois françaises et internationales relatives à la
        propriété intellectuelle. Toute reproduction, même partielle, est soumise à
        autorisation préalable.
      </P>

      <H3>Responsabilité</H3>
      <P>
        L'éditeur s'efforce de fournir des informations exactes et à jour. Toutefois, il ne
        saurait être tenu responsable des erreurs, omissions ou résultats obtenus suite à
        l'utilisation des estimations générées par l'application. Les chiffrages produits par
        EstimaVRD sont fournis à titre indicatif et ne constituent pas des devis engageants.
      </P>
    </>
  );
}

/* ─── Politique de confidentialité ─────────────────────────────────────────── */
function PolitiqueConfidentialite() {
  return (
    <>
      <H2>Politique de confidentialité</H2>
      <P>
        Conformément au Règlement Général sur la Protection des Données (RGPD — Règlement UE
        2016/679) et à la loi Informatique et Libertés du 6 janvier 1978 modifiée, nous vous
        informons des conditions dans lesquelles vos données personnelles sont collectées et
        traitées.
      </P>

      <H3>Responsable du traitement</H3>
      <P>
        Le responsable du traitement est <strong className="text-slate-200">[Nom de la société]</strong>,
        joignable à l'adresse : <span className="text-emerald-400">[email@entreprise.com]</span>.
      </P>

      <H3>Données collectées</H3>
      <P>Dans le cadre de l'utilisation d'EstimaVRD, nous collectons les données suivantes :</P>
      <ul className="list-disc list-inside space-y-1 mb-3 ml-2">
        <Li><strong className="text-slate-200">Données d'identification</strong> : adresse email (utilisée pour l'authentification)</Li>
        <Li><strong className="text-slate-200">Données professionnelles</strong> : données de projets (estimations, chiffrages, articles BPU, CCTP, etc.)</Li>
        <Li><strong className="text-slate-200">Données techniques</strong> : logs de connexion, adresse IP (collectés automatiquement par Firebase Authentication)</Li>
      </ul>

      <H3>Finalités du traitement</H3>
      <P>Vos données sont traitées pour les finalités suivantes :</P>
      <ul className="list-disc list-inside space-y-1 mb-3 ml-2">
        <Li>Gestion de l'authentification et de l'accès sécurisé à l'application</Li>
        <Li>Stockage et synchronisation de vos projets d'estimation VRD</Li>
        <Li>Fonctionnement technique de l'application (sauvegarde, restauration)</Li>
        <Li>Gestion des comptes utilisateurs au sein d'une même entreprise</Li>
      </ul>

      <H3>Base légale</H3>
      <P>
        Le traitement de vos données repose sur l'exécution du contrat (utilisation du service)
        et l'intérêt légitime de l'éditeur (sécurité et bon fonctionnement de l'application).
      </P>

      <H3>Durée de conservation</H3>
      <ul className="list-disc list-inside space-y-1 mb-3 ml-2">
        <Li><strong className="text-slate-200">Données de compte</strong> : conservées pendant toute la durée d'utilisation du service, puis supprimées dans un délai de 12 mois après la clôture du compte</Li>
        <Li><strong className="text-slate-200">Données de projets</strong> : conservées pendant toute la durée d'utilisation du service</Li>
        <Li><strong className="text-slate-200">Logs techniques</strong> : conservés 12 mois maximum conformément aux recommandations de la CNIL</Li>
      </ul>

      <H3>Destinataires des données</H3>
      <P>
        Vos données sont accessibles uniquement aux utilisateurs autorisés de votre entreprise
        et aux administrateurs de l'application. Elles sont hébergées par Google Cloud
        Platform (Firebase / Firestore) dans l'Union européenne. Aucune donnée n'est
        transmise à des tiers à des fins commerciales.
      </P>

      <H3>Transferts hors UE</H3>
      <P>
        Google LLC adhère au EU-US Data Privacy Framework. Les données sont principalement
        stockées dans l'UE (région europe-west). En cas de transfert vers les États-Unis,
        celui-ci est encadré par les clauses contractuelles types de la Commission européenne
        et le Data Privacy Framework.
      </P>

      <H3>Vos droits</H3>
      <P>
        Conformément au RGPD, vous disposez des droits suivants sur vos données personnelles :
      </P>
      <ul className="list-disc list-inside space-y-1 mb-3 ml-2">
        <Li><strong className="text-slate-200">Droit d'accès</strong> : obtenir la confirmation que vos données sont traitées et en recevoir une copie</Li>
        <Li><strong className="text-slate-200">Droit de rectification</strong> : demander la correction de données inexactes ou incomplètes</Li>
        <Li><strong className="text-slate-200">Droit à l'effacement</strong> : demander la suppression de vos données personnelles</Li>
        <Li><strong className="text-slate-200">Droit à la portabilité</strong> : recevoir vos données dans un format structuré et couramment utilisé</Li>
        <Li><strong className="text-slate-200">Droit à la limitation</strong> : demander la limitation du traitement dans certains cas</Li>
        <Li><strong className="text-slate-200">Droit d'opposition</strong> : vous opposer au traitement de vos données pour des motifs légitimes</Li>
      </ul>
      <P>
        Pour exercer ces droits, contactez-nous à :
        <span className="text-emerald-400"> [email@entreprise.com]</span>. Nous nous engageons
        à répondre dans un délai d'un mois.
      </P>

      <H3>Délégué à la protection des données (DPO)</H3>
      <P>
        Pour toute question relative à la protection de vos données, vous pouvez contacter
        notre référent RGPD :<br />
        <strong className="text-slate-200">[Nom du DPO / Référent]</strong><br />
        Email : <span className="text-emerald-400">[dpo@entreprise.com]</span>
      </P>

      <H3>Réclamation</H3>
      <P>
        Si vous estimez que le traitement de vos données ne respecte pas la réglementation,
        vous pouvez introduire une réclamation auprès de la CNIL :<br />
        Commission Nationale de l'Informatique et des Libertés<br />
        3, place de Fontenoy — TSA 80715 — 75334 Paris Cedex 07<br />
        <span className="text-emerald-400">www.cnil.fr</span>
      </P>
    </>
  );
}

/* ─── Cookies ──────────────────────────────────────────────────────────────── */
function CookiesSection() {
  return (
    <>
      <H2>Politique relative aux cookies</H2>

      <H3>Qu'est-ce qu'un cookie ?</H3>
      <P>
        Un cookie est un petit fichier texte déposé sur votre navigateur lors de la visite
        d'un site ou de l'utilisation d'une application web. Il permet de stocker des
        informations relatives à votre navigation.
      </P>

      <H3>Cookies utilisés par EstimaVRD</H3>
      <P>
        L'application EstimaVRD utilise <strong className="text-slate-200">uniquement des cookies
        techniques strictement nécessaires</strong> au fonctionnement du service. Aucun cookie
        publicitaire, analytique ou de traçage n'est utilisé.
      </P>
      <ul className="list-disc list-inside space-y-1 mb-3 ml-2">
        <Li>
          <strong className="text-slate-200">Cookie d'authentification Firebase</strong> :
          permet de maintenir votre session de connexion active. Ce cookie est indispensable
          au fonctionnement de l'application et ne nécessite pas votre consentement
          conformément à l'article 82 de la loi Informatique et Libertés.
        </Li>
        <Li>
          <strong className="text-slate-200">Stockage local (localStorage)</strong> :
          utilisé pour conserver certaines préférences d'interface (mode d'affichage, etc.)
          côté navigateur uniquement.
        </Li>
      </ul>

      <H3>Cookies tiers</H3>
      <P>
        Aucun cookie tiers (Google Analytics, Facebook Pixel, etc.) n'est déposé par
        l'application. Firebase Authentication utilise ses propres mécanismes de session qui
        sont considérés comme des cookies techniques essentiels.
      </P>

      <H3>Gestion des cookies</H3>
      <P>
        Étant donné que seuls des cookies techniques essentiels sont utilisés, aucun bandeau
        de consentement n'est requis. Vous pouvez néanmoins configurer votre navigateur pour
        bloquer les cookies, mais cela empêchera le fonctionnement de l'application.
      </P>
    </>
  );
}
