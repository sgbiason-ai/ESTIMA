import React, { useState } from 'react';
import { Lock, Mail, ArrowRight, AlertCircle, Loader2, ArrowLeft, CheckCircle } from 'lucide-react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase'; 

const LoginView = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState(''); // Pour le succès de l'envoi
  const [loading, setLoading] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false); // Pour basculer l'affichage

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError("Identifiants incorrects.");
      } else if (err.code === 'auth/too-many-requests') {
        setError("Trop de tentatives. Réessayez plus tard.");
      } else {
        setError("Erreur de connexion.");
      }
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    
    if (!email) {
      setError("Veuillez entrer votre email.");
      return;
    }

    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("Email de réinitialisation envoyé ! Vérifiez vos spams.");
      setLoading(false);
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/user-not-found') {
        setError("Aucun compte associé à cet email.");
      } else if (err.code === 'auth/invalid-email') {
        setError("Format d'email invalide.");
      } else {
        setError("Impossible d'envoyer l'email. Réessayez.");
      }
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsResetMode(!isResetMode);
    setError('');
    setMessage('');
    setPassword(''); // On vide le mdp quand on change de mode
  };

  return (
    <div className="flex h-screen bg-[#040a0e] items-center justify-center relative overflow-hidden font-sans text-slate-300">
      <div className="absolute top-0 right-0 w-2/3 h-2/3 bg-emerald-500/5 blur-[120px] pointer-events-none rounded-full" />
      <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-blue-600/5 blur-[100px] pointer-events-none rounded-full" />

      <div className="w-full max-w-md bg-slate-900/40 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl relative z-10">
        
        {/* En-tête dynamique */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-4">
            <Lock className="text-white" size={32} />
          </div>
          <h2 className="text-2xl font-black text-white uppercase tracking-wider">
            {isResetMode ? 'Réinitialisation' : 'Accès Sécurisé'}
          </h2>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">Estimation VRD & Études</p>
        </div>

        {/* Formulaire */}
        <form onSubmit={isResetMode ? handleResetPassword : handleLogin} className="space-y-5">
          
          {/* Messages d'erreur */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs font-bold flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Message de succès (reset password) */}
          {message && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-xl text-xs font-bold flex items-center gap-2">
              <CheckCircle size={16} />
              {message}
            </div>
          )}

          {/* Champ Email (Commun aux deux modes) */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Email</label>
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-400 transition-colors" size={18} />
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-sm font-medium text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:bg-black/60 transition-all"
                placeholder="nom@entreprise.com"
              />
            </div>
          </div>

          {/* Champ Mot de passe (Uniquement mode Login) */}
          {!isResetMode && (
            <div className="space-y-1">
              <div className="flex justify-between items-end">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Mot de passe</label>
                <button 
                  type="button"
                  onClick={toggleMode}
                  className="text-[10px] font-bold text-emerald-500 hover:text-emerald-400 uppercase tracking-wide transition-colors"
                >
                  Mot de passe oublié ?
                </button>
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-400 transition-colors" size={18} />
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-sm font-medium text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:bg-black/60 transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>
          )}

          {/* Bouton d'action principal */}
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase tracking-widest text-xs py-4 rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-4 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              isResetMode ? (
                <>Envoyer le lien <Mail size={18} /></>
              ) : (
                <>Se connecter <ArrowRight size={18} /></>
              )
            )}
          </button>

          {/* Bouton retour (Uniquement mode Reset) */}
          {isResetMode && (
            <button 
              type="button"
              onClick={toggleMode}
              className="w-full bg-transparent hover:bg-white/5 text-slate-400 hover:text-white font-bold uppercase tracking-widest text-[10px] py-3 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <ArrowLeft size={14} /> Retour à la connexion
            </button>
          )}
        </form>
      </div>
    </div>
  );
};

export default LoginView;