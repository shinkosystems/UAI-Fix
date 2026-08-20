/**
 * Utilitário de Tracking e Atribuição de Aquisição de Clientes (UAI-Fix)
 * Captura e persiste UTMs, Referrers e parâmetros de campanhas (Google, Instagram, WhatsApp, etc.)
 */

export interface TrackingData {
  origem: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  referrer_url?: string;
  gclid?: string;
  fbclid?: string;
  captured_at: string;
}

const STORAGE_KEY = 'uaifix_tracking_attribution';
const ATTRIBUTION_WINDOW_DAYS = 30;

/**
 * Deduz o canal padronizado de origem com base em UTMs, parâmetros de clique e Referrer
 */
export const inferOriginChannel = (
  utmSource?: string | null,
  referrer?: string | null,
  gclid?: string | null,
  fbclid?: string | null
): string => {
  const src = (utmSource || '').toLowerCase().trim();
  const ref = (referrer || '').toLowerCase().trim();

  // 1. Google Ads ou busca
  if (gclid || src.includes('google') || src.includes('gads') || src.includes('adwords')) {
    return 'google';
  }
  if (ref.includes('google.com') || ref.includes('google.com.br')) {
    return 'google';
  }

  // 2. Instagram / Facebook / Meta
  if (fbclid || src.includes('instagram') || src.includes('facebook') || src.includes('meta') || src.includes('ig') || src.includes('fb')) {
    return 'instagram';
  }
  if (ref.includes('instagram.com') || ref.includes('facebook.com') || ref.includes('l.instagram.com')) {
    return 'instagram';
  }

  // 3. WhatsApp
  if (src.includes('whatsapp') || src.includes('wa.me') || src.includes('zap') || ref.includes('whatsapp.com')) {
    return 'whatsapp';
  }

  // 4. Indicação
  if (src.includes('indicacao') || src.includes('amigo') || src.includes('referral')) {
    return 'indicacao';
  }

  // 5. Balcão / Presencial
  if (src.includes('balcao') || src.includes('loja') || src.includes('fachada')) {
    return 'balcao';
  }

  // Se veio UTM explícita diferente
  if (src) {
    return src;
  }

  return 'organico';
};

/**
 * Inicializa a captura na entrada de qualquer página (chamado no App.tsx)
 */
export const initTrackingCapture = (): TrackingData | null => {
  if (typeof window === 'undefined') return null;

  try {
    const urlParams = new URLSearchParams(window.location.search);
    const utm_source = urlParams.get('utm_source');
    const utm_medium = urlParams.get('utm_medium');
    const utm_campaign = urlParams.get('utm_campaign');
    const utm_term = urlParams.get('utm_term');
    const utm_content = urlParams.get('utm_content');
    const gclid = urlParams.get('gclid');
    const fbclid = urlParams.get('fbclid');
    const refParam = urlParams.get('ref') || urlParams.get('origem');
    const referrer = document.referrer || undefined;

    const hasTrackingParam = utm_source || utm_medium || utm_campaign || utm_term || gclid || fbclid || refParam;

    // Se a URL atual tem parâmetros de tracking ou se ainda não temos tracking gravado
    if (hasTrackingParam || (referrer && !referrer.includes(window.location.hostname))) {
      const canonicalOrigin = inferOriginChannel(utm_source || refParam, referrer, gclid, fbclid);

      const trackingPayload: TrackingData = {
        origem: canonicalOrigin,
        utm_source: utm_source || undefined,
        utm_medium: utm_medium || undefined,
        utm_campaign: utm_campaign || undefined,
        utm_term: utm_term || undefined,
        utm_content: utm_content || undefined,
        gclid: gclid || undefined,
        fbclid: fbclid || undefined,
        referrer_url: referrer || undefined,
        captured_at: new Date().toISOString()
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(trackingPayload));
      return trackingPayload;
    }

    // Se não há novo tracking na URL, verifica se o existente ainda está válido
    return getStoredTrackingData();
  } catch (err) {
    console.warn('Erro ao capturar dados de tracking de aquisição:', err);
    return null;
  }
};

/**
 * Recupera os dados de tracking armazenados no navegador dentro da janela de atribuição
 */
export const getStoredTrackingData = (): TrackingData | null => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed: TrackingData = JSON.parse(raw);
    if (!parsed || !parsed.captured_at) return null;

    const capturedDate = new Date(parsed.captured_at).getTime();
    const now = Date.now();
    const daysDiff = (now - capturedDate) / (1000 * 60 * 60 * 24);

    if (daysDiff > ATTRIBUTION_WINDOW_DAYS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

/**
 * Retorna a origem atribuída (ou 'organico' por padrão)
 */
export const getAttributedOrigin = (fallback = 'organico'): string => {
  const data = getStoredTrackingData();
  return data?.origem || fallback;
};

/**
 * Limpa os dados de tracking (ex: após conversão ou logout)
 */
export const clearTrackingData = (): void => {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }
};
