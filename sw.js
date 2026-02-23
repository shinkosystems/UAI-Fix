
const CACHE_NAME = 'uaifix-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  // Força o SW a ativar imediatamente, sem esperar fechar abas
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Ativação e Limpeza de Caches Antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Garante que o SW controle todas as abas/clientes imediatamente
  self.clients.claim();
});

// Interceptação de Requisições
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Skip interception for API calls (Supabase) and other cross-origin requests
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  // Estratégia para Navegação (SPA):
  // Se for uma navegação de página (ex: recarregar, abrir app), tenta a rede.
  // Se falhar (offline), retorna o index.html do cache.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/index.html');
      })
    );
    return;
  }

  // Estratégia para Outros Recursos (CSS, JS, Imagens):
  // Cache First, falling back to Network
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});
