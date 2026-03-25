// src/hooks/useProjectDnD.js
import { useState } from 'react';

export const useProjectDnD = (project, setProject) => {
  const [dragHover, setDragHover] = useState(null);
  const [draggingType, setDraggingType] = useState(null);

  // --- LOGIQUE INTERNE (Helpers) ---
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  const moveChapter = (chapters, fromIndex, toPos) => {
    // Sécurité : Un chapitre ne va que dans root
    if (toPos.parentId !== 'root') return chapters;

    const list = [...chapters];
    const [removed] = list.splice(fromIndex, 1);
    
    let targetIndex = toPos.index;
    
    // Logique de décalage d'index
    if (toPos.position === 'after') targetIndex++;
    if (fromIndex < targetIndex) targetIndex--;
    
    targetIndex = clamp(targetIndex, 0, list.length);
    
    list.splice(targetIndex, 0, removed);
    return list;
  };

  const moveItemOrSub = (chapters, fromPos, toPos) => {
    // 1. Fonction pour retirer l'élément (Récursive)
    let removedItem = null;
    
    const removeRecursive = (items, parentId, index) => {
      if (parentId === 'root') return items; // Impossible pour un item
      return items.map(it => {
        if (it.id === parentId) {
          const children = [...(it.children || [])];
          [removedItem] = children.splice(index, 1);
          return { ...it, children };
        }
        if (it.children) {
          return { ...it, children: removeRecursive(it.children, parentId, index) };
        }
        return it;
      });
    };

    // 2. Fonction pour insérer l'élément (Récursive)
    const insertRecursive = (items, parentId, index, element) => {
      return items.map(it => {
        if (it.id === parentId) {
          const children = [...(it.children || [])];
          let finalIndex = index;
          if (toPos.position === 'after') finalIndex++;
          children.splice(clamp(finalIndex, 0, children.length), 0, element);
          return { ...it, children };
        }
        if (it.children) {
          return { ...it, children: insertRecursive(it.children, parentId, index, element) };
        }
        return it;
      });
    };

    // Exécution
    const listAfterRemove = removeRecursive(chapters, fromPos.parentId, fromPos.index);
    
    // Si l'élément n'a pas été trouvé/retiré, on ne fait rien
    if (!removedItem) return chapters;

    // Ajustement index si déplacement au sein du même parent
    let insertIdx = toPos.index;
    if (fromPos.parentId === toPos.parentId && fromPos.index < toPos.index) insertIdx--;

    return insertRecursive(listAfterRemove, toPos.parentId, insertIdx, removedItem);
  };

  // --- HANDLERS EXPOSÉS ---
  const dragHandlers = {
    onStart: (e, fromPos) => {
      e.dataTransfer.setData('source', JSON.stringify(fromPos));
      e.dataTransfer.effectAllowed = 'move';
      
      // Fix perf : requestAnimationFrame
      requestAnimationFrame(() => {
        setDraggingType(fromPos.type === 'chapter' ? 'chapter' : 'item');
        setDragHover(null);
      });
    },

    onOver: (e, currentPos) => {
      e.preventDefault();
      
      // Logique de "Force Root" si c'est un chapitre
      if (draggingType === 'chapter') {
        setDragHover({
          parentId: 'root',
          index: currentPos.index,
          position: currentPos.position || 'before'
        });
      } else {
        setDragHover({
          parentId: currentPos.parentId,
          index: currentPos.index,
          position: currentPos.position || 'before',
        });
      }
    },

    onEnter: (e) => e.preventDefault(),
    
    onEnd: () => {
      setDragHover(null);
      setDraggingType(null);
    },

    onDrop: (e, toPosFallback) => {
      e.preventDefault();
      const raw = e.dataTransfer.getData('source');
      if (!raw) return;

      let fromPos;
      try { fromPos = JSON.parse(raw); } catch { return; }

      const hover = dragHover;
      
      // Fix perf : setTimeout 0 pour libérer le thread UI
      setTimeout(() => {
        if (!hover) {
          setDraggingType(null);
          return;
        }
        const toPos = { parentId: hover.parentId, index: hover.index, position: hover.position };

        setProject(prev => {
          let newChapters;
          if (fromPos.type === 'chapter') {
            newChapters = moveChapter(prev.chapters, fromPos.index, toPos);
          } else {
            newChapters = moveItemOrSub(prev.chapters, fromPos, toPos);
          }
          return { ...prev, chapters: newChapters };
        });

        setDragHover(null);
        setDraggingType(null);
      }, 0);
    }
  };

  return { dragHandlers, dragHover, draggingType };
};