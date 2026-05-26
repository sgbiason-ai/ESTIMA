// src/components/rao/RaoStructureModal.jsx
//
// Modale d'édition de la structure d'un DQE importé pour le RAO.
// Permet de réorganiser l'arborescence chapitre → sous-chapitre → article
// via drag & drop, avec promotion/démotion, renommage inline et sous-totaux.

import React, { useState, useMemo, useCallback } from 'react';
import {
  X, GripVertical, ChevronDown, ChevronRight, FolderTree, Folder,
  Layers, Trash2, ArrowUp, ArrowDown, Pencil, Check, AlertTriangle
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { generateId } from '../../utils/helpers';

const formatEUR = (n) =>
  (Number(n) || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

const sumNode = (node) => {
  if (node.type === 'item') return (Number(node.qty) || 0) * (Number(node.price) || 0);
  return (node.children || []).reduce((acc, c) => acc + sumNode(c), 0);
};

const cloneTree = (arr) => JSON.parse(JSON.stringify(arr));

// ─── Helpers de manipulation arbre ─────────────────────────────────────────
// Tous travaillent sur `chapters` (array racine). Retournent un NOUVEL array.

function findAndRemove(chapters, nodeId) {
  let removed = null;
  const walk = (arr) => arr.filter(n => {
    if (n.id === nodeId) { removed = n; return false; }
    if (n.children) n.children = walk(n.children);
    return true;
  });
  const next = walk(chapters);
  return { next, removed };
}

function insertAtPath(chapters, parentId, index, node) {
  if (parentId === '__root__') {
    const next = [...chapters];
    next.splice(index, 0, node);
    return next;
  }
  return chapters.map(n => {
    if (n.id === parentId) {
      const children = [...(n.children || [])];
      children.splice(index, 0, node);
      return { ...n, children };
    }
    if (n.children) return { ...n, children: insertAtPath(n.children, parentId, index, node).filter(Boolean) };
    return n;
  });
}

// Récupère la profondeur d'un nœud (0 = chapitre racine, 1 = sous-chapitre, 2 = item dans sous-chap)
function getNodeDepth(chapters, nodeId, depth = 0) {
  for (const n of chapters) {
    if (n.id === nodeId) return depth;
    if (n.children) {
      const d = getNodeDepth(n.children, nodeId, depth + 1);
      if (d >= 0) return d;
    }
  }
  return -1;
}

// Trouve le parent d'un nœud
function findParent(chapters, nodeId, parent = null) {
  for (const n of chapters) {
    if (n.id === nodeId) return parent;
    if (n.children) {
      const p = findParent(n.children, nodeId, n);
      if (p !== null || n.children.some(c => c.id === nodeId)) return p || n;
    }
  }
  return null;
}

// Met à jour un champ d'un nœud
function updateNode(chapters, nodeId, patch) {
  return chapters.map(n => {
    if (n.id === nodeId) return { ...n, ...patch };
    if (n.children) return { ...n, children: updateNode(n.children, nodeId, patch) };
    return n;
  });
}

// Supprime un nœud (et sa descendance)
function removeNode(chapters, nodeId) {
  return chapters
    .filter(n => n.id !== nodeId)
    .map(n => n.children ? { ...n, children: removeNode(n.children, nodeId) } : n);
}

// Promouvoir : item → sous-chapitre OU sous-chapitre → chapitre
function promoteNode(chapters, nodeId) {
  const depth = getNodeDepth(chapters, nodeId);
  if (depth < 0) return chapters;

  if (depth === 0) return chapters; // déjà chapitre racine

  // Trouver le nœud, son parent et son grand-parent
  const parent = findParent(chapters, nodeId);
  if (!parent) return chapters;

  const node = (parent.children || []).find(c => c.id === nodeId);
  if (!node) return chapters;

  // Item → sous-chapitre : convertir type 'item' en 'chapter' avec children=[]
  if (node.type === 'item' && depth === 2) {
    // Item dans sous-chapitre → devient sous-chapitre frère de son parent
    const promoted = { ...node, type: 'chapter', title: node.designation || 'NOUVEAU SOUS-CHAPITRE', children: [] };
    let next = removeNode(chapters, nodeId);
    // Insérer après le parent (sous-chapitre)
    const grandparent = findParent(chapters, parent.id);
    if (grandparent) {
      const grandChildren = [...(grandparent.children || [])];
      const idx = grandChildren.findIndex(c => c.id === parent.id);
      grandChildren.splice(idx + 1, 0, promoted);
      next = updateNode(next, grandparent.id, { children: grandChildren });
    }
    return next;
  }

  if (node.type === 'item' && depth === 1) {
    // Item direct sous chapitre → devient sous-chapitre (au même niveau, après le parent chapter)
    // Note: depth 1 = enfant direct d'un chapter racine. Promotion = transformer en sous-chapitre.
    // Mais "sous-chapitre" est déjà sous un chapter, donc on transforme just le type.
    return updateNode(chapters, nodeId, { type: 'chapter', title: node.designation || node.title, children: [] });
  }

  if (node.type === 'chapter' && depth === 1) {
    // Sous-chapitre → chapitre racine (frère de son parent)
    const promoted = { ...node };
    let next = removeNode(chapters, nodeId);
    const idx = next.findIndex(c => c.id === parent.id);
    next = [...next.slice(0, idx + 1), promoted, ...next.slice(idx + 1)];
    return next;
  }

  return chapters;
}

// Démouvoir : chapitre racine → sous-chapitre OU sous-chapitre vide → item
function demoteNode(chapters, nodeId) {
  const depth = getNodeDepth(chapters, nodeId);
  if (depth < 0) return chapters;

  if (depth === 0) {
    // Chapitre racine → sous-chapitre du chapitre précédent
    const idx = chapters.findIndex(c => c.id === nodeId);
    if (idx <= 0) return chapters; // pas de précédent
    const node = chapters[idx];
    const prev = chapters[idx - 1];
    const next = [...chapters];
    next.splice(idx, 1);
    return updateNode(next, prev.id, { children: [...(prev.children || []), node] });
  }

  if (depth === 1) {
    const parent = findParent(chapters, nodeId);
    if (!parent) return chapters;
    const node = (parent.children || []).find(c => c.id === nodeId);
    if (!node) return chapters;

    // Sous-chapitre → item (uniquement si pas d'enfants ou seul enfant est item)
    if (node.type === 'chapter') {
      if ((node.children || []).length > 0) return chapters; // refuser si contient des enfants
      const asItem = {
        type: 'item',
        id: node.id,
        designation: node.title,
        unit: '',
        price: 0,
        qty: 0,
        formula: '',
        quantities: {},
        quantitiesFormula: {},
        bpuNum: '',
        isFixed: false,
        uid: '',
      };
      return updateNode(chapters, nodeId, asItem);
    }
  }

  return chapters;
}

// ─── COMPOSANT ─────────────────────────────────────────────────────────────

export default function RaoStructureModal({
  open,
  initialChapters = [],
  fileName = '',
  onConfirm,
  onCancel,
}) {
  const [chapters, setChapters] = useState(() => cloneTree(initialChapters));
  const [collapsed, setCollapsed] = useState(new Set());
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');

  // Re-init quand les chapitres initiaux changent (ouverture modale)
  React.useEffect(() => {
    if (open) {
      setChapters(cloneTree(initialChapters));
      setCollapsed(new Set());
    }
  }, [open, initialChapters]);

  const total = useMemo(
    () => chapters.reduce((acc, c) => acc + sumNode(c), 0),
    [chapters]
  );

  const stats = useMemo(() => {
    let nbChap = 0, nbSub = 0, nbItem = 0;
    const walk = (arr, depth) => {
      for (const n of arr) {
        if (n.type === 'item') nbItem++;
        else if (depth === 0) nbChap++;
        else nbSub++;
        if (n.children) walk(n.children, depth + 1);
      }
    };
    walk(chapters, 0);
    return { nbChap, nbSub, nbItem };
  }, [chapters]);

  const toggleCollapsed = (id) => {
    setCollapsed(s => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const startEdit = (node) => {
    setEditingId(node.id);
    setEditValue(node.type === 'item' ? node.designation : node.title);
  };

  const commitEdit = useCallback((nodeId) => {
    const node = findNode(chapters, nodeId);
    if (!node) { setEditingId(null); return; }
    if (node.type === 'item') {
      setChapters(c => updateNode(c, nodeId, { designation: editValue }));
    } else {
      setChapters(c => updateNode(c, nodeId, { title: editValue }));
    }
    setEditingId(null);
  }, [chapters, editValue]);

  const handleDelete = (id) => {
    setChapters(c => removeNode(c, id));
  };

  const handlePromote = (id) => {
    setChapters(c => promoteNode(c, id));
  };

  const handleDemote = (id) => {
    setChapters(c => demoteNode(c, id));
  };

  // ─── Drag & Drop ──────────────────────────────────────────────────────────
  const handleDragEnd = (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    setChapters(prev => {
      // Retirer le nœud
      const { next: afterRemove, removed } = findAndRemove(cloneTree(prev), draggableId);
      if (!removed) return prev;

      // Valider la destination en fonction du type
      const destId = destination.droppableId;
      const destIsRoot = destId === '__root__';
      const destNode = destIsRoot ? null : findNode(afterRemove, destId);

      // Règles :
      // - Un chapitre (type='chapter' avec children potentiels) peut aller en racine OU sous un chapter racine
      // - Un item peut aller dans un chapter racine OU un sous-chapitre
      // - On limite à 3 niveaux : chapitre > sous-chapitre > item
      if (removed.type === 'chapter') {
        // Vérifier qu'on ne crée pas un 3e niveau de chapitre
        if (destIsRoot) {
          return insertAtPath(afterRemove, '__root__', destination.index, removed);
        }
        // destNode doit être un chapter racine
        const destDepth = getNodeDepth(afterRemove, destId);
        if (destDepth !== 0) return prev; // refuser
        // En plus, le chapitre devient sous-chapitre — vérifier qu'il n'a pas de sous-chapitres
        const hasSubChap = (removed.children || []).some(c => c.type === 'chapter');
        if (hasSubChap) return prev; // refuser (limite 3 niveaux)
        return insertAtPath(afterRemove, destId, destination.index, removed);
      }

      // removed.type === 'item'
      if (destIsRoot) return prev; // un item ne va pas à la racine
      return insertAtPath(afterRemove, destId, destination.index, removed);
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200/60">
          <div className="p-2 rounded-xl bg-emerald-50">
            <FolderTree size={20} className="text-emerald-600" strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-lg text-gray-900">Structure du DQE</h2>
            <p className="text-xs text-gray-400 truncate">
              {fileName} — {stats.nbChap} chapitre{stats.nbChap > 1 ? 's' : ''}, {stats.nbSub} sous-chapitre{stats.nbSub > 1 ? 's' : ''}, {stats.nbItem} article{stats.nbItem > 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Hint */}
        <div className="px-6 py-2 bg-blue-50/60 border-b border-blue-100 text-xs text-blue-700 flex items-center gap-2">
          <AlertTriangle size={13} />
          Glissez les lignes pour réorganiser. Utilisez les boutons <ArrowUp size={11} className="inline" />/<ArrowDown size={11} className="inline" /> pour changer de niveau, <Pencil size={11} className="inline" /> pour renommer.
        </div>

        {/* Arbre */}
        <div className="flex-1 overflow-y-auto px-4 py-3 bg-gray-50/40">
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="__root__" type="CHAPTER">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1.5">
                  {chapters.map((chap, index) => (
                    <ChapterRow
                      key={chap.id}
                      node={chap}
                      index={index}
                      depth={0}
                      collapsed={collapsed}
                      onToggleCollapse={toggleCollapsed}
                      editingId={editingId}
                      editValue={editValue}
                      setEditValue={setEditValue}
                      onStartEdit={startEdit}
                      onCommitEdit={commitEdit}
                      onDelete={handleDelete}
                      onPromote={handlePromote}
                      onDemote={handleDemote}
                    />
                  ))}
                  {provided.placeholder}
                  {chapters.length === 0 && (
                    <div className="text-center py-12 text-gray-400 text-sm">
                      Aucun chapitre. Annulez l'import et vérifiez votre fichier Excel.
                    </div>
                  )}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200/60 bg-white">
          <div className="text-sm">
            <span className="text-gray-400 mr-2">Total estimation :</span>
            <span className="font-bold text-gray-900 text-base">{formatEUR(total)}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition-all"
            >
              Annuler
            </button>
            <button
              onClick={() => onConfirm(chapters)}
              disabled={chapters.length === 0}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Check size={15} />
              Créer le RAO
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── HELPER : findNode ─────────────────────────────────────────────────────
function findNode(chapters, id) {
  for (const n of chapters) {
    if (n.id === id) return n;
    if (n.children) {
      const f = findNode(n.children, id);
      if (f) return f;
    }
  }
  return null;
}

// ─── ChapterRow (chapitre racine OU sous-chapitre) ─────────────────────────
function ChapterRow({
  node, index, depth, collapsed, onToggleCollapse,
  editingId, editValue, setEditValue, onStartEdit, onCommitEdit,
  onDelete, onPromote, onDemote,
}) {
  const isCollapsed = collapsed.has(node.id);
  const subtotal = sumNode(node);
  const isSubChapter = depth === 1;

  return (
    <Draggable draggableId={node.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`rounded-xl ${snapshot.isDragging ? 'shadow-lg ring-2 ring-blue-400' : ''}`}
          style={{ ...provided.draggableProps.style, marginLeft: depth * 20 }}
        >
          {/* En-tête chapitre */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
            isSubChapter
              ? 'bg-amber-50/70 border-amber-200/70'
              : 'bg-white border-gray-200/70 shadow-sm'
          }`}>
            <span
              {...provided.dragHandleProps}
              className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing"
            >
              <GripVertical size={14} />
            </span>

            <button
              onClick={() => onToggleCollapse(node.id)}
              className="text-gray-400 hover:text-gray-700"
              title={isCollapsed ? 'Déplier' : 'Replier'}
            >
              {isCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
            </button>

            {isSubChapter
              ? <Layers size={14} className="text-amber-600 shrink-0" />
              : <Folder size={14} className="text-blue-600 shrink-0" />}

            {/* Titre éditable */}
            <div className="flex-1 min-w-0">
              {editingId === node.id ? (
                <input
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => onCommitEdit(node.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onCommitEdit(node.id);
                    if (e.key === 'Escape') onCommitEdit(node.id);
                  }}
                  className={`w-full px-2 py-0.5 rounded-md border bg-white text-sm font-bold ${
                    isSubChapter ? 'text-amber-900 border-amber-300' : 'text-gray-900 border-blue-300'
                  } focus:outline-none focus:ring-2 focus:ring-blue-100`}
                />
              ) : (
                <button
                  onClick={() => onStartEdit(node)}
                  className={`block w-full text-left text-sm font-bold truncate ${
                    isSubChapter ? 'text-amber-900' : 'text-gray-900'
                  }`}
                  title="Cliquez pour renommer"
                >
                  {node.title || 'Sans titre'}
                </button>
              )}
            </div>

            {/* Sous-total */}
            <div className="text-xs font-mono font-semibold text-gray-700 shrink-0 tabular-nums">
              {formatEUR(subtotal)}
            </div>

            {/* Actions */}
            <RowActions
              canPromote={depth > 0}
              canDemote={depth === 0 || (depth === 1 && (node.children || []).length === 0)}
              onPromote={() => onPromote(node.id)}
              onDemote={() => onDemote(node.id)}
              onEdit={() => onStartEdit(node)}
              onDelete={() => onDelete(node.id)}
            />
          </div>

          {/* Enfants (drop zone) */}
          {!isCollapsed && (
            <Droppable droppableId={node.id} type={depth === 0 ? 'CHAPTER' : 'ITEM'}>
              {(dropProvided, dropSnapshot) => (
                <div
                  ref={dropProvided.innerRef}
                  {...dropProvided.droppableProps}
                  className={`mt-1 ml-4 space-y-1 min-h-[8px] rounded-lg ${
                    dropSnapshot.isDraggingOver ? 'bg-blue-50/60 ring-1 ring-blue-200' : ''
                  }`}
                >
                  {(node.children || []).map((child, ci) => (
                    child.type === 'chapter' ? (
                      <ChapterRow
                        key={child.id}
                        node={child}
                        index={ci}
                        depth={depth + 1}
                        collapsed={collapsed}
                        onToggleCollapse={onToggleCollapse}
                        editingId={editingId}
                        editValue={editValue}
                        setEditValue={setEditValue}
                        onStartEdit={onStartEdit}
                        onCommitEdit={onCommitEdit}
                        onDelete={onDelete}
                        onPromote={onPromote}
                        onDemote={onDemote}
                      />
                    ) : (
                      <ItemRow
                        key={child.id}
                        node={child}
                        index={ci}
                        depth={depth + 1}
                        editingId={editingId}
                        editValue={editValue}
                        setEditValue={setEditValue}
                        onStartEdit={onStartEdit}
                        onCommitEdit={onCommitEdit}
                        onDelete={onDelete}
                        onPromote={onPromote}
                      />
                    )
                  ))}
                  {dropProvided.placeholder}
                  {(node.children || []).length === 0 && !dropSnapshot.isDraggingOver && (
                    <div className="text-[11px] text-gray-300 italic px-2 py-1">
                      Vide — glissez des articles ici
                    </div>
                  )}
                </div>
              )}
            </Droppable>
          )}
        </div>
      )}
    </Draggable>
  );
}

// ─── ItemRow (article) ─────────────────────────────────────────────────────
function ItemRow({
  node, index, depth,
  editingId, editValue, setEditValue, onStartEdit, onCommitEdit,
  onDelete, onPromote,
}) {
  const lineTotal = (Number(node.qty) || 0) * (Number(node.price) || 0);

  return (
    <Draggable draggableId={node.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-gray-100 hover:border-gray-200 ${
            snapshot.isDragging ? 'shadow-md ring-2 ring-blue-300' : ''
          }`}
          style={provided.draggableProps.style}
        >
          <span
            {...provided.dragHandleProps}
            className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing"
          >
            <GripVertical size={12} />
          </span>

          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0" />

          {node.bpuNum && (
            <span className="text-[10px] font-mono text-gray-400 shrink-0 px-1.5 py-0.5 rounded bg-gray-50">
              {node.bpuNum}
            </span>
          )}

          <div className="flex-1 min-w-0">
            {editingId === node.id ? (
              <input
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => onCommitEdit(node.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onCommitEdit(node.id);
                  if (e.key === 'Escape') onCommitEdit(node.id);
                }}
                className="w-full px-2 py-0.5 rounded-md border border-blue-300 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            ) : (
              <button
                onClick={() => onStartEdit(node)}
                className="block w-full text-left text-sm text-gray-700 truncate"
                title="Cliquez pour renommer"
              >
                {node.designation || 'Sans désignation'}
              </button>
            )}
          </div>

          <div className="text-[11px] text-gray-400 shrink-0 tabular-nums">
            {(node.qty || 0).toLocaleString('fr-FR')} {node.unit || ''}
          </div>

          <div className="text-xs font-mono font-semibold text-gray-700 shrink-0 tabular-nums w-24 text-right">
            {formatEUR(lineTotal)}
          </div>

          <RowActions
            canPromote={depth >= 1}
            canDemote={false}
            onPromote={() => onPromote(node.id)}
            onDemote={() => {}}
            onEdit={() => onStartEdit(node)}
            onDelete={() => onDelete(node.id)}
          />
        </div>
      )}
    </Draggable>
  );
}

// ─── RowActions ─────────────────────────────────────────────────────────────
function RowActions({ canPromote, canDemote, onPromote, onDemote, onEdit, onDelete }) {
  return (
    <div className="flex items-center gap-0.5 shrink-0">
      <button
        onClick={onPromote}
        disabled={!canPromote}
        className="p-1 rounded text-gray-300 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-300 transition-all"
        title="Promouvoir (monter d'un niveau)"
      >
        <ArrowUp size={13} />
      </button>
      <button
        onClick={onDemote}
        disabled={!canDemote}
        className="p-1 rounded text-gray-300 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-300 transition-all"
        title="Démouvoir (descendre d'un niveau)"
      >
        <ArrowDown size={13} />
      </button>
      <button
        onClick={onEdit}
        className="p-1 rounded text-gray-300 hover:text-blue-600 hover:bg-blue-50 transition-all"
        title="Renommer"
      >
        <Pencil size={12} />
      </button>
      <button
        onClick={onDelete}
        className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
        title="Supprimer"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}
