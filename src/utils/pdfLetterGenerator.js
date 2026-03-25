// src/components/rao/tabs/TabNegociation.jsx
import React, { useState } from 'react';
import { ChevronDown, MessageSquare, CheckCircle2, FileOutput, Copy, Calendar, User, MapPin } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { Textarea } from '../RaoUI';
import { COMPANY_UI_COLORS } from '../RaoConstants';

// ── MOTEUR DE GÉNÉRATION PDF & TEXTE ─────────────────────────────────────────

const buildLetterContent = (companyName, questions, letterConfig, consultation) => {
  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const city = letterConfig.city || '[Ville]';
  const deadline = letterConfig.deadline 
    ? new Date(letterConfig.deadline).toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) 
    : '[Date limite]';
  const signatory = letterConfig.signatoryName || '[Nom du signataire]';
  
  const objetText = consultation?.objet || '[Objet du marché]';
  const lotText = consultation?.lot || '[Lot concerné]';

  return { today, city, deadline, signatory, objetText, lotText };
};

const generateLetterPDF = (companyName, questions, letterConfig, consultation) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const { today, city, deadline, signatory, objetText, lotText } = buildLetterContent(companyName, questions, letterConfig, consultation);
  
  const margin = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - margin * 2;
  let cursorY = margin;

  // Helpers
  const setBold = () => doc.setFont('helvetica', 'bold');
  const setNormal = () => doc.setFont('helvetica', 'normal');
  
  const writeParagraph = (text, yOffset = 5, extraMargin = 0) => {
    const lines = doc.splitTextToSize(text, contentWidth - extraMargin);
    doc.text(lines, margin + extraMargin, cursorY);
    cursorY += (lines.length * yOffset) + 3;
  };

  // En-tête Date
  setNormal();
  doc.setFontSize(11);
  doc.text(`${city}, le ${today}`, pageWidth - margin, cursorY, { align: 'right' });
  cursorY += 20;

  // En-tête Destinataire
  setBold();
  doc.text('DESTINATAIRE :', pageWidth / 2 + 10, cursorY);
  setNormal();
  doc.text(companyName, pageWidth / 2 + 10, cursorY + 6);
  cursorY += 30;

  // Objet
  setBold();
  doc.text('OBJET :', margin, cursorY);
  setNormal();
  const objetFull = `${objetText} - ${lotText} \nNégociation avec les candidats`;
  doc.text(objetFull, margin + 20, cursorY, { maxWidth: contentWidth - 20 });
  cursorY += 20;

  // Formule d'appel
  doc.text('Monsieur,', margin, cursorY);
  cursorY += 10;

  // Paragraphes d'introduction [cite: 2]
  writeParagraph(`Dans le cadre de la consultation relative au marché de travaux susvisé, votre entreprise a présenté une offre pour le ${lotText}, laquelle a fait l'objet d'une analyse conformément aux critères et modalités définis au règlement de consultation.`);
  writeParagraph(`Afin de permettre au pouvoir adjudicateur de vérifier la cohérence économique de votre offre au regard des prestations prévues au marché, et sans préjuger de la conformité ni du caractère de votre proposition, nous vous remercions de bien vouloir nous transmettre l'ensemble des sous-détails de prix détaillés ayant servi à l'établissement de votre offre financière.`);
  writeParagraph(`Ces sous-détails de prix devront permettre d'identifier, pour chaque poste significatif du bordereau des prix unitaires et du détail quantitatif estimatif, une décomposition complète et explicite, comprenant notamment :`);

  // Puces [cite: 2]
  const bullets = [
    "L'ensemble des fournitures demandées (matériaux, produits, équipements) conformément au CCTP ;",
    "La main-d'œuvre mobilisée, avec indication des catégories de personnel, des temps unitaires et des coûts associés ;",
    "Les moyens matériels et engins utilisés, avec leur nature, leurs durées d'utilisation et leurs coûts ;",
    "Les autres composantes du prix, le cas échéant (transports, installations de chantier, frais généraux et marge)."
  ];

  bullets.forEach(b => {
    doc.text("-", margin + 5, cursorY);
    writeParagraph(b, 5, 10);
  });

  writeParagraph(`Il vous est également demandé de préciser, pour chaque tâche ou poste significatif, les hypothèses de rendement retenues (quantités exécutées par unité de temps ou par équipe), afin de permettre l'appréciation de la cohérence entre les moyens humains et matériels mobilisés, les durées d'intervention et les prix unitaires proposés.`);

  // Questions spécifiques
  if (questions && questions.trim() !== '') {
    cursorY += 3;
    setBold();
    writeParagraph(`De plus, nous souhaiterions obtenir des précisions sur les points suivants :`);
    setNormal();
    writeParagraph(questions, 5, 10);
    cursorY += 3;
  }

  // Vérification de bas de page
  if (cursorY > 230) {
    doc.addPage();
    cursorY = margin;
  }

  // Négociation et Remise [cite: 2]
  writeParagraph(`Par ailleurs, conformément aux règles applicables aux marchés passés selon une procédure adaptée, le pouvoir adjudicateur a décidé d'engager une phase de négociation portant sur les aspects financiers de votre offre.`);
  writeParagraph(`Dans ce cadre, nous vous invitons à bien vouloir réexaminer le montant de votre proposition financière et à nous faire parvenir, le cas échéant, une offre financière révisée, intégrant une remise sur le prix initialement proposé, tout en maintenant le niveau de prestations et les dispositions techniques décrites dans votre mémoire technique.`);
  writeParagraph(`Cette phase de négociation a pour objet de permettre l'optimisation de l'économie générale du marché, sans modification des caractéristiques essentielles du lot ni des exigences du dossier de consultation.`);
  
  setBold();
  writeParagraph(`Les éléments demandés devront être transmis sur la plateforme au plus tard le ${deadline}, et seront intégrés à l'analyse des offres avant toute décision d'attribution.`);
  setNormal();

  cursorY += 5;
  writeParagraph(`Nous vous prions d'agréer, Monsieur, l'expression de nos salutations distinguées.`);

  // Signature
  cursorY += 15;
  setBold();
  doc.text(signatory, pageWidth - margin, cursorY, { align: 'right' });

  // Sauvegarde
  doc.save(`Demande_Precisions_${companyName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
};

const generateLetterText = (companyName, questions, letterConfig, consultation) => {
  const { today, city, deadline, signatory, objetText, lotText } = buildLetterContent(companyName, questions, letterConfig, consultation);
  
  const specificQuestions = questions ? `\n\nDe plus, nous souhaiterions obtenir des précisions sur les points suivants :\n${questions}\n` : '';

  return `${city}, le ${today}

DESTINATAIRE :
${companyName}

OBJET : ${objetText} - ${lotText} - Négociation et demande de précisions

Monsieur,

Dans le cadre de la consultation relative au marché de travaux susvisé, votre entreprise a présenté une offre pour le ${lotText}, laquelle a fait l’objet d’une analyse conformément aux critères et modalités définis au règlement de consultation.

Afin de permettre au pouvoir adjudicateur de vérifier la cohérence économique de votre offre au regard des prestations prévues au marché, et sans préjuger de la conformité ni du caractère de votre proposition, nous vous remercions de bien vouloir nous transmettre l’ensemble des sous-détails de prix détaillés ayant servi à l’établissement de votre offre financière.

Ces sous-détails de prix devront permettre d’identifier, pour chaque poste significatif du bordereau des prix unitaires et du détail quantitatif estimatif, une décomposition complète et explicite, comprenant notamment :
- L’ensemble des fournitures demandées (matériaux, produits, équipements) conformément au CCTP ;
- La main-d’œuvre mobilisée, avec indication des catégories de personnel, des temps unitaires et des coûts associés ;
- Les moyens matériels et engins utilisés, avec leur nature, leurs durées d’utilisation et leurs coûts ;
- Les autres composantes du prix, le cas échéant (transports, installations de chantier, frais généraux et marge).

Il vous est également demandé de préciser, pour chaque tâche ou poste significatif, les hypothèses de rendement retenues (quantités exécutées par unité de temps ou par équipe), afin de permettre l’appréciation de la cohérence entre les moyens humains et matériels mobilisés, les durées d’intervention et les prix unitaires proposés.${specificQuestions}

Par ailleurs, conformément aux règles applicables aux marchés passés selon une procédure adaptée, le pouvoir adjudicateur a décidé d’engager une phase de négociation portant sur les aspects financiers de votre offre.

Dans ce cadre, nous vous invitons à bien vouloir réexaminer le montant de votre proposition financière et à nous faire parvenir, le cas échéant, une offre financière révisée, intégrant une remise sur le prix initialement proposé, tout en maintenant le niveau de prestations et les dispositions techniques décrites dans votre mémoire technique.

Cette phase de négociation a pour objet de permettre l’optimisation de l’économie générale du marché, sans modification des caractéristiques essentielles du lot ni des exigences du dossier de consultation.

Les éléments demandés devront être transmis sur la plateforme au plus tard le ${deadline}, et seront intégrés à l’analyse des offres avant toute décision d’attribution.

Nous vous prions d’agréer, Monsieur, l’expression de nos salutations distinguées.

${signatory}`;
};

// ── VUE PRINCIPALE ───────────────────────────────────────────────────────────

const TabNegociation = ({ companyNames, companiesData, updateNegotiation, consultation = {} }) => {
  const [openCompany, setOpenCompany] = useState(companyNames[0] || null);
  const [copiedCompany, setCopiedCompany] = useState(null);

  // Configuration globale du courrier
  const [letterConfig, setLetterConfig] = useState({
    deadline: '',
    signatoryName: consultation.client || '',
    city: consultation.lieu || '',
  });

  const updateConfig = (key, value) => setLetterConfig(prev => ({ ...prev, [key]: value }));

  const handleCopyLetter = (companyName, questions) => {
    const text = generateLetterText(companyName, questions, letterConfig, consultation);
    navigator.clipboard.writeText(text);
    setCopiedCompany(companyName);
    setTimeout(() => setCopiedCompany(null), 2500);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-24">
      
      {/* ── PANNEAU DE CONFIGURATION DU COURRIER TYPE ── */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-[24px] p-8 text-white shadow-lg relative overflow-hidden mb-8">
        <FileOutput size={160} className="absolute -right-10 -bottom-10 text-white opacity-5 rotate-12" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-sm border border-white/10">
              <FileOutput size={20} className="text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight text-white">Générateur de Courriers & Négociation</h3>
              <p className="text-xs text-slate-400 mt-0.5">Paramétrez les variables globales pour générer vos demandes d'informations au format PDF.</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <MapPin size={12} /> Ville d'émission
              </label>
              <input 
                type="text" value={letterConfig.city} onChange={e => updateConfig('city', e.target.value)} placeholder="Ex: Sieurac"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:bg-white/10 focus:ring-2 focus:ring-emerald-500/50 transition-all shadow-inner"
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <Calendar size={12} /> Date & Heure limite
              </label>
              <input 
                type="datetime-local" value={letterConfig.deadline} onChange={e => updateConfig('deadline', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:bg-white/10 focus:ring-2 focus:ring-emerald-500/50 transition-all shadow-inner [color-scheme:dark]"
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <User size={12} /> Signataire
              </label>
              <input 
                type="text" value={letterConfig.signatoryName} onChange={e => updateConfig('signatoryName', e.target.value)} placeholder="Ex: Fabrice Marcuzzo, Maire"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:bg-white/10 focus:ring-2 focus:ring-emerald-500/50 transition-all shadow-inner"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── LISTE DES ENTREPRISES ── */}
      {companyNames.map((name, ci) => {
        const uiColor = COMPANY_UI_COLORS[ci % COMPANY_UI_COLORS.length];
        const nego = companiesData[name]?.negotiation || {};
        const isOpen = openCompany === name;
        const hasContent = nego.questions || nego.responses;
        const isCopied = copiedCompany === name;

        return (
          <div key={name} className={`bg-white rounded-[28px] border ${isOpen ? 'border-slate-300 shadow-xl scale-[1.002]' : 'border-slate-200 shadow-sm hover:shadow-md'} overflow-hidden transition-all duration-300`}>
            <button
              onClick={() => setOpenCompany(isOpen ? null : name)}
              className={`w-full flex items-center justify-between px-8 py-6 transition-colors ${isOpen ? 'bg-slate-50/50' : 'bg-white'}`}
            >
              <div className="flex items-center gap-6">
                <div className={`w-14 h-14 rounded-[18px] ${uiColor.bg} ${uiColor.text} flex items-center justify-center font-black text-xl shadow-inner`}>
                  {name.substring(0, 2).toUpperCase()}
                </div>
                <span className="font-extrabold text-slate-900 text-2xl tracking-tight">{name}</span>
                {hasContent && (
                  <span className="text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-full ml-3 shadow-sm">
                    Échanges en cours
                  </span>
                )}
              </div>
              <div className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-300 shadow-sm ${isOpen ? 'bg-slate-900 text-white rotate-180' : 'bg-white border border-slate-200 text-slate-400 group-hover:bg-slate-50'}`}>
                <ChevronDown size={22} />
              </div>
            </button>
            
            {isOpen && (
              <div className="px-8 pb-10 pt-4 animate-in fade-in slide-in-from-top-4 duration-700 bg-slate-50/30 border-t border-slate-100">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  
                  {/* Colonne 1 : Saisie des questions & Export */}
                  <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden transition-all hover:border-slate-300 hover:shadow-lg">
                    <div className="p-6 flex-1 flex flex-col">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-black uppercase tracking-widest text-slate-800 flex items-center gap-2">
                          <MessageSquare size={18} className="text-blue-500" /> Questions spécifiques
                        </h4>
                      </div>
                      <Textarea
                        value={nego.questions}
                        onChange={v => updateNegotiation(name, 'questions', v)}
                        placeholder="Listez ici les questions spécifiques à cette entreprise.&#10;Ex:&#10;- Pouvez-vous justifier le PU du bordereau n°4 ?&#10;- Votre variante est irrecevable, merci de chiffrer l'offre de base..."
                        rows={8}
                        className="flex-1 bg-slate-50 border-slate-200 shadow-inner rounded-2xl"
                      />
                    </div>
                    
                    {/* Barre d'action Génération */}
                    <div className="bg-slate-50/80 border-t border-slate-100 px-6 py-5 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500 max-w-[200px] leading-tight">
                        Ces questions seront automatiquement intégrées au courrier officiel.
                      </span>
                      
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleCopyLetter(name, nego.questions)}
                          title="Copier le texte"
                          className={`p-3 rounded-xl transition-all shadow-sm active:scale-95 border ${
                            isCopied 
                              ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                              : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {isCopied ? <CheckCircle2 size={18} /> : <Copy size={18} />}
                        </button>
                        
                        <button 
                          onClick={() => generateLetterPDF(name, nego.questions, letterConfig, consultation)}
                          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-md active:scale-95 bg-slate-900 hover:bg-slate-800 text-white"
                        >
                          <FileOutput size={18} />
                          Télécharger le PDF
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Colonne 2 : Suivi des retours */}
                  <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col transition-all hover:border-slate-300 hover:shadow-lg">
                    <h4 className="text-sm font-black uppercase tracking-widest text-slate-800 mb-4 flex items-center gap-2">
                      <CheckCircle2 size={18} className="text-emerald-500" /> Réponses & Engagements
                    </h4>
                    <Textarea
                      value={nego.responses}
                      onChange={v => updateNegotiation(name, 'responses', v)}
                      placeholder="Consignez ici les retours de l'entreprise après l'envoi du courrier.&#10;Ex:&#10;1 - Le candidat confirme l'erreur matérielle...&#10;2 - Proposition d'une remise supplémentaire de 2%..."
                      rows={8}
                      className="flex-1 bg-slate-50 border-slate-200 shadow-inner rounded-2xl"
                    />
                  </div>
                  
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default TabNegociation;