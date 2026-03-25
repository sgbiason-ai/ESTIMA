import React from 'react';
import { GripVertical, Trash2, CheckCircle2, CircleDashed } from 'lucide-react';

// --- COMPOSANT BOUTON OPTION (High Contrast forcé) ---
const OptionToggle = ({ isOption, onClick, disabled }) => (
  <button
    disabled={disabled}
    onClick={(e) => {
      e.stopPropagation();
      if (!disabled) onClick();
    }}
    className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide transition-all border shrink-0 
    ${disabled ? 'opacity-50 cursor-default' : 'cursor-pointer'}
    ${isOption 
        // CAS OPTION : Gris Foncé (Slate-700) sur texte Blanc (High Contrast)
        ? 'bg-slate-700 text-white border-slate-600 hover:bg-slate-600' 
        // CAS BASE : Vert Foncé (Emerald-700) sur texte Blanc (High Contrast)
        : 'bg-emerald-700 text-white border-emerald-800 hover:bg-emerald-600'
    }`}
    title={disabled ? '' : isOption ? 'Inclure dans Base' : 'Mettre en Option'}
  >
    {isOption ? <CircleDashed size={10} /> : <CheckCircle2 size={10} />} {isOption ? 'Option' : 'Base'}
  </button>
);

const SubChapterRow = ({ 
  subChapter, 
  index, 
  parentIndex, 
  isSelected, 
  onClick, 
  onDelete, 
  onTitleChange, 
  onToggleOption, // <--- NOUVELLE PROP REQUISE
  dragHandlers, 
  parentId 
}) => {
  const prefix = `${parentIndex + 1}.${index + 1}`;
  
  return (
    <tr 
      className={`border-b border-slate-200 transition-colors ${isSelected ? 'bg-blue-50/30' : 'bg-slate-50/50'}`}
      onClick={onClick}
      draggable
      onDragStart={(e) => dragHandlers.onStart(e, { type: 'subchapter', index, parentId, id: subChapter.id })}
      onDragEnter={(e) => dragHandlers.onEnter(e, { type: 'subchapter', index, parentId })}
      onDragOver={dragHandlers.onOver}
      onDrop={dragHandlers.onDrop}
    >
      <td className="p-2 w-8 text-center cursor-move text-slate-300 hover:text-blue-500 align-middle">
        <GripVertical size={16} />
      </td>
      <td className="p-2 pl-2 w-16 font-bold text-slate-500 text-sm align-middle">{prefix}</td>
      
      {/* Zone Titre + Bouton Option */}
      <td className="p-2 align-middle" colSpan="4">
        <div className="flex items-center gap-3">
          <input 
            value={subChapter.title}
            onChange={onTitleChange}
            // J'ai ajouté text-black ici pour forcer le titre en noir pur comme demandé
            className="bg-transparent outline-none w-full font-bold text-black pl-2"
          />
          
          {/* Ajout du bouton Option ici */}
          <OptionToggle 
            isOption={subChapter.isOption} 
            onClick={onToggleOption} 
          />
        </div>
      </td>

      <td className="p-2 text-center align-middle" colSpan="2">
        <div className="flex justify-end pr-2">
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 size={14}/></button>
        </div>
      </td>
    </tr>
  );
};

export default SubChapterRow;