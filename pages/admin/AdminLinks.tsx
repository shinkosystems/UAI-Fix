import React, { useState, useMemo } from 'react';
import { 
  Link2, Copy, Check, QrCode, ExternalLink, Sparkles, 
  Share2, ArrowRight, RefreshCw, Smartphone, Search, 
  Instagram, Globe, Users, ShoppingBag, MessageSquare
} from 'lucide-react';
import { ORIGIN_CHANNELS } from '../../types';

interface PresetLink {
  id: string;
  title: string;
  channel: string;
  channelName: string;
  icon: string;
  description: string;
  destination: string;
  source: string;
  medium: string;
  campaign: string;
}

const PRESET_LINKS: PresetLink[] = [
  {
    id: 'insta-bio',
    title: 'Instagram — Link da Bio',
    channel: 'instagram',
    channelName: 'Instagram / Meta',
    icon: '📸',
    description: 'Para colocar no botão de link principal do perfil do Instagram.',
    destination: '/',
    source: 'instagram',
    medium: 'bio',
    campaign: 'perfil_principal'
  },
  {
    id: 'insta-stories',
    title: 'Instagram — Stories / Figurinha',
    channel: 'instagram',
    channelName: 'Instagram / Meta',
    icon: '📸',
    description: 'Para usar nas figurinhas de link dos Stories diários.',
    destination: '/',
    source: 'instagram',
    medium: 'stories',
    campaign: 'stories_diario'
  },
  {
    id: 'insta-ads',
    title: 'Instagram / Facebook Ads (Anúncios Pagos)',
    channel: 'instagram',
    channelName: 'Instagram / Meta',
    icon: '📸',
    description: 'Para campanhas de tráfego pago no Gerenciador de Anúncios.',
    destination: '/',
    source: 'instagram',
    medium: 'meta_ads',
    campaign: 'campanha_servicos'
  },
  {
    id: 'google-ads',
    title: 'Google Ads — Pesquisa & Urgência',
    channel: 'google',
    channelName: 'Google Ads',
    icon: '🔍',
    description: 'Para campanhas de links patrocinados e palavras-chave na Busca Google.',
    destination: '/',
    source: 'google',
    medium: 'cpc',
    campaign: 'busca_urgencia'
  },
  {
    id: 'google-perfil',
    title: 'Google Meu Negócio / Perfil da Empresa',
    channel: 'google',
    channelName: 'Google',
    icon: '🔍',
    description: 'Para colocar no botão "Website" do perfil comercial no Google Maps.',
    destination: '/',
    source: 'google',
    medium: 'meu_negocio',
    campaign: 'perfil_local'
  },
  {
    id: 'whatsapp-disparo',
    title: 'WhatsApp — Mensagem de Divulgação / Disparo',
    channel: 'whatsapp',
    channelName: 'WhatsApp',
    icon: '💬',
    description: 'Para mensagens enviadas a listas de clientes ou grupos.',
    destination: '/',
    source: 'whatsapp',
    medium: 'disparo',
    campaign: 'divulgacao_direta'
  },
  {
    id: 'whatsapp-status',
    title: 'WhatsApp — Link no Status',
    channel: 'whatsapp',
    channelName: 'WhatsApp',
    icon: '💬',
    description: 'Para compartilhar em posts de status temporários.',
    destination: '/',
    source: 'whatsapp',
    medium: 'status',
    campaign: 'status_semanal'
  },
  {
    id: 'indicacao',
    title: 'Indicação / Parceiros & Afiliados',
    channel: 'indicacao',
    channelName: 'Indicação',
    icon: '🤝',
    description: 'Para parceiros comerciais e clientes que recomendam a plataforma.',
    destination: '/',
    source: 'indicacao',
    medium: 'parceiro',
    campaign: 'boca_a_boca'
  },
  {
    id: 'balcao-qr',
    title: 'Balcão / Fachada / Cartão de Visita',
    channel: 'balcao',
    channelName: 'Balcão & Físico',
    icon: '🚶',
    description: 'Ideal para gerar QR Code impresso no balcão, panfleto ou adesivo.',
    destination: '/',
    source: 'balcao',
    medium: 'impresso_qrcode',
    campaign: 'ponto_fisico'
  }
];

const AdminLinks: React.FC = () => {
  // Custom generator state
  const [baseUrl, setBaseUrl] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return 'https://uaifix.com';
  });

  const [destinationPath, setDestinationPath] = useState('/');
  const [source, setSource] = useState('instagram');
  const [medium, setMedium] = useState('');
  const [campaign, setCampaign] = useState('');
  const [term, setTerm] = useState('');

  // UI States
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('todos');
  const [showQrModal, setShowQrModal] = useState<string | null>(null);

  // Build full customized link
  const generatedCustomUrl = useMemo(() => {
    const cleanBase = baseUrl.replace(/\/+$/, '');
    const cleanPath = destinationPath.startsWith('/') ? destinationPath : `/${destinationPath}`;
    
    const params = new URLSearchParams();
    if (source) params.set('utm_source', source.toLowerCase().trim());
    if (medium) params.set('utm_medium', medium.toLowerCase().trim().replace(/\s+/g, '_'));
    if (campaign) params.set('utm_campaign', campaign.toLowerCase().trim().replace(/\s+/g, '_'));
    if (term) params.set('utm_term', term.toLowerCase().trim().replace(/\s+/g, '_'));

    const queryString = params.toString();
    return `${cleanBase}${cleanPath}${queryString ? `?${queryString}` : ''}`;
  }, [baseUrl, destinationPath, source, medium, campaign, term]);

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2200);
    } catch (err) {
      console.error('Falha ao copiar:', err);
    }
  };

  const buildPresetUrl = (p: PresetLink) => {
    const cleanBase = baseUrl.replace(/\/+$/, '');
    const cleanPath = p.destination.startsWith('/') ? p.destination : `/${p.destination}`;
    return `${cleanBase}${cleanPath}?utm_source=${p.source}&utm_medium=${p.medium}&utm_campaign=${p.campaign}`;
  };

  const filteredPresets = useMemo(() => {
    if (filterCategory === 'todos') return PRESET_LINKS;
    return PRESET_LINKS.filter(p => p.channel === filterCategory);
  }, [filterCategory]);

  return (
    <div className="space-y-8 pb-12">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="relative z-10 space-y-2 max-w-2xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold uppercase tracking-wider border border-blue-400/30">
            <Link2 size={14} /> Atribuição & Rastreamento
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Gerador de Links Rastreados (UTMs)</h1>
          <p className="text-sm text-slate-300">
            Copie links pré-configurados em 1 clique para suas redes sociais, anúncios e WhatsApp ou crie URLs personalizadas com métricas em tempo real.
          </p>
        </div>
      </div>

      {/* 1. SEÇÃO: PRESETS RÁPIDOS (1 CLIQUE PARA COPIAR) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sparkles size={18} className="text-amber-500" /> Links Prontos para Uso Rápido
            </h2>
            <p className="text-xs text-slate-500">Links padrão configurados para os principais pontos de contato com o cliente</p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setFilterCategory('todos')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border ${
                filterCategory === 'todos'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Todos
            </button>
            {Object.values(ORIGIN_CHANNELS).map(ch => (
              <button
                key={ch.key}
                onClick={() => setFilterCategory(ch.key)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 border ${
                  filterCategory === ch.key
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>{ch.icon}</span>
                <span>{ch.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
          {filteredPresets.map(preset => {
            const url = buildPresetUrl(preset);
            const isCopied = copiedId === preset.id;

            return (
              <div 
                key={preset.id}
                className="bg-slate-50/70 hover:bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-3 transition-all group hover:border-blue-300 hover:shadow-xs"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="text-base">{preset.icon}</span>
                      {preset.title}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600">
                      {preset.source}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">{preset.description}</p>
                </div>

                <div className="space-y-2">
                  <div className="bg-white px-3 py-2 rounded-xl border border-slate-200 text-[11px] font-mono text-slate-600 truncate select-all">
                    {url}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyToClipboard(url, preset.id)}
                      className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs ${
                        isCopied
                          ? 'bg-emerald-600 text-white'
                          : 'bg-blue-600 hover:bg-blue-500 text-white'
                      }`}
                    >
                      {isCopied ? (
                        <>
                          <Check size={14} />
                          <span>Link Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          <span>Copiar Link</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => setShowQrModal(url)}
                      className="p-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 transition-colors"
                      title="Gerar QR Code deste link"
                    >
                      <QrCode size={16} />
                    </button>

                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 transition-colors"
                      title="Testar link em nova aba"
                    >
                      <ExternalLink size={16} />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. SEÇÃO: GERADOR CUSTOMIZADO DE LINKS */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden p-6 space-y-6">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Share2 size={18} className="text-blue-600" /> Gerador de Links Personalizado
          </h2>
          <p className="text-xs text-slate-500">Crie URLs com parâmetros específicos para parcerias, influenciadores ou campanhas sazonais</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Formulário de Configuração */}
          <div className="lg:col-span-7 space-y-4">
            
            {/* Domínio / URL Base */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Domínio da Plataforma</label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://uaifix.com"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Página de Destino */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Página de Destino</label>
                <select
                  value={destinationPath}
                  onChange={(e) => setDestinationPath(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="/">Página Inicial (Landing Page / Home)</option>
                  <option value="/login">Página de Login / Cadastro</option>
                  <option value="/search">Buscar Serviços</option>
                  <option value="/category">Lista de Categorias</option>
                </select>
              </div>

              {/* Canal de Origem (utm_source) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Canal de Origem (utm_source)</label>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="instagram">📸 Instagram / Meta</option>
                  <option value="google">🔍 Google (Ads / Orgânico)</option>
                  <option value="whatsapp">💬 WhatsApp</option>
                  <option value="indicacao">🤝 Indicação / Boca a boca</option>
                  <option value="balcao">🚶 Balcão / Fachada / Físico</option>
                  <option value="tiktok">🎵 TikTok</option>
                  <option value="youtube">▶️ YouTube</option>
                  <option value="outros">🏷️ Outros</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Meio (utm_medium) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Meio / Tipo (utm_medium)</label>
                <input
                  type="text"
                  value={medium}
                  onChange={(e) => setMedium(e.target.value)}
                  placeholder="ex: stories, cpc, bio, panfleto"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              {/* Nome da Campanha (utm_campaign) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Campanha (utm_campaign)</label>
                <input
                  type="text"
                  value={campaign}
                  onChange={(e) => setCampaign(e.target.value)}
                  placeholder="ex: promo_verao, parceria_joao"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              {/* Termo / Variação (utm_term) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Termo / Variação (opcional)</label>
                <input
                  type="text"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="ex: eletricista, v1"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Preview & Ações */}
          <div className="lg:col-span-5 bg-slate-900 text-white p-5 rounded-2xl flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-400">URL Gerada Pronta</span>
                <span className="text-[10px] font-mono text-slate-400">Atribuição Automática</span>
              </div>

              <div className="p-3.5 bg-slate-800/90 rounded-xl border border-slate-700/80 font-mono text-xs text-slate-200 break-all select-all leading-relaxed max-h-36 overflow-y-auto">
                {generatedCustomUrl}
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => copyToClipboard(generatedCustomUrl, 'custom')}
                className={`w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md ${
                  copiedId === 'custom'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
              >
                {copiedId === 'custom' ? (
                  <>
                    <Check size={16} />
                    <span>Link Personalizado Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    <span>Copiar Link Personalizado</span>
                  </>
                )}
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setShowQrModal(generatedCustomUrl)}
                  className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-slate-700"
                >
                  <QrCode size={14} />
                  <span>Ver QR Code</span>
                </button>

                <a
                  href={generatedCustomUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-slate-700 text-center"
                >
                  <ExternalLink size={14} />
                  <span>Testar Link</span>
                </a>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* MODAL DE QR CODE */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-5 text-center relative animate-in fade-in zoom-in-95">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">QR Code de Rastreamento</h3>
              <p className="text-xs text-slate-500">Aponte a câmera do celular para testar ou baixe para imprimir no balcão.</p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 inline-block shadow-inner mx-auto">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(showQrModal)}`}
                alt="QR Code"
                className="w-48 h-48 mx-auto"
              />
            </div>

            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-[10px] font-mono text-slate-600 break-all select-all">
              {showQrModal}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => copyToClipboard(showQrModal, 'modal-qr')}
                className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs"
              >
                {copiedId === 'modal-qr' ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedId === 'modal-qr' ? 'Copiado!' : 'Copiar Link'}</span>
              </button>

              <button
                onClick={() => setShowQrModal(null)}
                className="py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminLinks;
