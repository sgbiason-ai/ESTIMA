// src/components/help/HelpPanel.jsx
// Panel lateral droit d'aide contextuelle, partage entre tous les modules.

import React, { useState, useEffect } from 'react';
import { X, BookOpen } from 'lucide-react';
import { helpContent } from '../../data/helpContent';
import HelpSections, { getIcon } from './HelpSections';

const HelpPanel = ({ isOpen, onClose, moduleId, headerActions }) => {
  const [activeTab, setActiveTab] = useState(0);

  const content = helpContent[moduleId];

  // Reset tab quand on change de module
  useEffect(() => { setActiveTab(0); }, [moduleId]);

  if (!isOpen || !content) return null;

  const tabs = content.tabs || [];
  const currentTab = tabs[activeTab] || tabs[0];

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-[420px] max-sm:w-full flex flex-col bg-white shadow-2xl border-l border-gray-200 animate-in slide-in-from-right duration-250">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="shrink-0 bg-gradient-to-br from-blue-50 to-indigo-50/60 border-b border-blue-200/60 px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="bg-blue-600 p-1.5 rounded-lg">
                <BookOpen size={16} className="text-white" />
              </div>
              <div>
                <h2 className="text-sm font-black text-gray-800 uppercase tracking-wide leading-none">
                  {content.title}
                </h2>
                <p className="text-[10px] text-blue-600 mt-0.5 font-medium">
                  {content.subtitle}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {headerActions}
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-white/80 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Onglets */}
          {tabs.length > 1 && (
            <div className="flex gap-1 overflow-x-auto no-scrollbar">
              {tabs.map((tab, i) => {
                const Icon = getIcon(tab.icon);
                const isActive = activeTab === i;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(i)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-white/70 text-gray-500 hover:bg-white hover:text-gray-700'
                    }`}
                  >
                    <Icon size={12} />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Content ────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {currentTab && currentTab.sections && (
            <HelpSections sections={currentTab.sections} />
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="shrink-0 px-5 py-3 border-t border-gray-100 bg-gray-50/50 text-center">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-gray-800 transition-colors"
          >
            Compris !
          </button>
        </div>
      </div>
    </>
  );
};

export default HelpPanel;
