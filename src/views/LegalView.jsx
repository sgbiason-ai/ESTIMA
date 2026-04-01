// src/views/LegalView.jsx
import React, { useState } from 'react';
import { ArrowLeft, Scale, Shield, Cookie, FileText, CreditCard } from 'lucide-react';

const SECTIONS = [
  { id: 'mentions',       label: 'Mentions légales',             icon: Scale },
  { id: 'confidentialite', label: 'Politique de confidentialité', icon: Shield },
  { id: 'cookies',        label: 'Cookies',                      icon: Cookie },
  { id: 'cgu',            label: "Conditions d'utilisation",     icon: FileText },
  { id: 'cgv',            label: 'Conditions de vente',          icon: CreditCard },
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
          {active === 'cgu' && <CGU />}
          {active === 'cgv' && <CGV />}
        </div>

        {/* Pied de page */}
        <p className="text-center text-slate-600 text-[10px] mt-6">
          Dernière mise à jour : avril 2026
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

/* ─── Conditions Générales d'Utilisation ──────────────────────────────────── */
function CGU() {
  return (
    <>
      <H2>Conditions Générales d'Utilisation</H2>
      <P>
        Les présentes Conditions Générales d'Utilisation (ci-après « CGU ») régissent l'accès
        et l'utilisation du service EstimaVRD, édité par <strong className="text-slate-200">[Nom
        de la société]</strong>. En accédant au service, l'utilisateur accepte sans réserve les
        présentes CGU.
      </P>

      <H3>1. Objet</H3>
      <P>
        EstimaVRD est un logiciel en mode SaaS (Software as a Service) destiné aux
        professionnels du secteur des Voiries et Réseaux Divers (VRD). Il permet la réalisation
        d'estimations, la gestion de Bordereaux de Prix Unitaires (BPU), la production de CCTP
        et la gestion des marchés publics VRD. Le service est exclusivement réservé à un usage
        professionnel (B2B).
      </P>

      <H3>2. Accès au service</H3>
      <P>
        L'accès à EstimaVRD est subordonné à la détention d'un compte utilisateur fourni par
        l'éditeur ou par l'administrateur de l'entreprise cliente. Les identifiants de connexion
        (adresse email et mot de passe) sont strictement personnels et confidentiels.
        L'utilisateur est responsable de la préservation de la confidentialité de ses
        identifiants et de toute activité réalisée sous son compte.
      </P>
      <P>
        En cas de suspicion d'utilisation non autorisée de son compte, l'utilisateur doit en
        informer immédiatement l'éditeur.
      </P>

      <H3>3. Obligations de l'utilisateur</H3>
      <P>L'utilisateur s'engage à :</P>
      <ul className="list-disc list-inside space-y-1 mb-3 ml-2">
        <Li>Utiliser le service conformément à sa destination professionnelle et aux présentes CGU</Li>
        <Li>Ne pas tenter de décompiler, désassembler, procéder à de l'ingénierie inverse (reverse engineering) ou extraire le code source du logiciel</Li>
        <Li>Ne pas partager ses identifiants de connexion avec des tiers</Li>
        <Li>Ne pas utiliser le service à des fins illicites, frauduleuses ou portant atteinte aux droits de tiers</Li>
        <Li>Ne pas surcharger volontairement l'infrastructure du service (requêtes massives, scripts automatisés non autorisés, etc.)</Li>
        <Li>Respecter les droits de propriété intellectuelle de l'éditeur et des tiers</Li>
      </ul>

      <H3>4. Propriété intellectuelle</H3>
      <P>
        Le logiciel EstimaVRD, incluant son code source, son architecture, ses interfaces,
        sa documentation, ses bases de données de référence et l'ensemble de ses composants,
        est et reste la propriété exclusive de l'éditeur. L'utilisateur bénéficie d'un droit
        d'utilisation non exclusif, non transférable et non cessible, limité à la durée de son
        abonnement.
      </P>
      <P>
        Aucune disposition des présentes CGU ne saurait être interprétée comme conférant à
        l'utilisateur un droit de propriété sur le logiciel ou ses composants.
      </P>

      <H3>5. Données de l'utilisateur</H3>
      <P>
        L'utilisateur reste le seul et unique propriétaire de l'ensemble des données qu'il
        saisit dans le service, notamment : ses projets d'estimation, ses bordereaux de prix
        unitaires (BPU) personnalisés, ses CCTP, ses documents et tous les contenus qu'il
        crée ou importe dans EstimaVRD.
      </P>
      <P>
        L'éditeur s'engage à ne pas utiliser les données de l'utilisateur à d'autres fins que
        la fourniture du service. L'éditeur met en place les mesures techniques et
        organisationnelles appropriées pour assurer la sécurité et la confidentialité de ces
        données.
      </P>

      <H3>6. Disponibilité du service</H3>
      <P>
        L'éditeur s'efforce d'assurer la disponibilité du service 24 heures sur 24, 7 jours
        sur 7, selon une obligation de moyens (best effort). Toutefois, l'éditeur ne garantit
        pas une disponibilité de 100 % et ne saurait être tenu responsable des interruptions
        de service liées à :
      </P>
      <ul className="list-disc list-inside space-y-1 mb-3 ml-2">
        <Li>Des opérations de maintenance planifiée (notifiées à l'avance lorsque possible)</Li>
        <Li>Des pannes ou dysfonctionnements de l'infrastructure d'hébergement (Google Cloud Platform / Firebase)</Li>
        <Li>Des cas de force majeure</Li>
        <Li>Des défaillances des réseaux de télécommunication</Li>
      </ul>

      <H3>7. Responsabilité</H3>
      <P>
        Les estimations, chiffrages et calculs produits par EstimaVRD sont fournis
        à <strong className="text-slate-200">titre indicatif uniquement</strong> et ne
        constituent en aucun cas des devis engageants ou des documents ayant valeur
        contractuelle. Il appartient à l'utilisateur de vérifier, valider et adapter les
        résultats produits par le logiciel avant toute utilisation dans le cadre d'un marché
        public ou de toute autre relation contractuelle.
      </P>
      <P>
        L'éditeur ne saurait être tenu responsable des conséquences directes ou indirectes
        résultant de l'utilisation des estimations générées par le service, notamment en cas
        d'erreur de chiffrage, de sous-estimation ou de surestimation.
      </P>

      <H3>8. Résiliation</H3>
      <P>
        Chaque partie peut résilier le contrat d'utilisation avec un préavis
        de <strong className="text-slate-200">30 jours</strong>, notifié par email à l'autre
        partie. En cas de manquement grave de l'utilisateur aux présentes CGU, l'éditeur se
        réserve le droit de suspendre ou résilier l'accès au service sans préavis.
      </P>
      <P>
        À la suite de la résiliation, l'utilisateur dispose d'un délai
        de <strong className="text-slate-200">30 jours</strong> pour exporter l'ensemble de ses
        données. Passé ce délai, l'éditeur procédera à la suppression définitive des données
        de l'utilisateur.
      </P>

      <H3>9. Modification des CGU</H3>
      <P>
        L'éditeur se réserve le droit de modifier les présentes CGU à tout moment. Les
        utilisateurs seront informés de toute modification
        substantielle <strong className="text-slate-200">30 jours avant</strong> son entrée en
        vigueur, par notification dans l'application ou par email. La poursuite de l'utilisation
        du service après l'entrée en vigueur des modifications vaut acceptation des nouvelles
        CGU.
      </P>

      <H3>10. Droit applicable et juridiction compétente</H3>
      <P>
        Les présentes CGU sont régies par le droit français. En cas de litige relatif à
        l'interprétation ou à l'exécution des présentes, les parties s'efforceront de trouver
        une solution amiable. À défaut, les tribunaux compétents de [ville du siège social]
        seront seuls compétents.
      </P>

      <P>
        <em className="text-slate-500">Date de dernière mise à jour : avril 2026</em>
      </P>
    </>
  );
}

/* ─── Conditions Générales de Vente ───────────────────────────────────────── */
function CGV() {
  return (
    <>
      <H2>Conditions Générales de Vente</H2>
      <P>
        Les présentes Conditions Générales de Vente (ci-après « CGV ») régissent les relations
        contractuelles entre <strong className="text-slate-200">[Nom de la société]</strong>,
        éditeur du service EstimaVRD (ci-après « le Prestataire »), et tout professionnel
        souscrivant un abonnement au service (ci-après « le Client »).
      </P>

      <H3>1. Objet</H3>
      <P>
        Les présentes CGV ont pour objet de définir les conditions dans lesquelles le
        Prestataire fournit au Client l'accès au service EstimaVRD en mode SaaS (Software as a
        Service). Le service comprend l'accès à la plateforme d'estimation VRD, la gestion de
        BPU, la génération de CCTP et les fonctionnalités associées, selon la formule
        d'abonnement souscrite.
      </P>

      <H3>2. Prix et facturation</H3>
      <P>
        Les prix du service sont indiqués en euros hors taxes (HT). La TVA applicable sera
        ajoutée au taux en vigueur au moment de la facturation.
      </P>
      <ul className="list-disc list-inside space-y-1 mb-3 ml-2">
        <Li><strong className="text-slate-200">Abonnement mensuel</strong> : facturation au début de chaque mois d'utilisation</Li>
        <Li><strong className="text-slate-200">Abonnement annuel</strong> : facturation en une seule fois au début de la période annuelle, avec un tarif préférentiel</Li>
      </ul>
      <P>
        Le Prestataire se réserve le droit de modifier ses tarifs. Toute modification tarifaire
        sera notifiée au Client au moins <strong className="text-slate-200">30 jours</strong> avant
        son entrée en vigueur et sera applicable au prochain renouvellement de l'abonnement.
      </P>

      <H3>3. Modalités de paiement</H3>
      <P>
        Le paiement est exigible à réception de la facture, sauf accord particulier entre les
        parties. Les factures sont transmises par voie électronique.
      </P>
      <P>
        En cas de retard de paiement, des pénalités de retard seront automatiquement et de plein
        droit appliquées, au taux d'intérêt légal en vigueur majoré de 3 points, sans qu'un
        rappel soit nécessaire. Conformément à l'article L.441-10 du Code de commerce, une
        indemnité forfaitaire de <strong className="text-slate-200">40 euros</strong> pour frais de
        recouvrement sera due en cas de retard de paiement.
      </P>

      <H3>4. Durée et renouvellement</H3>
      <P>
        L'abonnement est souscrit pour une durée initiale correspondant à la formule choisie
        (mensuelle ou annuelle). À l'issue de cette période, l'abonnement est renouvelé
        tacitement pour une durée identique, sauf dénonciation par l'une des parties dans le
        respect du préavis prévu à l'article 5.
      </P>

      <H3>5. Résiliation anticipée</H3>
      <P>
        Chaque partie peut résilier l'abonnement en cours en respectant un préavis
        de <strong className="text-slate-200">30 jours</strong> avant la fin de la période en
        cours, par notification écrite (email avec accusé de réception).
      </P>
      <ul className="list-disc list-inside space-y-1 mb-3 ml-2">
        <Li><strong className="text-slate-200">Abonnement mensuel</strong> : la résiliation prend effet à la fin du mois en cours. Aucun remboursement du mois entamé.</Li>
        <Li><strong className="text-slate-200">Abonnement annuel</strong> : en cas de résiliation anticipée par le Client, aucun remboursement ne sera effectué pour la période restante, sauf en cas de manquement avéré du Prestataire à ses obligations. En cas de résiliation anticipée par le Prestataire, un remboursement au prorata de la période restante sera effectué.</Li>
      </ul>
      <P>
        En cas de manquement grave par l'une des parties à ses obligations contractuelles, et
        après mise en demeure restée infructueuse pendant 15 jours, l'autre partie pourra
        résilier le contrat de plein droit.
      </P>

      <H3>6. Garantie</H3>
      <P>
        Le Prestataire garantit que le service EstimaVRD est conforme aux spécifications
        décrites dans la documentation applicable. Le Prestataire s'engage à corriger dans un
        délai raisonnable tout dysfonctionnement reproductible signalé par le Client.
      </P>
      <P>
        Toutefois, le Prestataire <strong className="text-slate-200">ne garantit aucun résultat</strong> quant
        aux estimations et chiffrages produits par le logiciel. Les résultats sont fournis à
        titre indicatif et l'utilisateur est seul responsable de leur validation et de leur
        utilisation dans le cadre de ses activités professionnelles.
      </P>

      <H3>7. Limitation de responsabilité</H3>
      <P>
        La responsabilité du Prestataire, toutes causes confondues, est
        expressément <strong className="text-slate-200">plafonnée au montant total des sommes
        effectivement versées par le Client au titre de l'abonnement au cours des 12 derniers
        mois</strong> précédant le fait générateur de responsabilité.
      </P>
      <P>
        En aucun cas le Prestataire ne pourra être tenu responsable des dommages indirects,
        incluant notamment : perte de chiffre d'affaires, perte de marchés, perte de données
        (sous réserve des obligations de sauvegarde du Prestataire), atteinte à l'image de
        marque ou préjudice commercial de toute nature.
      </P>

      <H3>8. Force majeure</H3>
      <P>
        Aucune des parties ne sera tenue responsable de l'inexécution de ses obligations
        contractuelles si cette inexécution résulte d'un cas de force majeure au sens de
        l'article 1218 du Code civil. Sont notamment considérés comme des cas de force majeure :
        les catastrophes naturelles, les pandémies, les actes de guerre ou de terrorisme, les
        grèves générales, les pannes généralisées des réseaux de télécommunication ou
        d'électricité, les décisions gouvernementales ou réglementaires empêchant l'exécution du
        contrat.
      </P>
      <P>
        En cas de force majeure d'une durée supérieure à 60 jours, chaque partie pourra résilier
        le contrat sans indemnité, moyennant notification écrite à l'autre partie.
      </P>

      <H3>9. Droit applicable et juridiction compétente</H3>
      <P>
        Les présentes CGV sont soumises au droit français. En cas de litige relatif à la
        formation, l'interprétation ou l'exécution des présentes, et à défaut de résolution
        amiable dans un délai de 30 jours, les tribunaux compétents de [ville du siège social]
        seront seuls compétents, y compris en cas de référé, de pluralité de défendeurs ou
        d'appel en garantie.
      </P>

      <P>
        <em className="text-slate-500">Date de dernière mise à jour : avril 2026</em>
      </P>
    </>
  );
}
