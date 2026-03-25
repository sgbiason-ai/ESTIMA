export const fmt = (n) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(n);

export const fmtShort = (n) => {
  if (n === 0) return '0 €';
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + ' M€';
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(0) + ' k€';
  return fmt(n);
};

export const dateFr = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
};
