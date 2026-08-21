// @sos-edit: false
import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import {
  MessageSquare, Save, Loader2, Lock, Navigation, ExternalLink,
  CheckCircle2, AlertCircle, Phone, Bot, Send, ShieldCheck,
  RefreshCw, Check, Copy, Sparkles, UserCheck, Smartphone
} from 'lucide-react';
import { formatPhone } from '../../utils/masks';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';

const AdminWhatsappConfig: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [config, setConfig] = useState({
    instanceId: '3F35D1FCB74EC226D64CF6B0730C054E',
    token: '8F7D4AA58AC96A11B75178F4',
    clientToken: 'F7e9c17967b0f4968bcd39c8fb49e20d2S',
    botActive: true,
    managerPhone: '(31) 98248-0790',
    welcomeActive: true,
    welcomeMessage: 'Olá! Bem-vindo(a) à UAI-Fix 🛠️. Em que podemos te ajudar hoje?',
    webhookUrl: `${SUPABASE_URL}/functions/v1/zapi-webhook`
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('whatsapp_config')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) console.error('Erro ao buscar whatsapp_config:', error);

      if (data) {
        setConfig({
          instanceId: data.instance_id || '3F35D1FCB74EC226D64CF6B0730C054E',
          token: data.token || '',
          clientToken: data.client_token || '',
          botActive: data.bot_active !== false,
          managerPhone: data.manager_phone ? formatPhone(data.manager_phone) : '',
          welcomeActive: data.welcome_active !== false,
          welcomeMessage: data.welcome_message || 'Olá! Bem-vindo(a) à UAI-Fix 🛠️. Em que podemos te ajudar hoje?',
          webhookUrl: data.webhook_url || `${SUPABASE_URL}/functions/v1/zapi-webhook`
        });
      }
    } catch (err) {
      console.error('Erro geral ao carregar config:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setTestResult(null);
    try {
      const { data: existing } = await supabase
        .from('whatsapp_config')
        .select('id')
        .limit(1)
        .maybeSingle();

      const cleanManagerPhone = config.managerPhone.replace(/\D/g, '');

      const payload: any = {
        instance_id: config.instanceId.trim(),
        token: config.token.trim(),
        client_token: config.clientToken.trim() || null,
        welcome_active: config.welcomeActive,
        welcome_message: config.welcomeMessage,
        webhook_url: config.webhookUrl,
        active: true,
        bot_active: config.botActive,
        manager_phone: cleanManagerPhone || null
      };

      let saveErr;
      if (existing?.id) {
        const { error } = await supabase
          .from('whatsapp_config')
          .update(payload)
          .eq('id', existing.id);
        saveErr = error;

        // Se der erro de coluna inexistente (ex: bot_active ou manager_phone antes da migration)
        if (saveErr && saveErr.message?.includes('schema cache')) {
          delete payload.bot_active;
          delete payload.manager_phone;
          const { error: retryErr } = await supabase
            .from('whatsapp_config')
            .update(payload)
            .eq('id', existing.id);
          saveErr = retryErr;
        }
      } else {
        const { error } = await supabase
          .from('whatsapp_config')
          .insert(payload);
        saveErr = error;

        if (saveErr && saveErr.message?.includes('schema cache')) {
          delete payload.bot_active;
          delete payload.manager_phone;
          const { error: retryErr } = await supabase
            .from('whatsapp_config')
            .insert(payload);
          saveErr = retryErr;
        }
      }

      if (saveErr) throw saveErr;

      setTestResult({
        success: true,
        message: 'Configurações salvas com sucesso no banco de dados!'
      });
    } catch (err: any) {
      console.error('Erro ao salvar:', err);
      setTestResult({
        success: false,
        message: `Erro ao salvar: ${err.message || err}`
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestSend = async () => {
    if (!config.instanceId || !config.token) {
      setTestResult({
        success: false,
        message: 'Preencha o Instance ID e o Token da Z-API antes de testar.'
      });
      return;
    }

    let targetPhone = config.managerPhone.replace(/\D/g, '');
    if (!targetPhone) {
      setTestResult({
        success: false,
        message: 'Informe o WhatsApp do Gestor para receber a mensagem de teste.'
      });
      return;
    }

    if (targetPhone.length === 10 || targetPhone.length === 11) {
      targetPhone = `55${targetPhone}`;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (config.clientToken) headers['client-token'] = config.clientToken;

      const res = await fetch(`https://api.z-api.io/instances/${config.instanceId}/token/${config.token}/send-text`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          phone: targetPhone,
          message: '🧪 *UAI-Fix WhatsApp Bot — Teste de Integração*\n\nConexão estabelecida com sucesso! O Bot de Agendamento Automático está pronto para atender seus clientes.'
        })
      });

      const data = await res.json();
      if (res.ok) {
        setTestResult({
          success: true,
          message: `Mensagem de teste enviada com sucesso para ${formatPhone(targetPhone)}!`
        });
      } else {
        setTestResult({
          success: false,
          message: `Erro no envio Z-API: ${data.message || JSON.stringify(data)}`
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Falha na comunicação com Z-API: ${err.message}`
      });
    } finally {
      setTesting(false);
    }
  };

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(config.webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-blue-600" size={36} />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 text-white p-6 md:p-8 rounded-3xl shadow-xl">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-xs font-bold mb-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Integração Z-API & Bot UAI-Fix
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-3">
            <MessageSquare className="text-emerald-400" size={28} />
            Configurações do WhatsApp
          </h1>
          <p className="text-slate-400 text-sm">
            Gerencie as credenciais da Z-API, regras do Bot de Autoatendimento e notificações ao Gestor.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchConfig}
            className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl transition-all"
            title="Recarregar dados"
          >
            <RefreshCw size={18} />
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold rounded-2xl transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            Salvar Configurações
          </button>
        </div>
      </div>

      {/* Alerts */}
      {testResult && (
        <div className={`p-4 rounded-2xl border flex items-center gap-3 animate-in slide-in-from-top-2 ${
          testResult.success 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {testResult.success ? <CheckCircle2 className="text-emerald-600 shrink-0" size={20} /> : <AlertCircle className="text-rose-600 shrink-0" size={20} />}
          <p className="text-sm font-semibold">{testResult.message}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Coluna 1 & 2: Formulário Principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card 1: Credenciais Z-API */}
          <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200/80 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">Credenciais da Z-API</h2>
                  <p className="text-xs text-slate-500">Chaves de autenticação da instância conectada.</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Instance ID <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold">#</span>
                  <input
                    type="text"
                    value={config.instanceId}
                    onChange={(e) => setConfig({ ...config, instanceId: e.target.value })}
                    placeholder="Ex: 3F35D1FCB74EC226D64CF6B0730C054E"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 pl-9 pr-4 text-sm font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Token de Acesso (Instance Token) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    value={config.token}
                    onChange={(e) => setConfig({ ...config, token: e.target.value })}
                    placeholder="Cole seu token da Z-API"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 pl-11 pr-4 text-sm font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="md:col-span-2 space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Client Token (Opcional - Segurança Adicional)
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    value={config.clientToken}
                    onChange={(e) => setConfig({ ...config, clientToken: e.target.value })}
                    placeholder="Client-Token configurado no painel da Z-API (se houver)"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 pl-11 pr-4 text-sm font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Bot de Agendamento & Notificações */}
          <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200/80 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <Bot size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">Bot de Agendamento & Autoatendimento</h2>
                  <p className="text-xs text-slate-500">Comportamento conversacional e notificações em tempo real.</p>
                </div>
              </div>
            </div>

            <div className="space-y-5">
              {/* Switch Bot Active */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200/60">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Sparkles className="text-emerald-500" size={16} />
                    Ativar Bot de Agendamento Conversacional
                  </h3>
                  <p className="text-xs text-slate-500">
                    O bot conduz o diálogo, identifica o cliente por CPF, classifica o serviço e grava a OS no banco.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.botActive}
                    onChange={(e) => setConfig({ ...config, botActive: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-12 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>

              {/* Telefone do Gestor */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <Phone size={14} className="text-emerald-500" />
                  WhatsApp do Gestor (Receber Alertas de Novas OS)
                </label>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Smartphone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={config.managerPhone}
                      onChange={(e) => setConfig({ ...config, managerPhone: formatPhone(e.target.value) })}
                      placeholder="(35) 99999-8888"
                      maxLength={15}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 pl-11 pr-4 text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleTestSend}
                    disabled={testing}
                    className="px-5 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-2xl transition-all flex items-center gap-2 shrink-0 disabled:opacity-50"
                  >
                    {testing ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
                    Testar Disparo
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Sempre que um cliente concluir um agendamento no bot, o gestor receberá os dados completos no WhatsApp.
                </p>
              </div>

              {/* Mensagem de Boas-Vindas */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Mensagem de Saudação Inicial
                  </label>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.welcomeActive}
                      onChange={(e) => setConfig({ ...config, welcomeActive: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>
                <textarea
                  rows={3}
                  value={config.welcomeMessage}
                  onChange={(e) => setConfig({ ...config, welcomeMessage: e.target.value })}
                  placeholder="Mensagem enviada no primeiro contato do cliente..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Coluna 3: Webhook & Dicas Rápidas */}
        <div className="space-y-6">
          {/* Card Webhook URL */}
          <div className="bg-slate-900 text-white rounded-3xl p-6 md:p-8 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-emerald-400">
              <Navigation size={22} />
              <h2 className="text-base font-extrabold text-white">URL do Webhook Z-API</h2>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Configure esta URL no painel da sua instância na Z-API em <strong>Webhooks $\rightarrow$ Ao Receber Mensagem</strong>:
            </p>

            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2">
              <code className="text-[11px] font-mono text-emerald-300 break-all block">
                {config.webhookUrl}
              </code>
              <button
                onClick={handleCopyWebhook}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                {copied ? 'Copiado para a Área de Transferência!' : 'Copiar URL do Webhook'}
              </button>
            </div>
          </div>

          {/* Card Fluxo Resumido */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <UserCheck size={16} className="text-blue-500" />
              Como o Bot opera:
            </h3>
            <ul className="space-y-3 text-xs text-slate-600">
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                <span><strong>Identificação via CPF:</strong> Busca clientes existentes e reaproveita endereços salvos sem atrito.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                <span><strong>Classificador Semântico:</strong> Detecta termos como <em>vazamento, disjuntor, pintura</em> e sugere a categoria.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">3</span>
                <span><strong>Abertura da OS:</strong> Cria registro em <code>chaves</code> e dispara mensagem imediata no WhatsApp do Gestor.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminWhatsappConfig;
