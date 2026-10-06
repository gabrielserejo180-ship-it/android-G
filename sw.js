// Núcleo — service worker
// Guarda o app para abrir sem internet e trata o toque nas notificações.
// Ao publicar uma versão nova, troque o número abaixo para forçar a atualização.
const CACHE = 'nucleo-v4';
const SHELL = ['./', './index.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('supabase.co')) return;            // dados e login: sempre pela rede

  // Página do app: tenta a rede (versão nova) e cai no cache sem internet
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req.url, { cache: 'no-store' }).then(r => {          // sempre a versão mais nova do GitHub
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put('./index.html', copy));
        return r;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Biblioteca do Supabase, fontes e arquivos do próprio site: cache primeiro
  const cacheable = url.origin === self.location.origin || url.hostname === 'cdn.jsdelivr.net'
    || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!cacheable) return;
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r.ok || r.type === 'opaque') { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return r;
    }))
  );
});

// Toque na notificação: abre (ou foca) o app na conversa certa
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || '#/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) { c.postMessage({ type: 'open', url: target }); return c.focus(); }
      return self.clients.openWindow('./' + target);
    })
  );
});
