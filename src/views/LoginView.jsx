import React, { useState } from 'react';
import { Lock, Mail, ArrowRight, AlertCircle, Loader2, ArrowLeft, CheckCircle, Layers } from 'lucide-react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';

const LoginView = ({ onShowLegal }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
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
    if (!email) { setError("Veuillez entrer votre email."); return; }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("Email de réinitialisation envoyé ! Vérifiez vos spams.");
      setLoading(false);
    } catch (err) {
      if (err.code === 'auth/user-not-found') setError("Aucun compte associé à cet email.");
      else if (err.code === 'auth/invalid-email') setError("Format d'email invalide.");
      else setError("Impossible d'envoyer l'email. Réessayez.");
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsResetMode(!isResetMode);
    setError('');
    setMessage('');
    setPassword('');
  };

  return (
    <div className="flex h-screen bg-[#f5f5f7] items-center justify-center relative overflow-hidden"
      >

      <div className="w-full max-w-md bg-white border border-gray-200/60 p-8 rounded-3xl shadow-xl relative z-10">

        {/* En-tête */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-gray-900 to-gray-700 rounded-2xl mx-auto flex items-center justify-center shadow-sm mb-5">
            <Layers className="text-white" size={26} strokeWidth={1.5} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
            {isResetMode ? 'Réinitialisation' : 'Estima Suite'}
          </h2>
          <p className="text-gray-400 text-sm mt-1.5">
            {isResetMode ? 'Entrez votre email pour recevoir un lien' : 'Connectez-vous pour accéder à votre espace'}
          </p>
        </div>

        {/* Formulaire */}
        <form onSubmit={isResetMode ? handleResetPassword : handleLogin} className="space-y-4">

          {error && (
            <div className="bg-red-50 border border-red-200/60 text-red-600 p-3 rounded-xl text-xs font-medium flex items-center gap-2">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          {message && (
            <div className="bg-emerald-50 border border-emerald-200/60 text-emerald-700 p-3 rounded-xl text-xs font-medium flex items-center gap-2">
              <CheckCircle size={14} />
              {message}
            </div>
          )}

          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500 ml-0.5">Email</label>
            <div className="relative group">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={16} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200/60 rounded-xl py-3 pl-11 pr-4 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all"
                placeholder="nom@entreprise.com"
              />
            </div>
          </div>

          {/* Mot de passe */}
          {!isResetMode && (
            <div className="space-y-1.5">
              <div className="flex justify-between items-end">
                <label className="text-xs font-medium text-gray-500 ml-0.5">Mot de passe</label>
                <button
                  type="button"
                  onClick={toggleMode}
                  className="text-[11px] font-medium text-blue-500 hover:text-blue-600 transition-colors"
                >
                  Mot de passe oublié ?
                </button>
              </div>
              <div className="relative group">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={16} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200/60 rounded-xl py-3 pl-11 pr-4 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>
          )}

          {/* Bouton principal */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gray-900 hover:bg-gray-800 text-white font-medium text-sm py-3 rounded-xl shadow-sm transition-all active:scale-[0.97] flex items-center justify-center gap-2 mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              isResetMode ? (
                <>Envoyer le lien <Mail size={16} /></>
              ) : (
                <>Se connecter <ArrowRight size={16} /></>
              )
            )}
          </button>

          {/* Retour */}
          {isResetMode && (
            <button
              type="button"
              onClick={toggleMode}
              className="w-full text-gray-400 hover:text-gray-600 font-medium text-xs py-2.5 rounded-xl hover:bg-gray-50 transition-all flex items-center justify-center gap-1.5"
            >
              <ArrowLeft size={14} /> Retour à la connexion
            </button>
          )}
        </form>
      </div>

      {/* Liens légaux */}
      <div className="absolute bottom-6 left-0 right-0 text-center z-10">
        <button
          type="button"
          onClick={onShowLegal}
          className="text-gray-400 hover:text-gray-600 text-[10px] font-medium transition-colors"
        >
          Mentions légales · Politique de confidentialité
        </button>
      </div>
    </div>
  );
};

export default LoginView;
