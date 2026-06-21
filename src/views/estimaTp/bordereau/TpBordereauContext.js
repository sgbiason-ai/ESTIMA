// src/views/estimaTp/bordereau/TpBordereauContext.js
// Contexte partagé du bordereau ESTIMA TP (évite le prop-drilling dans l'arbre).
import { createContext, useContext } from 'react';

export const TpBordereauContext = createContext(null);
export const useTpBordereau = () => useContext(TpBordereauContext);
