import React, { useState, useMemo } from 'react';
import Icon from './Icon';
import { fmt } from './formatters';
import { flattenItems } from './helpers';
import { normalizeUnitSymbol, sanitizeHtml } from '../../utils/helpers';

export default function BPUView({ project, bpuDescMap, refMap, search, onSearch }) {
  const [expandedId, setExpandedId] = useState(null);

  const items = useMemo(() => flattenItems(project.chapters), [project]);

  const uniqueItems = useMemo(() => {
    const seen = new Set();
    return items.filter(item => {
      const key = item.uid || item.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [items]);

  const grouped = useMemo(() => {
    const term = search.toLowerCase();
    const filtered = uniqueItems.filter(item =>
      (item.designation || '').toLowerCase().includes(term) ||
      (refMap?.get(item.id) || '').toLowerCase().includes(term)
    );

    const chapMap = {};
    const assignChapter = (nodes, parentTitle) => {
      nodes.forEach(n => {
        if (n.type === 'chapter') {
          assignChapter(n.children || [], n.title || parentTitle);
        } else if (n.type === 'item') {
          const key = n.uid || n.id;
          if (!chapMap[key]) chapMap[key] = parentTitle || 'Autres';
        }
      });
    };
    assignChapter(project.chapters || [], 'Autres');

    const groups = {};
    filtered.forEach(item => {
      const chap = chapMap[item.uid || item.id] || 'Autres';
      if (!groups[chap]) groups[chap] = [];
      groups[chap].push(item);
    });
    return groups;
  }, [uniqueItems, search, project, refMap]);

  return (
    <div>
      <div className="flex items-center gap-2 mx-4 mt-3 mb-2 px-3.5 py-2.5 bg-white rounded-xl border border-gray-200">
        <Icon name="search" size={18} color="#64748b" />
        <input type="text" placeholder="Rechercher un article…"
          value={search} onChange={(e) => onSearch(e.target.value)}
          className="flex-1 border-none outline-none text-sm bg-transparent text-gray-900 placeholder-slate-500" />
      </div>

      {Object.entries(grouped).map(([chapitre, items]) => (
        <div key={chapitre} className="mb-1">
          <div className="sticky top-0 z-10 text-[11px] font-extrabold text-blue-600/70 uppercase tracking-wider px-4 py-2 bg-[#f5f5f7]">
            {chapitre}
          </div>
          {items.map(item => {
            const isOpen = expandedId === (item.uid || item.id);
            const ref = refMap?.get(item.id) || '';
            const bpuMatch = bpuDescMap[(item.designation || '').trim().toUpperCase()];
            const description = bpuMatch?.description || '';

            return (
              <button
                key={item.uid || item.id}
                onClick={() => setExpandedId(isOpen ? null : (item.uid || item.id))}
                className={`block w-full text-left px-4 py-2.5 border-b border-gray-100 transition ${isOpen ? 'bg-blue-50' : 'bg-white'}`}
              >
                <div className="flex justify-between items-start">
                  <span className="text-[11px] font-extrabold text-blue-600 tabular-nums">{ref}</span>
                  <span className="text-sm font-extrabold text-gray-900 tabular-nums">
                    {fmt(item.price || 0)}
                    <span className="text-[11px] text-gray-700 font-normal"> / {normalizeUnitSymbol(item.unit)}</span>
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[13px] text-gray-600 mt-0.5">{item.designation}</span>
                  <span className={`ml-1.5 shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''} opacity-30`}>
                    <Icon name="chevron" size={14} color="#64748b" />
                  </span>
                </div>

                {isOpen && description && (
                  <div className="mt-2.5 p-3 bg-white rounded-xl border border-gray-200">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Icon name="file" size={12} color="#34d399" />
                      <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-wide">Description BPU</span>
                    </div>
                    <div
                      className="prose-mobile"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(description) }}
                    />
                  </div>
                )}
                {isOpen && !description && (
                  <div className="mt-2.5 p-3 bg-white rounded-xl border border-dashed border-gray-200 text-center">
                    <span className="text-xs text-gray-600">Pas de description dans la base BPU</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
