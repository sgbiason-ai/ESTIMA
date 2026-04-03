import mammoth from "mammoth";

let __idCounter = 0;

const generateId = () => {
  // ID unique et stable dans la session (évite les collisions Date.now + random)
  __idCounter = (__idCounter + 1) % Number.MAX_SAFE_INTEGER;
  return `imported_${Date.now()}_${__idCounter}`;
};

// --- UTIL: nettoyage titres (retire numérotation) ---
const cleanTitle = (text) => (text || "").replace(/^[0-9IVX.\-\s]+/, "").trim();

// --- UTIL: retire commentaires HTML Mammoth/Word ---
const stripHtmlComments = (html) =>
  (html || "").replace(/<!--[\s\S]*?-->/g, "");

// --- UTIL: sanitise HTML dangereux (scripts, event handlers, iframes) ---
const sanitizeHtml = (html) => {
  if (!html) return "";
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[\s\S]*?>/gi, "")
    .replace(/<link[\s\S]*?>/gi, "")
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]*/gi, "")
    .replace(/javascript\s*:/gi, "");
};

const MAX_CONTENT_LENGTH = 50000; // 50 Ko par section

// --- UTIL: normalisation "spéciale tableaux" ---
const normalizeTablesHtml = (html) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html || "", "text/html");

  // Ajoute une classe et nettoie un peu le contenu des cellules
  doc.querySelectorAll("table").forEach((table) => {
    table.classList.add("imported-table");

    const firstRow = table.querySelector("tr");
    if (firstRow) {
      const cells = Array.from(firstRow.children).filter((n) =>
        ["TD", "TH"].includes(n.tagName)
      );

      const score = cells.reduce((acc, c) => {
        const hasStrong = !!c.querySelector("strong, b");
        const txt = (c.textContent || "").trim();
        const isShort = txt.length > 0 && txt.length <= 40;
        return acc + (hasStrong || isShort ? 1 : 0);
      }, 0);

      const looksLikeHeader = cells.length > 0 && score / cells.length >= 0.7;

      if (looksLikeHeader) {
        cells.forEach((cell) => {
          if (cell.tagName === "TD") {
            const th = doc.createElement("th");
            for (const attr of Array.from(cell.attributes)) {
              th.setAttribute(attr.name, attr.value);
            }
            th.innerHTML = cell.innerHTML;
            cell.replaceWith(th);
          }
        });
      }
    }

    table.querySelectorAll("td, th").forEach((cell) => {
      const inner = cell.innerHTML || "";
      cell.innerHTML = inner
        .replace(/<o:p>[\s\S]*?<\/o:p>/gi, "")
        .replace(/&nbsp;/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim();
    });
  });

  return doc.body.innerHTML;
};

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 Mo max

export const parseDocxToTree = async (file) => {
  // Validation fichier
  const ext = (file.name || '').split('.').pop().toLowerCase();
  if (ext !== 'docx') {
    throw new Error('Format non supporté. Utilisez un fichier .docx.');
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`Fichier trop volumineux (${Math.round(file.size / 1024 / 1024)} Mo). Maximum : 20 Mo.`);
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const arrayBuffer = event.target.result;

        const options = {
          styleMap: [
            "p[style-name='Heading 1'] => h1:fresh",
            "p[style-name='Heading 2'] => h2:fresh",
            "p[style-name='Heading 3'] => h3:fresh",
            "p[style-name='Heading 4'] => h4:fresh",
            "p[style-name='Heading 5'] => h5:fresh",
            "p[style-name='Titre 1'] => h1:fresh",
            "p[style-name='Titre 2'] => h2:fresh",
            "p[style-name='Titre 3'] => h3:fresh",
            "p[style-name='Titre 4'] => h4:fresh",
            "p[style-name='Titre 5'] => h5:fresh",
          ],
          includeDefaultStyleMap: true,
          ignoreEmptyParagraphs: false,
          convertImage: mammoth.images.imgElement(function (image) {
            return image.read("base64").then(function (imageBuffer) {
              return {
                src: "data:" + image.contentType + ";base64," + imageBuffer,
              };
            });
          }),
        };

        const result = await mammoth.convertToHtml({ arrayBuffer }, options);
        const htmlRaw = result.value || "";
        const htmlNormalized = normalizeTablesHtml(htmlRaw);
        const tree = buildTreeFromHtml(htmlNormalized);

        resolve(tree);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
};

const buildTreeFromHtml = (htmlString) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString || "", "text/html");
  const elements = Array.from(doc.body.children);

  const root = [];
  let currentLevel1 = null;
  let currentLevel2 = null;
  let currentLevel3 = null;
  let currentLevel4 = null;
  let currentLevel5 = null;

  const appendContent = (html) => {
    if (!html) return;
    const clean = sanitizeHtml(html);
    const target = currentLevel5 || currentLevel4 || currentLevel3 || currentLevel2 || currentLevel1;
    if (target && target.content.length < MAX_CONTENT_LENGTH) {
      target.content += clean.slice(0, MAX_CONTENT_LENGTH - target.content.length);
    }
  };

  elements.forEach((el) => {
    const tagName = (el.tagName || "").toLowerCase();
    const contentHTML = stripHtmlComments(el.outerHTML);

    if (tagName === "h1") {
      currentLevel1 = {
        id: generateId(),
        title: cleanTitle(el.textContent) || "Chapitre",
        level: 1,
        content: "",
        children: [],
      };
      root.push(currentLevel1);
      currentLevel2 = null;
      currentLevel3 = null;
      currentLevel4 = null;
      currentLevel5 = null;
    } else if (tagName === "h2") {
      if (!currentLevel1) {
        currentLevel1 = {
          id: generateId(),
          title: "Généralités",
          level: 1,
          content: "",
          children: [],
        };
        root.push(currentLevel1);
      }
      currentLevel2 = {
        id: generateId(),
        title: cleanTitle(el.textContent) || "Section",
        level: 2,
        content: "",
        children: [],
      };
      currentLevel1.children.push(currentLevel2);
      currentLevel3 = null;
      currentLevel4 = null;
      currentLevel5 = null;
    } else if (tagName === "h3") {
      if (!currentLevel1) {
        currentLevel1 = {
          id: generateId(),
          title: "Généralités",
          level: 1,
          content: "",
          children: [],
        };
        root.push(currentLevel1);
      }
      if (!currentLevel2) {
        currentLevel2 = {
          id: generateId(),
          title: "Divers",
          level: 2,
          content: "",
          children: [],
        };
        currentLevel1.children.push(currentLevel2);
      }
      currentLevel3 = {
        id: generateId(),
        title: cleanTitle(el.textContent) || "Article",
        level: 3,
        content: "",
        children: [],
      };
      currentLevel2.children.push(currentLevel3);
      currentLevel4 = null;
      currentLevel5 = null;
    }
    // --- GESTION NIVEAU 4 ---
    else if (tagName === "h4") {
      if (!currentLevel1) {
        currentLevel1 = {
          id: generateId(),
          title: "Généralités",
          level: 1,
          content: "",
          children: [],
        };
        root.push(currentLevel1);
      }
      if (!currentLevel2) {
        currentLevel2 = {
          id: generateId(),
          title: "Divers",
          level: 2,
          content: "",
          children: [],
        };
        currentLevel1.children.push(currentLevel2);
      }
      if (!currentLevel3) {
        currentLevel3 = {
          id: generateId(),
          title: "Détails",
          level: 3,
          content: "",
          children: [],
        };
        currentLevel2.children.push(currentLevel3);
      }
      currentLevel4 = {
        id: generateId(),
        title: cleanTitle(el.textContent) || "Sous-Article",
        level: 4,
        content: "",
        children: [],
      };
      currentLevel3.children.push(currentLevel4);
      currentLevel5 = null;
    }
    // --- GESTION NIVEAU 5 ---
    else if (tagName === "h5") {
      if (!currentLevel1) {
        currentLevel1 = {
          id: generateId(),
          title: "Généralités",
          level: 1,
          content: "",
          children: [],
        };
        root.push(currentLevel1);
      }
      if (!currentLevel2) {
        currentLevel2 = {
          id: generateId(),
          title: "Divers",
          level: 2,
          content: "",
          children: [],
        };
        currentLevel1.children.push(currentLevel2);
      }
      if (!currentLevel3) {
        currentLevel3 = {
          id: generateId(),
          title: "Détails",
          level: 3,
          content: "",
          children: [],
        };
        currentLevel2.children.push(currentLevel3);
      }
      if (!currentLevel4) {
        currentLevel4 = {
          id: generateId(),
          title: "Précisions",
          level: 4,
          content: "",
          children: [],
        };
        currentLevel3.children.push(currentLevel4);
      }
      currentLevel5 = {
        id: generateId(),
        title: cleanTitle(el.textContent) || "Point",
        level: 5,
        content: "",
        children: [],
      };
      currentLevel4.children.push(currentLevel5);
    } else {
      appendContent(contentHTML);
    }
  });

  return root;
};
