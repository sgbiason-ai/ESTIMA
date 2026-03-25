import React from 'react';
import { GripVertical, Trash2 } from 'lucide-react';

const ChapterRow = ({ chapter, index, isSelected, onClick, onAddSub, onDelete, onTitleChange, dragHandlers }) => (
  <tr 
    className={`border-b-2 border-t-2 transition-colors ${isSelected ? 'bg-blue-50/50 border-blue-200' : 'bg-slate-100 border-slate-200'}`}
    onClick={onClick}
    draggable
    onDragStart={(e) => dragHandlers.onStart(e, { type: 'chapter', index })}
    onDragEnter={(e) => dragHandlers.onEnter(e, { type: 'chapter', index })}
    onDragOver={dragHandlers.onOver}
    onDrop={dragHandlers.onDrop}
  >
    <td className="p-2 w-8 text-center cursor-move text-slate-400 hover:text-blue-600 align-middle">
      <GripVertical size={20} />
    </td>
    <td className="p-2 pl-2 w-16 font-bold text-slate-800 text-lg align-middle">
      <span className="bg-slate-800 text-white w-8 h-8 flex items-center justify-center rounded-lg text-sm shadow-sm">{index + 1}</span>
    </td>
    <td className="p-2 align-middle" colSpan="4">
      <input 
        value={chapter.title}
        onChange={onTitleChange}
        className="bg-transparent outline-none w-full font-bold text-lg text-slate-800"
      />
    </td>
    <td className="p-2 text-center align-middle whitespace-nowrap" colSpan="2">
      <div className="flex justify-end gap-2 pr-2">
        <button onClick={(e) => { e.stopPropagation(); onAddSub(); }} className="text-xs bg-white border border-slate-300 px-2 py-1 rounded hover:bg-blue-50 hover:text-blue-600 font-semibold shadow-sm">+ S.Chap</button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-slate-400 hover:text-red-500"><Trash2 size={18}/></button>
      </div>
    </td>
  </tr>
);

export default ChapterRow;