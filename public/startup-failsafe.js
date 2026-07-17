(function startupFailsafe() {
  let shown = false;
  let firstError = '';

  function appMounted() {
    const root = document.getElementById('root');
    return Boolean(root && root.childElementCount > 0);
  }

  function wipeCachesAndReload(button) {
    if (button) {
      button.disabled = true;
      button.textContent = 'Nettoyage…';
    }

    const tasks = [];
    if ('serviceWorker' in navigator) {
      tasks.push(navigator.serviceWorker.getRegistrations().then((registrations) => (
        Promise.all(registrations.map((registration) => registration.unregister()))
      )).catch(() => {}));
    }
    if (typeof caches !== 'undefined') {
      tasks.push(caches.keys().then((keys) => (
        Promise.all(keys.map((key) => caches.delete(key)))
      )).catch(() => {}));
    }

    const reload = () => location.reload();
    Promise.all(tasks).then(reload, reload);
    setTimeout(reload, 4000);
  }

  function showFailure() {
    if (shown || appMounted()) return;
    const splash = document.getElementById('splash');
    if (!splash || splash.style.display === 'none') return;

    shown = true;
    splash.innerHTML = `
      <div class="logo"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg></div>
      <div class="name">Estima Suite</div>
      <div class="err-title"><svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>L’application n’a pas pu démarrer</div>
      <div class="err-sub">Une erreur est survenue au chargement. Réessayez, puis videz le cache si le problème persiste.</div>
      <div class="err-detail"></div>
      <div class="err-actions"><button type="button" class="err-retry">Réessayer</button><button type="button" class="err-wipe">Vider le cache et réessayer</button></div>
    `;

    if (firstError) splash.querySelector('.err-detail').textContent = firstError.slice(0, 200);
    splash.querySelector('.err-retry').addEventListener('click', function retry() {
      this.disabled = true;
      this.textContent = 'Rechargement…';
      location.reload();
    });
    splash.querySelector('.err-wipe').addEventListener('click', function wipe() {
      wipeCachesAndReload(this);
    });
  }

  function checkSoon(delay) {
    setTimeout(showFailure, delay);
  }

  window.addEventListener('error', (event) => {
    if (!event || typeof event.message !== 'string') return;
    if (event.message.includes('ResizeObserver')) return;
    if (!firstError) firstError = event.message;
    checkSoon(3000);
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event && event.reason;
    if (!firstError) {
      firstError = reason && (reason.message || reason.code)
        ? String(reason.message || reason.code)
        : (reason ? String(reason) : '');
    }
    checkSoon(6000);
  });

  checkSoon(15000);
}());
