import React, { useState, useMemo } from 'react';
import Icon from './Icon';
import { fmt, fmtShort } from './formatters';

export default function TranchesView({ project, calcHook, tranchesHook }) {
  const { tranches, hasTranches } = tranchesHook;
  const [openIdx, setOpenIdx] = useState(0);

  const trancheData = useMemo(() => {
    const data = [];
    const trancheList = hasTranches ? tranches : [{ id: 'global', name: 'Global' }];

    trancheList.forEach(t => {
      const qtyMap = calcHook.clientQtyMaps?.[t.id] || {};
      let total = 0;
      const chapitres = [];

      (project.chapters || []).forEach(ch => {
        let chapTotal = 0;
        const collectFromChapter = (node) => {
          if (node.type === 'item') {
            chapTotal += (qtyMap[node.id] || 0) * Number(node.price || 0);
          }
          (node.children || []).forEach(collectFromChapter);
        };
        collectFromChapter(ch);

        chapitres.push({ nom: ch.title || 'Sans titre', montant: chapTotal });
        total += chapTotal;
      });

      data.push({ nom: t.name, montant: total, chapitres });
    });

    return data;
  }, [project, calcHook, tranches, hasTranches]);

  const grandTotal = trancheData.reduce((s, t) => s + t.montant, 0);

  return (
    <div className="py-2">
      <div className="mx-4 mb-3 p-4 bg-white rounded-2xl border border-gray-200 text-center">
        <div className="text-xs text-gray-700 font-bold uppercase tracking-wider">Montant total</div>
        <div className="text-2xl font-extrabold text-blue-600 mt-1">{fmt(grandTotal)}</div>
      </div>

      {trancheData.map((tr, i) => {
        const isOpen = openIdx === i;
        const pct = grandTotal > 0 ? ((tr.montant / grandTotal) * 100).toFixed(0) : 0;
        return (
          <div key={i} className="mx-4 mb-2">
            <button onClick={() => setOpenIdx(isOpen ? -1 : i)}
              className="flex items-center gap-1 w-full p-3.5 bg-white border border-gray-200 rounded-xl text-left">
              <div className="flex-1">
                <div className="text-sm font-bold text-gray-900">{tr.nom}</div>
                <div className="text-xs text-gray-700 mt-0.5">{pct}% du total</div>
              </div>
              <span className="text-base font-extrabold text-blue-600">{fmtShort(tr.montant)}</span>
              <span className={`ml-2 transition-transform ${isOpen ? 'rotate-90' : ''}`}>
                <Icon name="chevron" size={14} color="#64748b" />
              </span>
            </button>

            {isOpen && (
              <div className="bg-white border border-t-0 border-gray-200 rounded-b-xl p-3 -mt-1">
                {tr.chapitres.map((ch, j) => {
                  const barW = tr.montant > 0 ? (ch.montant / tr.montant) * 100 : 0;
                  return (
                    <div key={j} className="py-2 border-b border-gray-100 last:border-0">
                      <div className="flex justify-between mb-1">
                        <span className="text-[13px] text-gray-600 font-semibold">{ch.nom}</span>
                        <span className="text-[13px] text-gray-900 font-bold">{fmtShort(ch.montant)}</span>
                      </div>
                      <div className="h-1.5 bg-white rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all"
                          style={{ width: `${barW}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
