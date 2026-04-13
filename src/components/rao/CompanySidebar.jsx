// src/components/rao/CompanySidebar.jsx — Sidebar entreprises RAO
import React from 'react';
import { Building2 } from 'lucide-react';
import { COMPANY_UI_COLORS } from './RaoConstants';

const STATUS_DOT = {
  complete: 'bg-emerald-500',
  partial: 'bg-amber-400',
  empty: 'bg-gray-300',
};

const STATUS_LABEL = {
  complete: 'Complet',
  partial: 'Partiel',
  empty: 'À renseigner',
};

const CompanySidebar = ({ companyNames, selectedCompany, onSelectCompany, getCompletionStatus }) => {
  if (!companyNames || companyNames.length === 0) return null;

  return (
    <aside className="w-[220px] shrink-0 bg-white border-r border-gray-200/60 overflow-y-auto flex flex-col">
      {/* Titre */}
      <div className="px-4 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <Building2 size={14} className="text-gray-400" strokeWidth={1.5} />
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
            Entreprises
          </span>
        </div>
      </div>

      {/* Liste */}
      <div className="px-2.5 pb-4 space-y-1 flex-1">
        {companyNames.map((name, idx) => {
          const uiColor = COMPANY_UI_COLORS[idx % COMPANY_UI_COLORS.length];
          const isSelected = selectedCompany === name;
          const status = getCompletionStatus ? getCompletionStatus(name) : 'empty';

          return (
            <button
              key={name}
              onClick={() => onSelectCompany(name)}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
                border-l-[3px]
                ${isSelected
                  ? `bg-gray-50 ${uiColor.border} shadow-sm`
                  : 'border-l-transparent hover:bg-gray-50/70'
                }
              `}
              title={`${name} — ${STATUS_LABEL[status]}`}
            >
              {/* Avatar initiale */}
              <div className={`
                w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 transition-all
                ${isSelected ? `${uiColor.bg} ${uiColor.text}` : 'bg-gray-100 text-gray-500'}
              `}>
                {name.substring(0, 1).toUpperCase()}
              </div>

              {/* Nom */}
              <span className={`
                flex-1 text-left text-[13px] font-semibold truncate transition-colors
                ${isSelected ? 'text-gray-900' : 'text-gray-600'}
              `}>
                {name}
              </span>

              {/* Pastille complétion */}
              <div className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[status]}`} />
            </button>
          );
        })}
      </div>
    </aside>
  );
};

export default CompanySidebar;
