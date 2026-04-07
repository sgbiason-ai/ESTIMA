// src/views/crc/CrcMeetingTabs.jsx — EstimaStyle
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function CrcMeetingTabs({ meetings, activeMeetingId, setActiveMeetingId, saveStatus }) {
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScroll);
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', checkScroll); ro.disconnect(); };
  }, [meetings, checkScroll]);

  useEffect(() => {
    if (!activeMeetingId || !scrollRef.current) return;
    const tab = scrollRef.current.querySelector(`[data-mid="${activeMeetingId}"]`);
    tab?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }, [activeMeetingId]);

  const scroll = (dir) => scrollRef.current?.scrollBy({ left: dir * 200, behavior: 'smooth' });
  const fmtDate = (d) => { if (!d) return ''; const [, m, dd] = d.split('-'); return `${dd}/${m}`; };

  const si = {
    saved:   { dot: 'bg-emerald-500',            label: 'Sauvegardé' },
    saving:  { dot: 'bg-blue-500 animate-pulse',  label: 'Sauvegarde...' },
    waiting: { dot: 'bg-amber-500',               label: 'Modifié' },
    error:   { dot: 'bg-red-500',                 label: 'Erreur' },
  }[saveStatus] || { dot: 'bg-emerald-500', label: 'Sauvegardé' };

  return (
    <div className="flex items-center bg-white/60 backdrop-blur-sm border-b border-gray-200/60 shrink-0 min-h-[38px]">
      {canScrollLeft && (
        <button onClick={() => scroll(-1)} className="px-1 py-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0 rounded-lg">
          <ChevronLeft size={14} />
        </button>
      )}

      <div ref={scrollRef} className="flex items-center flex-1 gap-1 px-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {meetings.length === 0 && (
          <span className="text-xs text-gray-400 italic px-3 py-1.5">Aucun compte rendu — cliquez Nouveau CR</span>
        )}
        {meetings.map((m) => {
          const active = m.id === activeMeetingId;
          return (
            <button
              key={m.id}
              data-mid={m.id}
              onClick={() => setActiveMeetingId(m.id)}
              className={`shrink-0 px-3 py-1.5 text-[11px] font-medium transition-all whitespace-nowrap rounded-lg ${
                active
                  ? 'bg-white text-gray-900 shadow-sm border border-gray-200/60'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              }`}
            >
              CR {String(m.number).padStart(2, '0')}{m.date ? ` · ${fmtDate(m.date)}` : ''}
            </button>
          );
        })}
      </div>

      {canScrollRight && (
        <button onClick={() => scroll(1)} className="px-1 py-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0 rounded-lg">
          <ChevronRight size={14} />
        </button>
      )}

      <div className="flex items-center gap-1.5 px-3 shrink-0 border-l border-gray-200/60 ml-1">
        <div className={`w-1.5 h-1.5 rounded-full ${si.dot}`} />
        <span className="text-[10px] text-gray-400 font-medium">{si.label}</span>
      </div>
    </div>
  );
}
