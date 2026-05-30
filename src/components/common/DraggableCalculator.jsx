import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, GripHorizontal } from 'lucide-react';
import { safeEvalMathExpr } from '../../utils/projectCalculations';

// Fonction de calcul sécurisée (parseur mathématique sans eval)
const safeCalculate = (expression) => {
  try {
    const sanitized = String(expression)
      .replace(/x/g, '*')
      .replace(/,/g, '.')
      .replace(/[^-()\d/*+.]/g, '');

    if (!sanitized) return '';

    const result = safeEvalMathExpr(sanitized);

    if (!isFinite(result) || isNaN(result)) return 'Erreur';

    return result;
  } catch {
    return 'Erreur';
  }
};

const DraggableCalculator = ({ isOpen, onClose }) => {
  const [display, setDisplay] = useState('0');
  const [equation, setEquation] = useState('');
  const [showVrdTools, setShowVrdTools] = useState(false);
  
  // Position initiale
  const [position, setPosition] = useState({ x: window.innerWidth / 2 - 150, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // --- LOGIQUE DE DÉPLACEMENT ---
  const handleMouseDown = (e) => {
    setIsDragging(true);
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      setPosition({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y
      });
    };
    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // --- LOGIQUE CALCULATRICE ---
  const handlePress = useCallback((val) => {
    if (val === 'C') {
      setDisplay('0');
      setEquation('');
    } else if (val === 'BACK') {
        setDisplay(prev => prev.length > 1 ? prev.slice(0, -1) : '0');
    } else if (val === '=') {
      try {
        const res = safeCalculate(equation + display).toString(); 
        setDisplay(res);
        setEquation('');
      } catch {
        setDisplay('Erreur');
      }
    } else if (['+', '-', '*', '/'].includes(val)) {
      setEquation(display + ' ' + val + ' ');
      setDisplay('0');
    } else {
      setDisplay(prev => prev === '0' ? val : prev + val);
    }
  }, [display, equation]);

  // --- FONCTIONS MÉTIER VRD ---
  const applyMultiplier = (factor, label) => {
    try {
        let currentVal = parseFloat(display);
        if (equation) {
            const calculated = safeCalculate(equation + display);
            if (calculated !== 'Erreur') {
                currentVal = parseFloat(calculated);
            }
        }
        
        const result = (currentVal * factor).toFixed(2);
        setDisplay(result.toString());
        setEquation(`${currentVal} x ${factor} (${label}) = `);
    } catch {
        setDisplay('Erreur');
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      const key = e.key;
      if (key === 'Escape') onClose();
      if (key === 'Enter') { e.preventDefault(); handlePress('='); }
      if (key === 'Backspace') handlePress('BACK');
      if (key.toLowerCase() === 'c') handlePress('C');
      if (['+', '-', '*', '/'].includes(key)) handlePress(key);
      if (/[0-9]/.test(key)) handlePress(key);
      if (key === ',' || key === '.') handlePress('.');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handlePress, onClose]);

  if (!isOpen) return null;

  const buttons = [
    '7', '8', '9', '/',
    '4', '5', '6', '*',
    '1', '2', '3', '-',
    'C', '0', '=', '+'
  ];

  return (
    <div 
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      className="fixed z-modal shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-2xl overflow-hidden flex flex-col w-80"
    >
      <div className="bg-[#0f172a] border border-emerald-500/30 p-4 w-full backdrop-blur-md bg-opacity-95">
        
        {/* HEADER DRAGGABLE */}
        <div 
          className="flex justify-between items-center mb-4 cursor-move select-none active:cursor-grabbing pb-2 border-b border-white/10"
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center gap-2 text-emerald-400">
             <GripHorizontal size={16} />
             <h3 className="font-bold uppercase tracking-widest text-xs">Calc VRD</h3>
          </div>
          <div className="flex items-center gap-2">
            <button 
                onClick={() => setShowVrdTools(!showVrdTools)}
                className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider border transition-all ${showVrdTools ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-slate-800 text-slate-400 border-slate-600 hover:text-white'}`}
            >
                {showVrdTools ? 'Masquer' : 'Outils VRD'}
            </button>
            <button onClick={onClose} className="text-slate-500 hover:text-white" onMouseDown={(e) => e.stopPropagation()}>
                <X size={16} />
            </button>
          </div>
        </div>

        {/* --- PANNEAU OUTILS VRD (PERSONNALISÉ) --- */}
        {showVrdTools && (
            <div className="mb-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
                {/* Section Matériaux */}
                <div>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 pl-1">Matériaux (T/m³)</p>
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => applyMultiplier(2.0, 'GNT 0/80')} className="flex items-center justify-between px-2 py-1.5 bg-amber-900/20 border border-amber-700/30 rounded hover:bg-amber-900/40 text-amber-500 text-xs font-mono group">
                            <span>GNT 0/80</span> <span className="text-amber-700 group-hover:text-amber-500">x2.0</span>
                        </button>
                        <button onClick={() => applyMultiplier(2.2, 'GNT 0/20')} className="flex items-center justify-between px-2 py-1.5 bg-amber-900/20 border border-amber-700/30 rounded hover:bg-amber-900/40 text-amber-500 text-xs font-mono group">
                            <span>GNT 0/20</span> <span className="text-amber-700 group-hover:text-amber-500">x2.20</span>
                        </button>
                        <button onClick={() => applyMultiplier(2.4, 'GB')} className="flex items-center justify-between px-2 py-1.5 bg-slate-800 border border-slate-600 rounded hover:bg-slate-700 text-slate-300 text-xs font-mono group">
                            <span>GB</span> <span className="text-slate-500 group-hover:text-slate-300">x2.4</span>
                        </button>
                        <button onClick={() => applyMultiplier(2.45, 'BB')} className="flex items-center justify-between px-2 py-1.5 bg-slate-900 border border-black rounded hover:bg-black text-slate-200 text-xs font-mono group">
                            <span>BB</span> <span className="text-slate-500 group-hover:text-slate-300">x2.45</span>
                        </button>
                    </div>
                </div>

                {/* Section Divers (Conservation Foisonnement/TVA) */}
                <div>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 pl-1">Divers</p>
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => applyMultiplier(1.3, 'Foisonné')} className="flex items-center justify-between px-2 py-1.5 bg-emerald-900/20 border border-emerald-700/30 rounded hover:bg-emerald-900/40 text-emerald-500 text-xs font-mono">
                            <span>Foisonn.</span> <span>x1.3</span>
                        </button>
                        <button onClick={() => applyMultiplier(1.2, 'TTC')} className="flex items-center justify-between px-2 py-1.5 bg-blue-900/20 border border-blue-700/30 rounded hover:bg-blue-900/40 text-blue-400 text-xs font-mono">
                            <span>TVA</span> <span>x1.2</span>
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* ÉCRAN */}
        <div className="bg-black/40 p-4 rounded-xl mb-4 text-right border border-white/5">
          <div className="text-slate-500 text-xs h-4 truncate">{equation}</div>
          <div className="text-2xl font-mono text-white truncate tracking-wider">{display}</div>
        </div>

        {/* CLAVIER */}
        <div className="grid grid-cols-4 gap-2">
          {buttons.map((btn) => (
            <button
              key={btn}
              onClick={() => handlePress(btn)}
              className={`h-10 rounded-lg font-bold transition-all shadow-sm ${
                btn === '=' ? 'bg-emerald-600 text-white hover:bg-emerald-500 col-span-1 shadow-emerald-900/20' :
                btn === 'C' ? 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20' :
                ['+', '-', '*', '/'].includes(btn) ? 'bg-slate-700 text-emerald-400 hover:bg-slate-600' :
                'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-white/5'
              }`}
            >
              {btn}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DraggableCalculator;