/* eslint-disable react-refresh/only-export-components -- fichier mêlant volontairement composants et helpers/constantes (règle DX Fast-Refresh, sans impact fonctionnel) */
// src/components/help/HelpSections.jsx
// Renderer generique pour les sections de contenu d'aide.

import React from 'react';
import {
  ArrowRight, Lightbulb, AlertTriangle, CheckCircle2, ExternalLink,
  Upload, Save, Clock, Cloud, FileJson, Copy, Folder, Trash2,
  PlusCircle, HelpCircle, BookOpen, Users, ClipboardList, FileDown,
  Calendar, Edit3, Star, Building2, Shield, UserPlus, Send,
  Settings, BarChart3, Award, MessageSquare, MapPin, Map,
  FilePlus, ListTree, Calculator, Info, LayoutGrid, Compass,
  Palette, Type, FileCheck, Paintbrush, LayoutDashboard, FileSearch,
  FolderTree, FileText, Download, List, FileSpreadsheet, Keyboard,
  MousePointerClick, GitBranch, FunctionSquare, Boxes, Layers, Package,
  Briefcase, Wrench, Lock, ShieldCheck,
} from 'lucide-react';

const ICON_MAP = {
  ArrowRight, Lightbulb, AlertTriangle, CheckCircle2, ExternalLink,
  Upload, Save, Clock, Cloud, FileJson, Copy, Folder, Trash2,
  PlusCircle, HelpCircle, BookOpen, Users, ClipboardList, FileDown,
  Calendar, Edit3, Star, Building2, Shield, UserPlus, Send,
  Settings, BarChart3, Award, MessageSquare, MapPin, Map,
  FilePlus, ListTree, Calculator, Info, LayoutGrid, Compass,
  Palette, Type, FileCheck, Paintbrush, LayoutDashboard, FileSearch,
  FolderTree, FileText, Download, List, FileSpreadsheet, Keyboard,
  MousePointerClick, GitBranch, FunctionSquare, Boxes, Layers, Package,
  Briefcase, Wrench, Lock, ShieldCheck,
};

const getIcon = (name) => ICON_MAP[name] || HelpCircle;

const COLOR_CLASSES = {
  blue:    { bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-600',    badge: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500' },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  amber:   { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-600',   badge: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-500' },
  purple:  { bg: 'bg-purple-50',  border: 'border-purple-200',  text: 'text-purple-600',  badge: 'bg-purple-100 text-purple-700',  dot: 'bg-purple-500' },
  rose:    { bg: 'bg-rose-50',    border: 'border-rose-200',    text: 'text-rose-600',    badge: 'bg-rose-100 text-rose-700',    dot: 'bg-rose-500' },
  red:     { bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-600',     badge: 'bg-red-100 text-red-700',     dot: 'bg-red-500' },
  slate:   { bg: 'bg-slate-50',   border: 'border-slate-200',   text: 'text-slate-600',   badge: 'bg-slate-100 text-slate-700',   dot: 'bg-slate-500' },
  indigo:  { bg: 'bg-indigo-50',  border: 'border-indigo-200',  text: 'text-indigo-600',  badge: 'bg-indigo-100 text-indigo-700',  dot: 'bg-indigo-500' },
  teal:    { bg: 'bg-teal-50',    border: 'border-teal-200',    text: 'text-teal-600',    badge: 'bg-teal-100 text-teal-700',    dot: 'bg-teal-500' },
  violet:  { bg: 'bg-violet-50',  border: 'border-violet-200',  text: 'text-violet-600',  badge: 'bg-violet-100 text-violet-700',  dot: 'bg-violet-500' },
};

const getColor = (name) => COLOR_CLASSES[name] || COLOR_CLASSES.blue;

// ─── Section: Intro ──────────────────────────────────────────────────────────
const IntroSection = ({ text }) => (
  <p className="text-sm text-gray-600 leading-relaxed">{text}</p>
);

// ─── Section: Card ───────────────────────────────────────────────────────────
const CardSection = ({ icon, color = 'blue', title, badge, description, steps, tip, warning, link }) => {
  const Icon = getIcon(icon);
  const c = getColor(color);

  return (
    <div className={`rounded-xl border ${c.border} overflow-hidden`}>
      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${c.bg}`}>
            <Icon size={18} className={c.text} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-gray-800">{title}</p>
              {badge && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.badge}`}>{badge}</span>}
            </div>
            {description && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{description}</p>}
          </div>
        </div>

        {steps && (
          <div className="space-y-1.5 ml-12 mb-3">
            {steps.map((s, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
                <ArrowRight size={12} className="text-gray-400 mt-0.5 shrink-0" /><span>{s}</span>
              </div>
            ))}
          </div>
        )}

        {link && (
          <a href={link} target="_blank" rel="noreferrer"
            className={`inline-flex items-center gap-1.5 text-xs font-medium ml-12 ${c.text} hover:underline`}>
            Ouvrir <ExternalLink size={12} />
          </a>
        )}

        {tip && (
          <div className="ml-12 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
            <p className="text-amber-700 text-xs flex items-center gap-1.5"><Lightbulb size={12} /> <strong>Astuce :</strong> {tip}</p>
          </div>
        )}
        {warning && (
          <div className="ml-12 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
            <p className="text-amber-700 text-xs flex items-center gap-1.5"><AlertTriangle size={12} /> {warning}</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Section: Steps ──────────────────────────────────────────────────────────
const StepsSection = ({ items }) => (
  <div className="space-y-3">
    {items.map((item, i) => {
      const c = getColor(item.color);
      return (
        <div key={i} className="flex gap-3">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${c.dot}`}>
            {i + 1}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-800 mb-0.5">{item.title}</p>
            <p className="text-xs text-gray-500 leading-relaxed">{item.description}</p>
            {item.link && (
              <a href={item.link} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1">
                Ouvrir <ExternalLink size={11} />
              </a>
            )}
          </div>
        </div>
      );
    })}
  </div>
);

// ─── Section: Tip ────────────────────────────────────────────────────────────
const TipSection = ({ title, text }) => (
  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
    {title && <p className="text-emerald-700 font-bold text-xs mb-1">{title}</p>}
    <p className="text-emerald-600 text-xs leading-relaxed">{text}</p>
  </div>
);

// ─── Section: Warning ────────────────────────────────────────────────────────
const WarningSection = ({ text }) => (
  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
    <p className="text-amber-700 text-xs leading-relaxed flex items-start gap-2">
      <AlertTriangle size={14} className="shrink-0 mt-0.5" /> {text}
    </p>
  </div>
);

// ─── Section: Table ──────────────────────────────────────────────────────────
const TableSection = ({ title, headers, rows }) => (
  <div className="rounded-xl border border-gray-200 overflow-hidden">
    {title && (
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
        <p className="text-xs font-bold text-gray-700">{title}</p>
      </div>
    )}
    {headers && (
      <div className="grid gap-0 border-b border-gray-200" style={{ gridTemplateColumns: `repeat(${headers.length}, 1fr)` }}>
        {headers.map((h, i) => (
          <div key={i} className="px-3 py-2 bg-gray-50 text-[10px] font-bold text-gray-600 uppercase tracking-wide border-r border-gray-100 last:border-r-0">{h}</div>
        ))}
      </div>
    )}
    <div className="divide-y divide-gray-100">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-2.5">
          <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-medium text-gray-700">{row.label}</p>
            {row.desc && <p className="text-[11px] text-gray-400 mt-0.5">{row.desc}</p>}
          </div>
          {row.extra && <span className="text-[10px] text-gray-400">{row.extra}</span>}
        </div>
      ))}
    </div>
  </div>
);

// ─── Section: Grid ───────────────────────────────────────────────────────────
const GridSection = ({ items }) => (
  <div className="grid grid-cols-2 gap-3">
    {items.map((item, i) => {
      const c = item.color ? getColor(item.color) : getColor('slate');
      return (
        <div key={i} className={`p-3.5 rounded-xl border ${c.border} ${c.bg}`}>
          <p className="text-xs font-bold text-gray-800 mb-1">{item.title}</p>
          <p className="text-[11px] text-gray-500 leading-relaxed">{item.text}</p>
        </div>
      );
    })}
  </div>
);

// ─── Section: Prompt (bloc copiable pour IA) ─────────────────────────────────
const PromptSection = ({ title = 'Prompt IA', intro, text, color = 'indigo' }) => {
  const c = getColor(color);
  const [copied, setCopied] = React.useState(false);
  const handleCopy = () => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(text || '').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };
  return (
    <div className={`rounded-xl border ${c.border} overflow-hidden`}>
      <div className={`flex items-center justify-between px-4 py-2.5 ${c.bg} border-b ${c.border}`}>
        <p className={`text-xs font-bold ${c.text} flex items-center gap-1.5`}>
          <MessageSquare size={13} /> {title}
        </p>
        <button
          onClick={handleCopy}
          className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-colors ${
            copied ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : `bg-white ${c.text} ${c.border} hover:${c.bg}`
          }`}
        >
          {copied ? <><CheckCircle2 size={12} /> Copié</> : <><Copy size={12} /> Copier</>}
        </button>
      </div>
      {intro && <p className="px-4 pt-3 text-xs text-gray-500 leading-relaxed">{intro}</p>}
      <pre className="px-4 py-3 text-[11px] text-gray-700 font-mono whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">{text}</pre>
    </div>
  );
};

// ─── Section: Shortcuts ──────────────────────────────────────────────────────
const ShortcutsSection = ({ items }) => (
  <div className="rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
    {items.map((item, i) => (
      <div key={i} className="flex items-center gap-4 px-4 py-2.5">
        <kbd className="shrink-0 px-2.5 py-1 bg-gray-100 border border-gray-300 rounded-md font-mono text-[11px] text-gray-700 shadow-sm whitespace-nowrap">
          {item.key}
        </kbd>
        <span className="text-xs text-gray-600">{item.desc}</span>
      </div>
    ))}
  </div>
);

// ─── Section Router ──────────────────────────────────────────────────────────
const SectionRenderer = ({ section }) => {
  switch (section.type) {
    case 'intro':     return <IntroSection text={section.text} />;
    case 'card':      return <CardSection {...section} />;
    case 'steps':     return <StepsSection items={section.items} />;
    case 'tip':       return <TipSection title={section.title} text={section.text} />;
    case 'warning':   return <WarningSection text={section.text} />;
    case 'table':     return <TableSection title={section.title} headers={section.headers} rows={section.rows} />;
    case 'grid':      return <GridSection items={section.items} />;
    case 'shortcuts': return <ShortcutsSection items={section.items} />;
    case 'prompt':    return <PromptSection title={section.title} intro={section.intro} text={section.text} color={section.color} />;
    default:          return null;
  }
};

const HelpSections = ({ sections }) => (
  <div className="space-y-4">
    {sections.map((section, i) => (
      <SectionRenderer key={i} section={section} />
    ))}
  </div>
);

export { getIcon, getColor, ICON_MAP };
export default HelpSections;
