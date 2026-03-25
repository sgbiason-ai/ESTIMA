import React, { useState } from 'react';
import { GripVertical, Trash2 } from 'lucide-react';
import { UNIT_MAPPING } from '../../constants/data';
import { formatPrice, normalizeUnitSymbol } from '../../utils/helpers';

const TaskRow = ({ item, index, prefix, containerId, updateProjectItem, onDeleteClick, dragHandlers, level }) => {
  const [isEditingPrice, setIsEditingPrice] = useState(false);

  return (
    <tr 
      className="border-b border-slate-50 hover:bg-blue-50/30 group transition-colors"
      draggable
      onDragStart={(e) => dragHandlers.onStart(e, { type: 'item', index, containerId })}
      onDragEnter={(e) => dragHandlers.onEnter(e, { type: 'item', index, containerId })}
      onDragOver={dragHandlers.onOver}
      onDrop={dragHandlers.onDrop}
    >
      <td className="p-2 w-8 text-center cursor-move text-slate-300 hover:text-blue-500 align-middle">
        <GripVertical size={16} />
      </td>
      <td className="p-2 pl-2 w-16 font-bold text-slate-400 text-sm align-middle">{prefix}.{index + 1}</td>
      
      <td className="p-2 align-middle">
        <div className={`text-sm font-medium text-slate-700 ${level === 2 ? 'pl-4' : ''}`}>
          {item.designation}
        </div>
      </td>

      <td className="p-2 text-center text-xs font-bold text-slate-500 align-middle" title={UNIT_MAPPING[item.unit]}>
        {normalizeUnitSymbol(item.unit)}
      </td>

      <td className="p-2 text-right align-middle">
        <input 
          type="number" 
          step="0.01"
          value={item.qty} 
          onChange={(e) => updateProjectItem(containerId, item.uid, 'qty', e.target.value)}
          className="w-20 text-right border rounded px-1 text-sm bg-yellow-50 border-yellow-200 focus:ring-1 focus:ring-blue-500 outline-none appearance-none"
        />
      </td>

      <td className="p-2 text-right text-sm align-middle w-32" onClick={() => setIsEditingPrice(true)}>
        {isEditingPrice ? (
          <input 
            autoFocus
            type="number" 
            step="0.01"
            value={item.price} 
            onChange={(e) => updateProjectItem(containerId, item.uid, 'price', e.target.value)}
            onBlur={() => setIsEditingPrice(false)}
            onKeyDown={(e) => e.key === 'Enter' && setIsEditingPrice(false)}
            className="w-full text-right border rounded px-1 text-sm text-slate-600 bg-white focus:ring-1 focus:ring-blue-500 outline-none"
          />
        ) : (
          <div className="cursor-pointer hover:bg-slate-100 rounded px-1 py-0.5 transition-all text-slate-600">
            {formatPrice(item.price)}
          </div>
        )}
      </td>

      <td className="p-2 text-right text-sm font-bold text-blue-800 align-middle">
        {formatPrice(item.price * item.qty)}
      </td>

      <td className="p-2 text-center align-middle">
        <button onClick={() => onDeleteClick({ type: 'item', id: item.uid, parentId: containerId })} className="text-slate-300 hover:text-red-500">
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  );
};

export default TaskRow;