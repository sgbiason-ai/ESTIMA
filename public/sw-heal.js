// SW self-healing : si un asset /assets/*.{js,css} renvoie du HTML (MIME mismatch),
// c'est que le SW sert un vieux index.html avec des hashes obsoletes. On desinstalle
// le SW + clear caches + reload une seule fois (flag sessionStorage pour eviter boucle).
(function () {
  var HEAL_FLAG = 'estima_sw_heal_attempt';
  function heal(reason) {
    if (sessionStorage.getItem(HEAL_FLAG)) return;
    sessionStorage.setItem(HEAL_FLAG, reason || '1');
    var tasks = [];
    if ('serviceWorker' in navigator) {
      tasks.push(navigator.serviceWorker.getRegistrations().then(function (rs) {
        return Promise.all(rs.map(function (r) { return r.unregister(); }));
      }).catch(function () {}));
    }
    if (typeof caches !== 'undefined') {
      tasks.push(caches.keys().then(function (keys) {
        return Promise.all(keys.map(function (k) { return caches.delete(k); }));
      }).catch(function () {}));
    }
    Promise.all(tasks).finally(function () { location.reload(); });
  }
  window.addEventListener('error', function (e) {
    var t = e && e.target;
    if (!t) return;
    var src = t.src || t.href || '';
    if (!/\/assets\/.+\.(js|css|mjs)(\?|$)/.test(src)) return;
    heal('asset-load-failed:' + src.split('/').pop());
  }, true);
  // Clear le flag apres boot reussi (2s apres load)
  window.addEventListener('load', function () {
    setTimeout(function () { sessionStorage.removeItem(HEAL_FLAG); }, 2000);
  });
})();
