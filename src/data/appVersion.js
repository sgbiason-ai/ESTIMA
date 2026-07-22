// src/data/appVersion.js
// Version courante de l'application, isolée du changelog complet.
// Ce module minuscule est importé par le chemin critique (hub, feedback,
// UpdatePrompt…) : il ne doit JAMAIS importer changelog.js (~160 KB de texte),
// qui n'est nécessaire qu'à l'ouverture de la modale « Nouveautés ».

export const APP_VERSION = '3.11.2';
