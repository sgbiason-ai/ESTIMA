// src/data/rcTemplate.js
//
// Modèle de référence du Règlement de la Consultation (RC).
// Structure calquée sur un RC réel de marché public de travaux (MAPA, procédure
// adaptée ouverte — art. R.2123-1 du code de la commande publique).
//
// Le contenu est en HTML et pilotable par les variables {{...}} dérivées de la
// fiche projet (voir useRcManager.js → variables) :
//   {{name}} {{location}} {{department}} {{lotName}} {{trancheCount}} {{trancheNames}}
//   {{duration}} {{prepPeriod}} {{startDate}} {{validityDays}}
//   {{moe}} {{moeAddress}} {{spsLevel}} {{platformUrl}}
//   {{dateRemise}} {{timeRemise}} {{criteresTable}} (critères du module RAO)
//
// Chaque nœud : { id, title, level, content, children }
// La numérotation (1, 1.1, 1.1.1…) est générée automatiquement par la position.

export const RC_TEMPLATE = [
  {
    id: 'rc_1', level: 1, title: 'OBJET ET ÉTENDUE DE LA CONSULTATION',
    content: '',
    children: [
      {
        id: 'rc_1_1', level: 2, title: 'Objet de la consultation',
        content:
          '<p>Les stipulations du présent marché concernent {{name}} sur la commune de {{location}} dans le département {{department}}.</p>' +
          '<p>La description des travaux, leurs spécifications techniques et leurs conditions d’exécution, sont indiquées dans le cahier des clauses techniques particulières (CCTP).</p>',
        children: [],
      },
      {
        id: 'rc_1_2', level: 2, title: 'Étendue de la consultation',
        content:
          '<p>La présente procédure adaptée ouverte est soumise aux dispositions de l’article R.2123-1 du code de la commande publique.</p>',
        children: [],
      },
      {
        id: 'rc_1_3', level: 2, title: 'Décomposition de la consultation',
        content:
          '<p>La présente consultation comprend un lot unique :</p>' +
          '<p><strong>{{lotName}}</strong></p>' +
          '<p>Le marché est décomposé en {{trancheCount}} tranche(s) successive(s) :</p>' +
          '{{trancheNames}}',
        children: [],
      },
      {
        id: 'rc_1_4', level: 2, title: 'Conditions de participation des concurrents',
        content:
          '<p>L’offre, qu’elle soit présentée par une seule entreprise ou par un groupement, devra indiquer tous les sous-traitants connus lors de son dépôt. Elle devra également indiquer les prestations (et leur montant) dont la sous-traitance est envisagée, la dénomination et la qualité des sous-traitants qui l’exécuteront à la place du titulaire.</p>' +
          '<p>Le pouvoir adjudicateur ne souhaite imposer aucune forme de groupement à l’attributaire du marché.</p>' +
          '<p>Si le groupement est conjoint, le mandataire du groupement est solidaire de chacun des membres du groupement pour ses obligations contractuelles à l’égard de l’acheteur.</p>' +
          '<p>Il est interdit aux candidats de présenter plusieurs offres en agissant à la fois :</p>' +
          '<ul><li>En qualité de candidats individuels et de membres d’un ou plusieurs groupements ;</li>' +
          '<li>En qualité de membres de plusieurs groupements.</li></ul>',
        children: [],
      },
    ],
  },

  {
    id: 'rc_2', level: 1, title: 'CONDITIONS DE LA CONSULTATION',
    content: '',
    children: [
      {
        id: 'rc_2_1', level: 2, title: 'Durée – délais d’exécution',
        content:
          '<p>Les délais d’exécution des travaux sont fixés à l’acte d’engagement et ne peuvent en aucun cas être modifiés.</p>' +
          '<p>À titre indicatif, les travaux débuteront à compter de {{startDate}} pour une durée de {{duration}} de travaux auxquels se rajoute une période de préparation de chantier fixée à {{prepPeriod}}.</p>',
        children: [],
      },
      {
        id: 'rc_2_2', level: 2, title: 'Variantes',
        content: '',
        children: [
          {
            id: 'rc_2_2_1', level: 3, title: 'Variantes à l’initiative des candidats',
            content: '<p>Aucune variante à l’initiative des candidats n’est autorisée.</p>',
            children: [],
          },
          {
            id: 'rc_2_2_2', level: 3, title: 'Variantes à l’initiative de la collectivité',
            content: '<p>Aucune variante imposée par la collectivité n’est prévue.</p>',
            children: [],
          },
        ],
      },
      {
        id: 'rc_2_3', level: 2, title: 'Délai de validité des offres',
        content:
          '<p>Le délai de validité des offres est fixé à {{validityDays}} jours à compter de la date limite de réception des offres.</p>',
        children: [],
      },
    ],
  },

  {
    id: 'rc_3', level: 1, title: 'Les intervenants',
    content: '',
    children: [
      {
        id: 'rc_3_1', level: 2, title: 'Maîtrise d’œuvre',
        content:
          '<p>La maîtrise d’œuvre est assurée par :</p>' +
          '<p><strong>{{moe}}</strong><br/>{{moeAddress}}</p>',
        children: [],
      },
      {
        id: 'rc_3_2', level: 2, title: 'Sécurité et protection de la santé des travailleurs',
        content:
          '<p>Les prestations, objet de la présente consultation, relèvent du niveau {{spsLevel}} de coordination en matière de sécurité et de protection de la santé.</p>' +
          '<p>Le coordonnateur S.P.S. est : désignation en cours.</p>',
        children: [],
      },
      {
        id: 'rc_3_3', level: 2, title: 'Plan Particulier de Sécurité et de Protection de la Santé',
        content:
          '<p>Les entreprises seront tenues de remettre au coordonnateur S.P.S. un Plan Particulier de Sécurité et de Protection de la Santé simplifié.</p>',
        children: [],
      },
    ],
  },

  {
    id: 'rc_4', level: 1, title: 'Contenu du dossier de consultation',
    content:
      '<p>Le dossier de consultation contient les pièces suivantes :</p>' +
      '<ul><li>Le règlement de la consultation (R.C.)</li>' +
      '<li>L’acte d’engagement (A.E.)</li>' +
      '<li>Le cahier des clauses administratives particulières (C.C.A.P.)</li>' +
      '<li>Le cahier des clauses techniques particulières (C.C.T.P.)</li>' +
      '<li>Les bordereaux de prix (B.P.U.)</li>' +
      '<li>Le détail estimatif (D.Q.E.)</li>' +
      '<li>Les plans</li></ul>' +
      '<p>Aucun dossier de consultation des entreprises en version papier ne sera fourni. Le dossier de consultation des entreprises est disponible immédiatement et gratuitement à l’adresse électronique suivante :</p>' +
      '<p><strong>{{platformUrl}}</strong></p>' +
      '<p>Aucune demande d’envoi du dossier sur support physique électronique n’est autorisée. La collectivité ne saurait être engagée par des documents non téléchargés sur le portail de la collectivité.</p>' +
      '<p>Les candidats sont invités, pour télécharger le DCE, à s’identifier sur la plateforme. En cas de téléchargement anonyme, ils ne seront pas informés des éventuelles modifications de la consultation (dates, rectificatifs ou compléments de dossiers…).</p>' +
      '<p>Le pouvoir adjudicateur se réserve le droit d’apporter des modifications de détail au dossier de consultation. Ces modifications devront être reçues par les candidats au plus tard 6 jours avant la date limite de réception des offres.</p>',
    children: [
      {
        id: 'rc_4_1', level: 2, title: 'Renseignements complémentaires diffusés à la suite d’une question d’un candidat',
        content:
          '<p>Les candidats peuvent poser des questions à l’acheteur, au plus tard 10 jours calendaires avant la date limite fixée pour la réception des offres, de manière électronique, exclusivement via la plate-forme de dématérialisation.</p>',
        children: [],
      },
      {
        id: 'rc_4_2', level: 2, title: 'Renseignements complémentaires diffusés spontanément par l’acheteur',
        content:
          '<p>Des renseignements complémentaires peuvent être diffusés par l’acheteur via la plate-forme de dématérialisation à la suite d’une modification de détail ou d’une précision apportée au DCE. Les candidats doivent répondre à la consultation sur la base du dossier modifié sans pouvoir émettre aucune réclamation à ce sujet.</p>',
        children: [],
      },
    ],
  },

  {
    id: 'rc_5', level: 1, title: 'Présentation des candidatures et des offres',
    content:
      '<p>Les offres des concurrents seront entièrement rédigées en langue française et exprimées en EURO.</p>' +
      '<p>Si les offres des concurrents sont rédigées dans une autre langue, elles doivent être accompagnées d’une traduction en français ; cette traduction doit concerner l’ensemble des documents remis dans l’offre.</p>',
    children: [
      {
        id: 'rc_5_1', level: 2, title: 'Documents à produire',
        content: '<p>Le candidat doit remettre les documents suivants :</p>',
        children: [
          {
            id: 'rc_5_1_1', level: 3, title: 'Dossier de candidature',
            content:
              '<ul>' +
              '<li>La lettre de candidature (imprimé DC1) ou document équivalent permettant d’identifier le candidat ou chaque membre du groupement.</li>' +
              '<li>Une déclaration sur l’honneur attestant que l’opérateur n’entre dans aucun des cas d’interdiction de soumissionner prévus aux articles L.2141-1 et suivants du Code de la commande publique.</li>' +
              '<li>Une déclaration attestant qu’il est en règle au regard de l’article L.5212-1 du code du travail (emploi des travailleurs handicapés) lorsqu’il y est assujetti.</li>' +
              '<li>Lorsque le candidat est en redressement judiciaire, la copie du ou des jugements prononcés.</li>' +
              '<li>Une déclaration indiquant les effectifs moyens annuels et l’importance du personnel d’encadrement pour chacune des 3 dernières années.</li>' +
              '<li>Une déclaration indiquant le matériel et l’équipement technique dont le candidat dispose.</li>' +
              '<li>La liste des travaux similaires exécutés au cours des cinq dernières années, appuyée d’attestations de bonne exécution.</li>' +
              '</ul>',
            children: [],
          },
          {
            id: 'rc_5_1_2', level: 3, title: 'Offre comprenant',
            content:
              '<ul>' +
              '<li>L’acte d’engagement (ATTRI 1) complété.</li>' +
              '<li>Le cas échéant, les annexes relatives à la sous-traitance déclarée (formulaire DC4) et les déclarations sur l’honneur des sous-traitants.</li>' +
              '<li>Le cas échéant, l’annexe relative à la répartition technique et financière (groupement conjoint).</li>' +
              '<li>Le bordereau de prix unitaire (BPU) complété.</li>' +
              '<li>Le détail estimatif (DQE) complété. Le candidat doit impérativement utiliser le fichier au format <strong>.XLSX</strong> fourni dans le DCE. Toute modification de la structure du fichier (ajout/suppression de lignes ou colonnes, altération des formules) est prohibée. Le document doit être remis simultanément en format natif (.XLSX) et en format PDF signé ; en cas de divergence, le PDF signé prévaut.</li>' +
              '<li>Le mémoire technique adapté au projet, précisant le déroulement des tâches et accompagné d’un planning détaillé à la semaine.</li>' +
              '</ul>',
            children: [],
          },
        ],
      },
    ],
  },

  {
    id: 'rc_6', level: 1, title: 'Sélection des candidatures et jugement des offres',
    content:
      '<p>La sélection des candidatures et le jugement des offres seront effectués dans le respect des principes fondamentaux de la commande publique.</p>',
    children: [
      {
        id: 'rc_6_1', level: 2, title: 'Critères d’attribution du marché',
        content:
          '<p>Les critères retenus pour le jugement des offres sont pondérés de la manière suivante :</p>' +
          '{{criteresTable}}',
        children: [],
      },
      {
        id: 'rc_6_2', level: 2, title: 'Modalités de notation des offres',
        content: '',
        children: [
          {
            id: 'rc_6_2_1', level: 3, title: 'Notation du critère prix',
            content:
              '<p>Le critère prix sera évalué en considérant la formule suivante :</p>' +
              '<p><strong>Note prix = C × [1 − ((P − P mini) / P mini)]</strong></p>' +
              '<ul>' +
              '<li><strong>C</strong> étant le pourcentage affecté au critère prix ;</li>' +
              '<li><strong>P</strong> étant le prix de l’offre analysée ;</li>' +
              '<li><strong>P mini</strong> étant le prix de l’offre la plus basse (hors offre irrégulière, inappropriée ou inacceptable et hors offre anormalement basse).</li>' +
              '</ul>' +
              '<p>La note minimale attribuée est 0. En cas d’erreurs purement matérielles, le candidat sera invité à confirmer l’offre rectifiée conformément à l’article R.2152-2 du Code de la commande publique ; en cas de refus, son offre sera éliminée.</p>',
            children: [],
          },
          {
            id: 'rc_6_2_2', level: 3, title: 'Notation des critères autres que le prix',
            content:
              '<p>Pour chaque critère, ou le cas échéant chaque sous-critère, l’offre se voit attribuer une note sur une échelle de 0 à 5, à laquelle est appliqué le coefficient de pondération prévu. Les notes se répartissent selon les tranches d’évaluation suivantes :</p>' +
              '<table><thead><tr><th>Appréciation</th><th>Note</th><th>Définition</th></tr></thead><tbody>' +
              '<tr><td>Absence</td><td>0</td><td>Absence des éléments d’appréciation en rapport avec le critère ou sous-critère.</td></tr>' +
              '<tr><td>Offre très insuffisante</td><td>1</td><td>Offre présentant des lacunes techniques, des non-qualités, des incohérences ou une mauvaise compréhension du besoin.</td></tr>' +
              '<tr><td>Offre insuffisante</td><td>2</td><td>Offre présentant des imprécisions et/ou des généralités.</td></tr>' +
              '<tr><td>Offre moyenne</td><td>3</td><td>Offre acceptable dans son ensemble avec une ou plusieurs réserves, ou répondant partiellement aux attentes.</td></tr>' +
              '<tr><td>Offre satisfaisante</td><td>4</td><td>Offre complète, détaillée, claire et adaptée, ou offre avec réserve(s) mineure(s) sans incidence sur la qualité.</td></tr>' +
              '<tr><td>Offre très satisfaisante</td><td>5</td><td>Offre précise, très détaillée, présentant une très bonne analyse du besoin et parfaitement adaptée aux exigences du cahier des charges.</td></tr>' +
              '</tbody></table>',
            children: [],
          },
        ],
      },
    ],
  },

  {
    id: 'rc_7', level: 1, title: 'Négociations',
    content:
      '<p>Conformément à l’article R.2123-5 du Code de la commande publique, l’acheteur se réserve le droit d’attribuer le marché sur la base des offres initiales sans négociation.</p>' +
      '<p>Les négociations pourront être engagées avec tous les candidats ayant remis une offre régulière, irrégulière ou inacceptable, sur les aspects techniques et financiers, dans le respect du principe d’égalité de traitement des candidats.</p>' +
      '<p>Le ou les candidats retenus devront produire les certificats et attestations demandés conformément aux articles R.2143-6 à R.2143-10 du Code de la commande publique, dans un délai qui ne pourra être supérieur à 10 jours. Une attestation d’assurance décennale devra également être produite dans le même délai.</p>',
    children: [],
  },

  {
    id: 'rc_8', level: 1, title: 'Conditions d’envoi ou de remise des plis',
    content: '',
    children: [
      {
        id: 'rc_8_1', level: 2, title: 'Date limite de réception des offres',
        content:
          '<p>Les offres devront être remises au plus tard le ' +
          '<span style="background-color:#fff2a8"><strong>{{dateRemise}} à {{timeRemise}}</strong></span>.</p>',
        children: [],
      },
      {
        id: 'rc_8_2', level: 2, title: 'Transmission sous support papier',
        content: '<p>Aucune transmission par voie papier n’est autorisée pour cette consultation.</p>',
        children: [],
      },
      {
        id: 'rc_8_3', level: 2, title: 'Transmission électronique',
        content:
          '<p>Les candidats doivent transmettre, par voie électronique, leurs plis à l’adresse suivante :</p>' +
          '<p><strong>{{platformUrl}}</strong></p>' +
          '<p>Les pièces de la candidature et de l’offre doivent être individualisées sans regroupement dans un fichier PDF unique. Tout document contenant un virus informatique sera réputé n’avoir jamais été reçu ; il est conseillé aux candidats de soumettre leurs documents à un anti-virus avant envoi.</p>',
        children: [],
      },
      {
        id: 'rc_8_4', level: 2, title: 'Signature du ou des marchés',
        content:
          '<p>Le candidat retenu sera invité à signer le marché électroniquement après l’attribution. Ses éventuels cotraitants seront invités à signer l’habilitation du mandataire, et les sous-traitants présentés dans l’offre à signer la déclaration de sous-traitance (DC4).</p>' +
          '<p>Il sera en outre demandé au candidat retenu de fournir les attestations d’assurances, la liste des travailleurs étrangers, l’attestation AGEFIPH et l’attestation congés payés du BTP.</p>',
        children: [],
      },
      {
        id: 'rc_8_5', level: 2, title: 'Signature électronique',
        content:
          '<p>Pour signer une offre électronique ou un marché, la personne habilitée à engager le soumissionnaire doit être titulaire d’un certificat électronique conforme au niveau de sécurité ** du R.G.S. (en cours de validité) ou d’un certificat qualifié, conforme au règlement e-IDAS du 23 juillet 2014.</p>' +
          '<p>Les frais d’accès au réseau et de recours à la signature électronique sont à la charge de chaque candidat.</p>',
        children: [],
      },
    ],
  },

  {
    id: 'rc_9', level: 1, title: 'Renseignements complémentaires',
    content: '',
    children: [
      {
        id: 'rc_9_1', level: 2, title: 'Demande de renseignements',
        content:
          '<p>Pour obtenir tous les renseignements complémentaires qui leur seraient nécessaires au cours de leur étude, les candidats devront faire parvenir une demande écrite au plus tard 10 jours avant la date limite de réception des offres, par l’intermédiaire du profil d’acheteur, à l’adresse suivante :</p>' +
          '<p><strong>{{platformUrl}}</strong></p>' +
          '<p>Une réponse sera adressée à toutes les entreprises ayant retiré ou téléchargé le dossier après identification, 6 jours au plus tard avant la date limite de réception des offres.</p>',
        children: [],
      },
      {
        id: 'rc_9_2', level: 2, title: 'Visites sur sites et/ou consultations sur place',
        content: '<p>La visite du site est recommandée mais non obligatoire.</p>',
        children: [],
      },
    ],
  },
];

export default RC_TEMPLATE;
