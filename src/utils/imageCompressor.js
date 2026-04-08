// src/utils/imageCompressor.js
//
// Compresse une image et capture la géolocalisation du navigateur.
// Retourne { src, lat, lng } si GPS disponible, sinon juste la string src.

const getCurrentGps = () =>
  new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 10000, maximumAge: 10000, enableHighAccuracy: true }
    );
  });

export const compressImage = (file, maxW = 800, quality = 0.7) =>
  new Promise((resolve) => {
    const gpsPromise = getCurrentGps();
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = async () => {
        const ratio = Math.min(1, maxW / img.width);
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const src = canvas.toDataURL('image/jpeg', quality);
        const gps = await gpsPromise;
        resolve(gps ? { src, lat: gps.lat, lng: gps.lng } : src);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
