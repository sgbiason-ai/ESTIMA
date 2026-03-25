import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { UNIT_OPTIONS, UNIT_MAPPING } from '../../constants/data';
import RichTextEditor from '../common/RichTextEditor';

const BpuRow = ({ item, updateBpuItem, deleteFromBpu }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <>
      <tr className="border-b border-slate-100 hover:bg-blue-50/50">
        <td className="p-3 align-top">
          <input 
            value={item.code} 
            onChange={(e) => updateBpuItem(item.id, 'code', e.target.value)}
            className="w-full bg-slate-50 border border-transparent focus:bg-white focus:border-blue-300 rounded px-2 py-1 font-mono text-sm text-blue-600 font-bold"
          />
        </td>
        <td className="p-3 align-top">
          <div className="flex flex-col gap-2">
            <input 
              value={item.designation} 
              onChange={(e) => updateBpuItem(item.id, 'designation', e.target.value)}
              className="w-full bg-transparent border border-transparent focus:bg-white focus:border-blue-300 rounded px-2 py-1 font-medium text-slate-700"
            />
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs text-blue-500 flex items-center gap-1 hover:text-blue-700 w-fit font-medium"
            >
              {isExpanded ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
              {isExpanded ? "Fermer le descriptif" : "Ouvrir le descriptif"}
            </button>
          </div>
        </td>
        <td className="p-3 align-top">
          <select 
            value={item.unit}
            onChange={(e) => updateBpuItem(item.id, 'unit', e.target.value)}
            className="w-full bg-slate-100 border-none rounded px-2 py-1 text-sm text-slate-600"
          >
            {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
          <div className="text-[10px] text-slate-400 mt-1 pl-1">{UNIT_MAPPING[item.unit]}</div>
        </td>
        <td className="p-3 text-right align-top">
          <input 
            type="number" value={item.price} 
            onChange={(e) => updateBpuItem(item.id, 'price', parseFloat(e.target.value))}
            className="w-full text-right bg-transparent border border-transparent focus:bg-white focus:border-blue-300 rounded px-2 py-1 font-bold text-slate-800"
          />
        </td>
        <td className="p-3 text-center align-top">
          <button onClick={() => deleteFromBpu(item.id)} className="text-slate-300 hover:text-red-500 p-2 rounded hover:bg-red-50 transition-colors">
            <Trash2 size={16} />
          </button>
        </td>
      </tr>
      
      {isExpanded && (
        <tr className="bg-slate-50/30 border-b border-slate-100">
          <td></td>
          <td colSpan="4" className="p-4 pt-0 pb-6">
            <div className="mb-1 flex items-center gap-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Descriptif Technique (CCTP)</label>
              <div className="h-px bg-slate-200 flex-1"></div>
            </div>
            <RichTextEditor 
              key={item.id} 
              initialValue={item.description} 
              onSave={(newVal) => updateBpuItem(item.id, 'description', newVal)}
            />
          </td>
        </tr>
      )}
    </>
  );
};

export default BpuRow;