// src/hooks/useProjectTranches.js
import { useState } from 'react';
import { toast, confirm as confirmDialog } from '../utils/globalUI';

export const useProjectTranches = (project, updateProjectItem) => {
  const [activeTrancheId, setActiveTrancheId] = useState('global');
  
  const tranches = project?.tranches || [];
  const hasTranches = tranches.length > 0;
  
  const isGlobalMode = activeTrancheId === 'global' && hasTranches;

  const addTranche = () => {
    if (tranches.length === 0) {
        const t1Id = `tranche_${Date.now()}`;
        const t2Id = `tranche_${Date.now() + 1}`; 
        const newTranche1 = { id: t1Id, name: 'Tranche 1' };
        const newTranche2 = { id: t2Id, name: 'Tranche 2' };

        const migrateChapters = (nodes) => {
            return nodes.map(node => {
                if (node.type === 'item') {
                    const currentQty = node.qty || 0;
                    return {
                        ...node,
                        quantities: { 
                            [t1Id]: currentQty, 
                            [t2Id]: 0           
                        }
                    };
                } else if (node.children) {
                    return { ...node, children: migrateChapters(node.children) };
                }
                return node;
            });
        };

        const updatedChapters = migrateChapters(project.chapters);
        updateProjectItem('root', 'root', 'chapters', updatedChapters);
        updateProjectItem('root', 'root', 'tranches', [newTranche1, newTranche2]);
        setActiveTrancheId(t1Id); 

    } else {
        const newTrancheId = `tranche_${Date.now()}`;
        const newTrancheNumber = tranches.length + 1;
        const newTranche = { id: newTrancheId, name: `Tranche ${newTrancheNumber}` };
        
        const updatedTranches = [...tranches, newTranche];
        updateProjectItem('root', 'root', 'tranches', updatedTranches);
        setActiveTrancheId(newTrancheId);
    }
  };

  const removeTranche = async (tId, e) => {
    e.stopPropagation();
    const ok = await confirmDialog("Supprimer cette tranche et toutes les quantités associées ?", { danger: true });
    if (ok) {
        const remainingTranches = tranches.filter(t => t.id !== tId);
        if (remainingTranches.length === 1) {
            const survivor = remainingTranches[0];
            const survivorId = survivor.id;
            toast.warning(`Il ne reste plus qu'une seule tranche (${survivor.name}). Le projet repasse en mode GLOBAL avec les quantités de cette tranche.`);
            const flattenChapters = (nodes) => {
                return nodes.map(node => {
                     if (node.type === 'item') {
                         const finalQty = node.quantities && node.quantities[survivorId] !== undefined 
                            ? node.quantities[survivorId] 
                            : 0;
                         return { 
                            ...node, 
                            qty: finalQty,
                            quantities: {} 
                         };
                     } else if (node.children) {
                         return { ...node, children: flattenChapters(node.children) };
                     }
                     return node;
                });
            };
            const updatedChapters = flattenChapters(project.chapters);
            updateProjectItem('root', 'root', 'chapters', updatedChapters);
            updateProjectItem('root', 'root', 'tranches', []); 
            setActiveTrancheId('global');

        } else {
            const cleanChapters = (nodes) => {
                return nodes.map(node => {
                    if (node.type === 'item') {
                        if (node.quantities && node.quantities[tId] !== undefined) {
                            const newQuantities = { ...node.quantities };
                            delete newQuantities[tId];
                            return { ...node, quantities: newQuantities };
                        }
                        return node;
                    } else if (node.children) {
                        return { ...node, children: cleanChapters(node.children) };
                    }
                    return node;
                });
            };
            const updatedChapters = cleanChapters(project.chapters);
            updateProjectItem('root', 'root', 'chapters', updatedChapters);
            updateProjectItem('root', 'root', 'tranches', remainingTranches);
            if (activeTrancheId === tId) {
                setActiveTrancheId('global');
            }
        }
    }
  };

  return {
    activeTrancheId,
    setActiveTrancheId,
    tranches,
    hasTranches,
    isGlobalMode,
    addTranche,
    removeTranche
  };
};