// src/utils/docAdmin/moeDefaults.js
// Données par défaut du Maître d'Œuvre (PAPYRUS)
// et chemin vers l'image de signature/tampon

// ── Coordonnées pré-remplies ──
export const MOE_DEFAULTS = {
  nomCommercial: 'PAPYRUS',
  denominationSociale: 'SARL PAPYRUS',
  adresse: '21-23, route de la Pradine\nAnciennes Ecoles',
  codePostal: '81500',
  ville: 'BANNIERES',
  telephone: '05 63 34 10 78',
  telecopie: '',
  email: 'contact@papyrus-be.fr',
  siret: '503 721 375 00023',
};

// ── Chemin de l'image tampon/signature MOE ──
// Placer l'image dans public/signature-moe.png
// Elle sera chargée dynamiquement lors de la génération des documents
export const MOE_SIGNATURE_PATH = '/signature-moe.png';

/**
 * Charge l'image signature MOE et retourne un data URL base64
 * @returns {Promise<string|null>} data URL ou null si non disponible
 */
export const loadMoeSignature = async () => {
  try {
    const response = await fetch(MOE_SIGNATURE_PATH);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

/**
 * Charge l'image signature MOE et retourne les dimensions + données
 * @returns {Promise<{dataUrl: string, width: number, height: number}|null>}
 */
export const loadMoeSignatureWithDimensions = async () => {
  const dataUrl = await loadMoeSignature();
  if (!dataUrl) return null;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ dataUrl, width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
};
