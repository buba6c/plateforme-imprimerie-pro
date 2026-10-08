// Service worker d'Evocom Print : notifications uniquement.
// Il ne met RIEN en cache et n'intercepte aucune requête (pas d'écoute « fetch ») :
// l'API, les fichiers et le temps réel passent toujours directement par le réseau.
//
// - « evocom:afficher » (message de la page) : affiche une notification de l'ordinateur,
//   sauf si un onglet de l'application est au premier plan.
// - Clic sur une notification : ramène un onglet ouvert sur le dossier, sinon en ouvre un.
// - « push » : prêt pour le Web Push (clés VAPID, à venir) ; le serveur enverra
//   { titre, message, dossier_id, id } et le même affichage s'appliquera.

/* eslint-env serviceworker */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

function cheminInterne(url) {
  return typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') ? url : '/';
}

async function ongletAuPremierPlan() {
  const fenetres = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  return fenetres.some((c) => c.visibilityState === 'visible' && c.focused);
}

async function afficher(titre, options) {
  if (await ongletAuPremierPlan()) return;
  const o = options && typeof options === 'object' ? options : {};
  const url = cheminInterne(o.data && o.data.url);
  await self.registration.showNotification(String(titre || 'Evocom Print').slice(0, 200), {
    body: typeof o.body === 'string' ? o.body.slice(0, 500) : undefined,
    tag: typeof o.tag === 'string' ? o.tag : undefined,
    icon: '/icones/evocom-192.png',
    data: { url },
  });
}

self.addEventListener('message', (event) => {
  // Seules les pages de l'application (même origine) peuvent parler au service worker.
  if (!event.source || new URL(event.source.url).origin !== self.location.origin) return;
  const d = event.data;
  if (d && d.type === 'evocom:afficher') event.waitUntil(afficher(d.titre, d.options));
});

self.addEventListener('push', (event) => {
  let d = {};
  try {
    d = event.data ? event.data.json() : {};
  } catch {
    d = {};
  }
  const url = d.dossier_id ? `/dossiers/${Number(d.dossier_id)}` : '/';
  event.waitUntil(
    afficher(d.titre, {
      body: d.message || undefined,
      tag: d.id ? `evocom-${Number(d.id)}` : undefined,
      data: { url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = cheminInterne(event.notification.data && event.notification.data.url);
  event.waitUntil(
    (async () => {
      const fenetres = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const onglet = fenetres.find((c) => new URL(c.url).origin === self.location.origin);
      if (onglet) {
        await onglet.focus().catch(() => {});
        onglet.postMessage({ type: 'evocom:ouvrir', url });
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
