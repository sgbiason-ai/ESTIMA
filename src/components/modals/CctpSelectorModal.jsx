import React, { useState, useMemo } from 'react';
import { X, Search, ChevronRight, ChevronDown, Folder, FileText, Check } from 'lucide-react';

const CctpSelectorModal = ({ isOpen, onClose, onSelect, masterCctp, currentRef }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState(new Set());

  // Filtrage intelligent
  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) return masterCctp;
    const lowerQuery = searchQuery.toLowerCase();
    
    const filterRecursive = (nodes) => {
      return nodes.reduce((acc, node) => {
        const matches = node.title.toLowerCase().includes(lowerQuery) || node.id.includes(lowerQuery);
        const filteredChildren = node.children ? filterRecursive(node.children) : [];
        if (matches || filteredChildren.length > 0) {
          acc.push({ ...node, children: filteredChildren });
        }
        return acc;
      }, []);
    };
    return filterRecursive(masterCctp);
  }, [masterCctp, searchQuery]);

  // Expand automatique
  React.useEffect(() => {
    if (searchQuery.trim()) {
        const getAllIds = (nodes) => {
            let ids = [];
            nodes.forEach(n => {
                ids.push(n.id);
                if (n.children) ids = [...ids, ...getAllIds(n.children)];
            });
            return ids;
        };
        setExpandedIds(new Set(getAllIds(filteredNodes)));
    }
  }, [searchQuery, filteredNodes]);

  const toggleExpand = (id, e) => {
    e.stopPropagation();
    const newSet = new Set(expandedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedIds(newSet);
  };

  const renderTree = (nodes, depth = 0) => {
    return nodes.map(node => {
        const hasChildren = node.children && node.children.length > 0;
        const isExpanded = expandedIds.has(node.id);
        const isSelected = currentRef === node.id;
        
        // MODIFICATION ICI : On masque l'ID s'il est technique/moche
        const isCleanId = node.id && !node.id.startsWith('imported_') && !node.id.startsWith('custom_');

        return (
            <div key={node.id} className="select-none">
                <div 
                    onClick={() => { onSelect(node.id); onClose(); }}
                    className={`
                        flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors border border-transparent
                        ${isSelected ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'hover:bg-slate-50 hover:border-slate-100'}
                    `}
                    style={{ marginLeft: `${depth * 16}px` }}
                >
                    <div 
                        onClick={(e) => hasChildren && toggleExpand(node.id, e)}
                        className={`p-1 rounded hover:bg-slate-200 text-slate-400 ${hasChildren ? 'visible' : 'invisible'}`}
                    >
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </div>
                    
                    {hasChildren ? <Folder size={16} className="text-yellow-400 fill-yellow-100" /> : <FileText size={16} className="text-slate-400" />}
                    
                    <div className="flex-1 truncate">
                        {isCleanId && (
                            <span className="font-mono text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded mr-2">
                                {node.id}
                            </span>
                        )}
                        <span className="text-xs font-medium">{node.title}</span>
                    </div>

                    {isSelected && <Check size={16} className="text-indigo-600" />}
                </div>
                {hasChildren && isExpanded && (
                    <div className="border-l border-slate-100 ml-4">
                        {renderTree(node.children, depth + 1)}
                    </div>
                )}
            </div>
        );
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-2xl h-[80vh] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
            <div><h3 className="font-bold text-slate-800">Sélectionner un chapitre CCTP</h3><p className="text-xs text-slate-500">Cliquez sur un élément pour le lier</p></div>
            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"><X size={20} /></button>
        </div>
        <div className="p-4 border-b border-slate-200 bg-white">
            <div className="relative"><Search className="absolute left-3 top-2.5 text-slate-400" size={16} /><input type="text" placeholder="Rechercher (ex: Terrassement, 4.2...)" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} autoFocus className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" /></div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 bg-white">
            {renderTree(filteredNodes)}
            {filteredNodes.length === 0 && <div className="text-center py-10 text-slate-400 text-sm">Aucun chapitre trouvé pour "{searchQuery}"</div>}
        </div>
        <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
            <button onClick={() => { onSelect(""); onClose(); }} className="text-xs text-red-500 hover:text-red-700 font-medium px-3 py-2 rounded hover:bg-red-50 transition-colors">Détacher / Aucun lien</button>
            <button onClick={onClose} className="px-4 py-2 bg-slate-200 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-300">Fermer</button>
        </div>
      </div>
    </div>
  );
};

export default CctpSelectorModal;