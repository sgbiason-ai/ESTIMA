/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Echelle z-index semantique — utiliser ces tokens plutot que z-[xxxx]
      // Ordre croissant : du moins prioritaire au plus prioritaire (toast = top)
      zIndex: {
        'sticky': '10',          // headers sticky, tabs
        'dropdown': '30',        // menus deroulants
        'overlay': '40',         // overlays plein ecran (Tesla, Visites map)
        'modal-backdrop': '45',  // fond modales
        'modal': '50',           // contenu modales (defaut)
        'modal-stack': '60',     // modale empilee sur une autre (confirm, edit dans modal)
        'tooltip': '70',         // tooltips au-dessus des modales
        'toast': '90',           // toasts toujours au-dessus de tout
      },
    },
  },
  plugins: [],
}
