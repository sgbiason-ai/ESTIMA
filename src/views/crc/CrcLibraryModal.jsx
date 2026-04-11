// src/views/crc/CrcLibraryModal.jsx
// Modal bibliothèque de participants CRC — import/export Excel, tri, sélection
import React, { useState, useRef } from 'react';
import {
  Plus, Trash2, X, Check, Edit3, Info, BookUser, Upload, Download, UserPlus, Copy,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from '../../utils/globalUI';

export default function CrcLibraryModal({ isOpen, onClose, contacts, onSave, onImportToChantier, hasChantier, participantGroups }) {
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [filter, setFilter] = useState('');
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [showHelp, setShowHelp] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [groupMapping, setGroupMapping] = useState({});
  const fileRef = useRef(null);

  if (!isOpen) return null;

  const toggleSort = (col) => {
    if (sortCol === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const filtered = (() => {
    let list = filter
      ? contacts.filter((c) =>
          [c.subLabel, c.name, c.email, c.phone].join(' ').toLowerCase().includes(filter.toLowerCase())
        )
      : [...contacts];
    if (sortCol) {
      list.sort((a, b) => {
        const va = (a[sortCol] || '').toLowerCase();
        const vb = (b[sortCol] || '').toLowerCase();
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      });
    }
    return list;
  })();

  const toggleSelect = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((c) => c.id)));
    }
  };

  const allFilteredSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));

  const openImportPanel = () => {
    const selectedContacts = contacts.filter((c) => selected.has(c.id));
    if (selectedContacts.length === 0) return;
    const mapping = {};
    for (const c of selectedContacts) {
      const match = (participantGroups || []).find(
        (g) => (g.subLabel && g.subLabel === c.subLabel) || g.name === c.subLabel
      );
      mapping[c.id] = match?.id || (participantGroups?.[0]?.id || '');
    }
    setGroupMapping(mapping);
    setShowImportPanel(true);
  };

  const confirmImport = () => {
    const items = contacts
      .filter((c) => selected.has(c.id) && groupMapping[c.id])
      .map((c) => ({ contact: c, targetGroupId: groupMapping[c.id] }));
    if (items.length > 0) onImportToChantier(items);
    setShowImportPanel(false);
    setSelected(new Set());
  };

  const handleAdd = () => {
    const newContact = {
      id: `lib_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      subLabel: '', name: '', email: '', phone: '',
    };
    onSave([...contacts, newContact]);
    setEditingId(newContact.id);
    setEditData(newContact);
  };

  const handleSaveEdit = () => {
    onSave(contacts.map((c) => (c.id === editingId ? { ...c, ...editData } : c)));
    setEditingId(null);
  };

  const handleDelete = (id) => {
    onSave(contacts.filter((c) => c.id !== id));
  };

  const findCol = (row, ...candidates) => {
    const keys = Object.keys(row);
    for (const cand of candidates) {
      const norm = cand.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const found = keys.find((k) =>
        k.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === norm
      );
      if (found && row[found] !== undefined && row[found] !== null) return String(row[found]);
    }
    return '';
  };

  const handleExcelImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      toast.error('Format non supporte. Utilisez un fichier .xlsx, .xls ou .csv');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      toast.error('Impossible de lire le fichier. Verifiez qu\'il n\'est pas corrompu.');
      e.target.value = '';
    };
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array' });
        if (!wb.SheetNames.length) {
          toast.error('Le fichier Excel ne contient aucune feuille.');
          return;
        }
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);

        if (data.length === 0) {
          toast.warning('Le fichier est vide ou ne contient aucune ligne de donnees.');
          return;
        }

        const firstRowKeys = Object.keys(data[0]);
        if (firstRowKeys.length < 2) {
          toast.error('Le fichier doit contenir au moins 2 colonnes (Sous-label, NOM Prenom).');
          return;
        }

        const usePositional = firstRowKeys.every(
          (k) => k.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
            .search(/sous|label|nom|prenom|mail|email|tel|phone/) === -1
        );

        if (usePositional) {
          toast.info(`En-tetes non reconnus — import par position des colonnes (${firstRowKeys.length} colonnes detectees).`);
        }

        const imported = data
          .map((row, i) => {
            if (usePositional) {
              const vals = firstRowKeys.map((k) => String(row[k] || ''));
              return {
                id: `lib_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 4)}`,
                subLabel: vals[0] || '',
                name: vals[1] || '',
                phone: vals[2] || '',
                email: vals[3] || '',
              };
            }
            return {
              id: `lib_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 4)}`,
              subLabel: findCol(row, 'Sous-label', 'Sous label', 'SubLabel', 'Label'),
              name: findCol(row, 'NOM Prenom', 'NOM Prénom', 'Nom Prenom', 'Nom Prénom', 'Nom', 'Name', 'Contact'),
              phone: findCol(row, 'Telephone', 'Téléphone', 'Tel', 'Phone'),
              email: findCol(row, 'Email', 'Mail', 'E-mail'),
            };
          })
          .filter((c) => c.name || c.email);

        const skipped = data.length - imported.length;

        if (imported.length === 0) {
          toast.warning(`Aucun contact valide trouve dans les ${data.length} ligne(s). Chaque ligne doit avoir au moins un nom ou un email.`);
          return;
        }

        const norm = (s) => (s || '').trim().toLowerCase();
        const existingEmails = new Set(contacts.filter((c) => c.email).map((c) => norm(c.email)));
        const existingNames = new Set(contacts.filter((c) => c.name && !c.email).map((c) => norm(c.name)));

        const seenEmails = new Set();
        const seenNames = new Set();
        const uniqueImported = imported.filter((c) => {
          if (c.email && existingEmails.has(norm(c.email))) return false;
          if (!c.email && c.name && existingNames.has(norm(c.name))) return false;
          if (c.email) {
            const e = norm(c.email);
            if (seenEmails.has(e)) return false;
            seenEmails.add(e);
          } else if (c.name) {
            const n = norm(c.name);
            if (seenNames.has(n)) return false;
            seenNames.add(n);
          }
          return true;
        });

        const duplicateCount = imported.length - uniqueImported.length;
        onSave([...contacts, ...uniqueImported]);
        const parts = [];
        if (uniqueImported.length > 0) parts.push(`${uniqueImported.length} contact(s) importe(s)`);
        if (duplicateCount > 0) parts.push(`${duplicateCount} doublon(s) ignore(s)`);
        if (skipped > 0) parts.push(`${skipped} ligne(s) sans nom ni email`);
        toast.success(parts.join('. ') + '.');
      } catch (err) {
        console.error('Erreur import Excel:', err);
        toast.error(`Erreur lors de la lecture du fichier : ${err.message || 'format invalide'}`);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleRemoveDuplicates = () => {
    const norm = (s) => (s || '').trim().toLowerCase();
    const seenEmails = new Set();
    const seenNames = new Set();
    const unique = [];
    for (const c of contacts) {
      if (c.email) {
        const e = norm(c.email);
        if (seenEmails.has(e)) continue;
        seenEmails.add(e);
      } else if (c.name) {
        const n = norm(c.name);
        if (seenNames.has(n)) continue;
        seenNames.add(n);
      }
      unique.push(c);
    }
    const removed = contacts.length - unique.length;
    if (removed === 0) {
      toast.info('Aucun doublon detecte.');
      return;
    }
    onSave(unique);
    toast.success(`${removed} doublon(s) supprime(s).`);
  };

  const handleExcelExport = () => {
    const data = contacts.map((c) => ({
      'Sous-label': c.subLabel || '',
      'NOM Prenom': c.name || '',
      'Telephone': c.phone || '',
      'Email': c.email || '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{ wch: 25 }, { wch: 25 }, { wch: 16 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Participants');
    XLSX.writeFile(wb, 'bibliotheque_participants.xlsx');
    toast.success(`${contacts.length} contact(s) exporte(s) dans bibliotheque_participants.xlsx`);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center" onMouseDown={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[900px] max-h-[85vh] overflow-hidden flex flex-col" onMouseDown={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-violet-50 to-purple-50 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-100">
                <BookUser size={18} className="text-violet-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Bibliotheque de participants</h3>
                <p className="text-[10px] text-slate-500">{contacts.length} contact{contacts.length > 1 ? 's' : ''} enregistre{contacts.length > 1 ? 's' : ''}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={16} className="text-slate-400" /></button>
          </div>
        </div>

        {/* Ruban Office-style */}
        <div className="flex items-end gap-1 px-4 py-2 border-b border-slate-200 bg-gradient-to-b from-white to-slate-50 shrink-0">
          {/* Recherche */}
          <div className="flex flex-col items-center mr-1">
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Rechercher..."
              className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 w-40 text-slate-800"
            />
            {sortCol && (
              <button onClick={() => { setSortCol(null); setSortDir('asc'); }}
                className="text-[9px] text-slate-400 hover:text-red-500 mt-0.5 transition-colors">
                Reinitialiser tri
              </button>
            )}
          </div>

          <div className="w-px bg-slate-200 self-stretch my-1 mx-1" />

          {/* Groupe : Contacts */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-0.5">
              <button onClick={handleAdd}
                className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-violet-50 text-violet-600 hover:text-violet-700 transition-all min-w-[56px]">
                <Plus size={20} />
                <span className="text-[9px] font-semibold leading-tight whitespace-nowrap">Ajouter</span>
              </button>
              <button onClick={handleRemoveDuplicates} disabled={contacts.length < 2}
                className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-all min-w-[56px] ${
                  contacts.length < 2 ? 'opacity-40 cursor-not-allowed text-red-400' : 'hover:bg-red-50 text-red-500 hover:text-red-600'
                }`}>
                <Copy size={20} />
                <span className="text-[9px] font-semibold leading-tight whitespace-nowrap">Doublons</span>
              </button>
            </div>
            <span className="text-[8px] text-slate-400 font-medium uppercase tracking-wider mt-0.5">Contacts</span>
          </div>

          <div className="w-px bg-slate-200 self-stretch my-1 mx-1" />

          {/* Groupe : Excel */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-0.5">
              <button onClick={() => fileRef.current?.click()}
                className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 hover:text-emerald-700 transition-all min-w-[56px]">
                <Upload size={20} />
                <span className="text-[9px] font-semibold leading-tight whitespace-nowrap">Import</span>
              </button>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleExcelImport} />
              <button onClick={handleExcelExport} disabled={contacts.length === 0}
                className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-all min-w-[56px] ${
                  contacts.length === 0 ? 'opacity-40 cursor-not-allowed text-blue-400' : 'hover:bg-blue-50 text-blue-600 hover:text-blue-700'
                }`}>
                <Download size={20} />
                <span className="text-[9px] font-semibold leading-tight whitespace-nowrap">Export</span>
              </button>
              <button onClick={() => setShowHelp(!showHelp)}
                className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-all min-w-[56px] ${
                  showHelp ? 'bg-slate-200 text-slate-700 shadow-inner' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-700'
                }`}>
                <Info size={20} />
                <span className="text-[9px] font-semibold leading-tight whitespace-nowrap">Aide</span>
              </button>
            </div>
            <span className="text-[8px] text-slate-400 font-medium uppercase tracking-wider mt-0.5">Excel</span>
          </div>

          {hasChantier && (
            <>
              <div className="w-px bg-slate-200 self-stretch my-1 mx-1" />

              {/* Groupe : Chantier */}
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-0.5">
                  <button onClick={openImportPanel} disabled={selected.size === 0}
                    className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-all min-w-[56px] ${
                      selected.size === 0 ? 'opacity-40 cursor-not-allowed text-amber-400' : 'hover:bg-amber-50 text-amber-600 hover:text-amber-700'
                    }`}>
                    <UserPlus size={20} />
                    <span className="text-[9px] font-semibold leading-tight whitespace-nowrap">
                      Importer{selected.size > 0 ? ` (${selected.size})` : ''}
                    </span>
                  </button>
                </div>
                <span className="text-[8px] text-slate-400 font-medium uppercase tracking-wider mt-0.5">Chantier</span>
              </div>
            </>
          )}
        </div>

        {/* Aide import */}
        {showHelp && (
          <div className="px-5 py-3 border-b border-slate-200 bg-amber-50 shrink-0">
            <div className="flex items-start gap-3">
              <Info size={14} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="text-[11px] text-slate-700 space-y-1.5">
                <p className="font-bold text-slate-800">Format attendu du fichier Excel :</p>
                <div className="overflow-x-auto">
                  <table className="text-[10px] border border-slate-300 rounded">
                    <thead>
                      <tr className="bg-slate-200 text-slate-600">
                        <th className="px-3 py-1 border-r border-slate-300 text-left font-bold">Sous-label</th>
                        <th className="px-3 py-1 border-r border-slate-300 text-left font-bold">NOM Prenom</th>
                        <th className="px-3 py-1 border-r border-slate-300 text-left font-bold">Telephone</th>
                        <th className="px-3 py-1 text-left font-bold">Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="text-slate-500">
                        <td className="px-3 py-1 border-r border-t border-slate-200">MOE</td>
                        <td className="px-3 py-1 border-r border-t border-slate-200">DUPONT Jean</td>
                        <td className="px-3 py-1 border-r border-t border-slate-200">06 12 34 56 78</td>
                        <td className="px-3 py-1 border-t border-slate-200">j.dupont@mail.fr</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
                  <li>Formats acceptes : <span className="font-semibold">.xlsx</span>, <span className="font-semibold">.xls</span>, <span className="font-semibold">.csv</span></li>
                  <li>La 1ere ligne doit contenir les en-tetes (noms ci-dessus, accents facultatifs)</li>
                  <li>Si les en-tetes ne sont pas reconnus, les colonnes seront mappees par position (col 1 = Sous-label, col 2 = Nom, col 3 = Tel, col 4 = Email)</li>
                  <li>Les lignes sans nom ni email sont ignorees</li>
                  <li>Le <span className="font-semibold">Sous-label</span> sert a grouper les participants (ex: MOE, MOA, Entreprise...)</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Panneau d'import avec mapping de groupes */}
        {showImportPanel && (
          <div className="border-b border-amber-200 bg-amber-50 shrink-0">
            <div className="px-5 py-3 flex items-center justify-between border-b border-amber-200">
              <div className="flex items-center gap-2">
                <UserPlus size={14} className="text-amber-600" />
                <span className="text-xs font-bold text-amber-800">Affecter les {selected.size} contact(s) aux groupes du chantier</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowImportPanel(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition-all">
                  Annuler
                </button>
                <button onClick={confirmImport}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-all">
                  <Check size={12} /> Confirmer l'import
                </button>
              </div>
            </div>
            <div className="px-5 py-3 max-h-[200px] overflow-y-auto space-y-1.5">
              {contacts.filter((c) => selected.has(c.id)).map((c) => (
                <div key={c.id} className="flex items-center gap-3 text-xs">
                  <span className="w-32 truncate font-medium text-slate-700">{c.name || c.email}</span>
                  <span className="text-slate-400">→</span>
                  <select
                    value={groupMapping[c.id] || ''}
                    onChange={(e) => setGroupMapping({ ...groupMapping, [c.id]: e.target.value })}
                    className="flex-1 max-w-[250px] px-2 py-1 border border-amber-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-amber-400 text-slate-800"
                  >
                    <option value="" disabled>Choisir un groupe...</option>
                    {(participantGroups || []).map((g) => (
                      <option key={g.id} value={g.id}>{g.name}{g.subLabel ? ` (${g.subLabel})` : ''}</option>
                    ))}
                  </select>
                  {c.subLabel && <span className="text-[10px] text-slate-400 italic">{c.subLabel}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-100 z-10">
              <tr className="text-[10px] text-slate-500 uppercase tracking-wider">
                {hasChantier && (
                  <th className="px-2 py-2 w-8">
                    <input type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAll}
                      className="w-3.5 h-3.5 rounded border-slate-300 text-amber-500 focus:ring-amber-400 cursor-pointer" />
                  </th>
                )}
                <th className="text-left px-3 py-2 font-semibold cursor-pointer select-none hover:text-violet-600 transition-colors" onClick={() => toggleSort('subLabel')}>
                  Sous-label {sortCol === 'subLabel' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th className="text-left px-3 py-2 font-semibold cursor-pointer select-none hover:text-violet-600 transition-colors" onClick={() => toggleSort('name')}>
                  NOM Prenom {sortCol === 'name' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th className="text-left px-3 py-2 font-semibold">Telephone</th>
                <th className="text-left px-3 py-2 font-semibold">Email</th>
                <th className="px-2 py-2 w-16" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={hasChantier ? 6 : 5} className="text-center py-8 text-slate-400 italic">
                  {filter ? 'Aucun resultat' : 'Bibliotheque vide — ajoutez ou importez des contacts'}
                </td></tr>
              )}
              {filtered.map((c) => {
                const isEditing = editingId === c.id;
                const isSelected = selected.has(c.id);
                return (
                  <tr key={c.id} className={`border-b border-slate-50 hover:bg-slate-50 transition-colors group ${isSelected ? 'bg-amber-50/50' : ''}`}>
                    {hasChantier && (
                      <td className="px-2 py-2 text-center">
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(c.id)}
                          className="w-3.5 h-3.5 rounded border-slate-300 text-amber-500 focus:ring-amber-400 cursor-pointer" />
                      </td>
                    )}
                    {isEditing ? (
                      <>
                        {['subLabel', 'name', 'phone', 'email'].map((f) => (
                          <td key={f} className="px-2 py-1.5">
                            <input
                              type="text"
                              value={editData[f] || ''}
                              onChange={(e) => setEditData({ ...editData, [f]: e.target.value })}
                              className="w-full text-xs px-2 py-1 border border-violet-300 rounded focus:outline-none focus:ring-1 focus:ring-violet-400 text-slate-800"
                              placeholder={f === 'phone' ? '06 00 00 00 00' : f === 'name' ? 'DUPONT Jean' : ''}
                              autoFocus={f === 'name'}
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                            />
                          </td>
                        ))}
                        <td className="px-2 py-1.5 text-center">
                          <button onClick={handleSaveEdit} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><Check size={12} /></button>
                          <button onClick={() => setEditingId(null)} className="p-1 text-slate-400 hover:bg-slate-100 rounded"><X size={12} /></button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2 text-slate-600 font-medium">{c.subLabel}</td>
                        <td className="px-3 py-2 font-semibold text-slate-800">{c.name}</td>
                        <td className="px-3 py-2 text-slate-500">{c.phone}</td>
                        <td className="px-3 py-2 text-blue-600">{c.email}</td>
                        <td className="px-2 py-2 text-center">
                          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-all">
                            <button onClick={() => { setEditingId(c.id); setEditData(c); }}
                              className="p-1 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded"><Edit3 size={11} /></button>
                            <button onClick={() => handleDelete(c.id)}
                              className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"><Trash2 size={11} /></button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
          <p className="text-[10px] text-slate-400 italic">Les modifications sont sauvegardees automatiquement</p>
          <button onClick={onClose}
            className="px-5 py-2 bg-violet-500 text-white text-sm font-medium rounded-xl hover:bg-violet-600 transition-all shadow-sm">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
