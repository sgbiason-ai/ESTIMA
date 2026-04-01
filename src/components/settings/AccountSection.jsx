import React, { useState } from 'react';
import { doc, getDoc, getDocs, deleteDoc, collection } from 'firebase/firestore';
import { EmailAuthProvider, reauthenticateWithCredential, deleteUser } from 'firebase/auth';
import { db, auth } from '../../firebase';
import { confirm, prompt, toast } from '../../utils/globalUI';
import { Download, Trash2, Shield, Loader2 } from 'lucide-react';

const AccountSection = ({ user, companyId }) => {
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Export des donnees personnelles (RGPD art. 20) ──────────────────────────
  const handleExportData = async () => {
    setExporting(true);
    try {
      // 1. Profil utilisateur
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const profil = userDoc.exists() ? userDoc.data() : null;

      // 2. Projets
      const projectsSnap = await getDocs(
        collection(db, 'companies', companyId, 'projects')
      );
      const projets = [];

      for (const projDoc of projectsSnap.docs) {
        const projData = { id: projDoc.id, ...projDoc.data() };

        // Historique de chaque projet
        const historySnap = await getDocs(
          collection(db, 'companies', companyId, 'projects', projDoc.id, 'history')
        );
        projData.historique = historySnap.docs.map((h) => ({
          id: h.id,
          ...h.data(),
        }));

        projets.push(projData);
      }

      // 3. Construction de l'objet JSON
      const exportData = {
        exportDate: new Date().toISOString(),
        profil,
        projets,
      };

      // 4. Telechargement du fichier
      const dateStr = new Date().toISOString().slice(0, 10);
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `estimavrd-donnees-${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Export de vos donnees termine.');
    } catch (err) {
      console.error('Erreur export donnees:', err);
      toast.error("Erreur lors de l'export des donnees.");
    } finally {
      setExporting(false);
    }
  };

  // ── Suppression de compte (RGPD art. 17) ───────────────────────────────────
  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      // Double confirmation
      const ok1 = await confirm(
        "Etes-vous sur de vouloir supprimer votre compte ? Cette action est irreversible.",
        { title: 'Suppression de compte', danger: true }
      );
      if (!ok1) { setDeleting(false); return; }

      const ok2 = await confirm(
        "DERNIERE CONFIRMATION : Toutes vos donnees seront definitivement supprimees.",
        { title: 'Confirmation finale', danger: true, confirmLabel: 'Supprimer definitivement' }
      );
      if (!ok2) { setDeleting(false); return; }

      // Re-authentification
      const password = await prompt(
        'Entrez votre mot de passe pour confirmer la suppression :',
        '',
        { title: 'Verification de securite' }
      );
      if (!password) { setDeleting(false); return; }

      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(auth.currentUser, credential);

      // Suppression du profil utilisateur Firestore
      await deleteDoc(doc(db, 'users', user.uid));

      // Suppression du compte Firebase Auth
      await deleteUser(auth.currentUser);

      // L'utilisateur est automatiquement deconnecte apres deleteUser
      toast.success('Votre compte a ete supprime.');
    } catch (err) {
      console.error('Erreur suppression compte:', err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        toast.error('Mot de passe incorrect. Suppression annulee.');
      } else {
        toast.error("Erreur lors de la suppression du compte.");
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
      {/* Titre section */}
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
        <div className="bg-blue-100 p-2 rounded-lg">
          <Shield size={20} className="text-blue-600" />
        </div>
        <div>
          <h3 className="font-black uppercase text-sm tracking-widest text-slate-700">
            Mon Compte & Donnees Personnelles
          </h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">
            RGPD — Portabilite & Droit a l'effacement
          </p>
        </div>
      </div>

      {/* Bouton Export donnees */}
      <div className="p-6 bg-blue-50 rounded-lg border border-blue-100 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="text-center md:text-left">
          <p className="text-xs font-black text-blue-900 uppercase mb-1">
            Exporter mes donnees
          </p>
          <p className="text-[11px] text-blue-700 font-medium italic">
            Telecharge un fichier JSON contenant votre profil et tous vos projets (RGPD art. 20).
          </p>
        </div>
        <button
          onClick={handleExportData}
          disabled={exporting}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-black text-[10px] uppercase tracking-[0.2em] shadow-md flex items-center gap-2 active:scale-95 transition-all"
        >
          {exporting ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Export en cours...
            </>
          ) : (
            <>
              <Download size={16} /> Exporter mes donnees
            </>
          )}
        </button>
      </div>

      {/* Separateur */}
      <div className="my-8 border-t border-slate-200" />

      {/* Zone danger : Suppression compte */}
      <div className="p-6 bg-red-50 rounded-lg border border-red-100 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="text-center md:text-left">
          <p className="text-xs font-black text-red-900 uppercase mb-1">
            Supprimer mon compte
          </p>
          <p className="text-[11px] text-red-700 font-medium italic">
            Supprime definitivement votre profil et votre compte. Les donnees de l'entreprise (projets, BPU) sont conservees.
          </p>
        </div>
        <button
          onClick={handleDeleteAccount}
          disabled={deleting}
          className="bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-black text-[10px] uppercase tracking-[0.2em] shadow-lg flex items-center gap-2 active:scale-95 transition-all"
        >
          {deleting ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Suppression...
            </>
          ) : (
            <>
              <Trash2 size={16} /> Supprimer mon compte
            </>
          )}
        </button>
      </div>
    </section>
  );
};

export default AccountSection;
