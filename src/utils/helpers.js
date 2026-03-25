// src/utils/helpers.js

export const generateId = () => Math.random().toString(36).substr(2, 9) + Date.now().toString(36);

export const formatPrice = (amount) => {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount || 0);
};

// Modifié pour accepter un champ dynamique
export const calculateTotal = (node, qtyField = 'qty') => {
  if (!node) return 0;
  if (node.type === 'item') {
    // On récupère la valeur, si elle n'existe pas on prend 0
    const q = parseFloat(node[qtyField] !== undefined ? node[qtyField] : (node.qty || 0));
    const p = parseFloat(node.price || 0);
    return q * p;
  }
  const children = node.children || node.chapters || [];
  return children.reduce((sum, child) => sum + calculateTotal(child, qtyField), 0);
};

export const cleanText = (html) => {
  if (!html) return "";
  const temp = document.createElement("div");
  temp.innerHTML = html;
  return temp.textContent || temp.innerText || "";
};

export const getUniqueBpuCatalog = (project) => {
  const items = [];
  if (!project || !project.chapters) return [];
  const collect = (list) => {
    list.forEach(el => {
      if (el.type === 'item') items.push(el);
      if (el.children) collect(el.children);
    });
  };
  collect(project.chapters || []);
  return Array.from(new Map(items.map(i => [i.designation, i])).values());
};

export const getItemRefMap = (project) => {
  const refMap = new Map();
  if (!project || !project.chapters) return refMap;
  let counter = 1;
  const traverse = (items) => {
    if (!items) return; 
    items.forEach(item => {
      if (item.type === 'item') {
        const key = (item.designation || "").trim().toUpperCase();
        if (!refMap.has(key)) {
          const ref = `P.${String(counter).padStart(2, '0')}`;
          refMap.set(key, ref);
          counter++;
        }
      }
      if (item.children && item.children.length > 0) traverse(item.children);
    });
  };
  project.chapters.forEach(chapter => {
    if (chapter.children) traverse(chapter.children);
  });
  return refMap;
};

// --- NORMALISATION DES UNITÉS (MAJUSCULE + exposants → chiffres) ---
export const normalizeUnitSymbol = (unit) => {
  if (!unit) return '';
  return unit.toString().toUpperCase()
    .replace(/²/g, '2').replace(/³/g, '3')
    .replace(/\u00B2/g, '2').replace(/\u00B3/g, '3');
};

// --- CELLE-CI EST CRUCIALE POUR LE CALCUL ---
export const isFixedItem = (item) => {
    if (!item || !item.unit) return false;
    const u = item.unit.trim().toLowerCase();
    const q = item.qty || 0;

    // 1. Unités forfaitaires (Toujours bloquées)
    if (['ens', 'ft', 'f', 'forfait', 'un', 'global'].includes(u)) return true;

    // 2. Petites unités comptables (Bloquées si < 10)
    if (['u', 'pce', 'p', 'un'].includes(u) && q < 10) return true;

    return false;
};