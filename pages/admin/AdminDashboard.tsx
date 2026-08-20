import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { 
  ClipboardList, Users, DollarSign, CheckCircle2, Clock, 
  AlertTriangle, TrendingUp, Star, ShieldCheck, ArrowUpRight,
  Share2, BarChart2, Link2, GitFork
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ORIGIN_CHANNELS } from '../../types';

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalChamados: 0,
    novosChamados: 0,
    orcamentos: 0,
    execucao: 0,
    concluidos: 0,
    recusados: 0,
    totalUsers: 0,
    totalProfessionals: 0,
    mediaSatisfacao: '4.9',
    origens: {} as Record<string, number>
  });

  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        setLoading(true);
        
        // Count chamados by status and origin
        const { data: chaves } = await supabase.from('chaves').select('id, status, origem');
        const { data: users } = await supabase.from('users').select('uuid, tipo');

        if (chaves) {
          const total = chaves.length;
          const novos = chaves.filter(c => ['pendente', 'solicitado', 'novo'].includes((c.status || '').toLowerCase())).length;
          const orc = chaves.filter(c => ['analise', 'aguardando_profissional', 'aguardando_aprovacao', 'orcamento', 'planejamento'].includes((c.status || '').toLowerCase())).length;
          const exec = chaves.filter(c => ['aprovado', 'executando', 'execucao', 'agendado'].includes((c.status || '').toLowerCase())).length;
          const conc = chaves.filter(c => ['concluido', 'aguardando_gestor'].includes((c.status || '').toLowerCase())).length;
          const rec = chaves.filter(c => ['recusado', 'reprovado', 'cancelado'].includes((c.status || '').toLowerCase())).length;

          const origensCount: Record<string, number> = {};
          chaves.forEach(c => {
            const orig = (c.origem || 'organico').toLowerCase();
            origensCount[orig] = (origensCount[orig] || 0) + 1;
          });

          setStats(prev => ({
            ...prev,
            totalChamados: total,
            novosChamados: novos,
            orcamentos: orc,
            execucao: exec,
            concluidos: conc,
            recusados: rec,
            origens: origensCount
          }));
        }

        if (users) {
          const totalU = users.length;
          const totalP = users.filter(u => {
            const normTipo = (u.tipo || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            return normTipo === 'profissional' || normTipo === 'prestador';
          }).length;
          setStats(prev => ({
            ...prev,
            totalUsers: totalU,
            totalProfessionals: totalP
          }));
        }

      } catch (err) {
        console.error('Erro ao carregar estatísticas do Admin Dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardStats();
  }, []);

  return (
    <div className="space-y-8">

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="relative z-10 space-y-2 max-w-2xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold uppercase tracking-wider border border-blue-400/30">
            Painel Executivo UAI Fix
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Visão Geral da Operação</h1>
          <p className="text-sm text-slate-300">
            Acompanhe em tempo real os indicadores de atendimento, taxa de conclusão de serviços e volume de usuários cadastrados.
          </p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Card Total Chamados */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total de Chamados</span>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <ClipboardList size={20} />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">{stats.totalChamados}</span>
            <span className="text-xs font-medium text-emerald-600 flex items-center gap-0.5">
              <TrendingUp size={14} /> Ativo
            </span>
          </div>
        </div>

        {/* Card Em Orçamento */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Em Orçamento</span>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Clock size={20} />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">{stats.orcamentos}</span>
            <span className="text-xs font-medium text-amber-600">Em Análise</span>
          </div>
        </div>

        {/* Card Em Execução */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Em Execução</span>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <CheckCircle2 size={20} />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">{stats.execucao}</span>
            <span className="text-xs font-medium text-indigo-600">Em Campo</span>
          </div>
        </div>

        {/* Card Profissionais Cadastrados */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Profissionais</span>
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <Users size={20} />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">{stats.totalProfessionals}</span>
            <span className="text-xs font-medium text-purple-600">Cadastrados</span>
          </div>
        </div>

      </div>

      {/* Origem e Canais de Entrada */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Share2 size={18} className="text-blue-600" />
            <h3 className="text-base font-bold text-slate-900">Canais de Aquisição (Origem de Clientes)</h3>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/admin/links')}
              className="text-xs font-bold text-slate-700 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 px-3 py-1.5 rounded-lg border border-slate-200 transition-all flex items-center gap-1.5"
            >
              <Link2 size={14} className="text-blue-600" />
              <span>Gerador de Links / UTMs</span>
            </button>
            <button 
              onClick={() => navigate('/admin/relatorios')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              Ver Relatório Completo <ArrowUpRight size={14} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Object.values(ORIGIN_CHANNELS).map(ch => {
            const count = stats.origens[ch.key] || 0;
            const pct = stats.totalChamados > 0 ? ((count / stats.totalChamados) * 100).toFixed(0) : '0';

            return (
              <div key={ch.key} className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-lg">{ch.icon}</span>
                  <span className="text-[10px] font-bold text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">{pct}%</span>
                </div>
                <div className="mt-2">
                  <div className="text-lg font-extrabold text-slate-900">{count}</div>
                  <div className="text-[11px] font-semibold text-slate-600 truncate">{ch.label}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Action & Control Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Atálhos Rápidos de Gestão */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">Ações Rápidas da Gestão</h3>
              <p className="text-xs text-slate-500">Gerencie ordens de serviço e cadastros com um clique</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
              onClick={() => navigate('/admin/fluxo')}
              className="p-4 rounded-xl border border-blue-200 bg-blue-50/30 hover:border-blue-500 hover:bg-blue-50 transition-all text-left group flex items-start space-x-3"
            >
              <div className="p-2.5 rounded-lg bg-blue-600 text-white group-hover:scale-105 transition-all shadow-sm">
                <GitFork size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-700 transition-colors flex items-center gap-1">
                  Fluxo do Serviço <ArrowUpRight size={14} />
                </h4>
                <p className="text-xs text-slate-500 mt-1">Fluxograma interativo completo: da captação ao pós-venda.</p>
              </div>
            </button>

            <button
              onClick={() => navigate('/admin/chamados')}
              className="p-4 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 transition-all text-left group flex items-start space-x-3"
            >
              <div className="p-2.5 rounded-lg bg-blue-100 text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition-all">
                <ClipboardList size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-700 transition-colors flex items-center gap-1">
                  Gerenciar Chamados <ArrowUpRight size={14} />
                </h4>
                <p className="text-xs text-slate-500 mt-1">Filtrar por status, editar orçamentos e aprovar chamados.</p>
              </div>
            </button>

            <button
              onClick={() => navigate('/admin/users')}
              className="p-4 rounded-xl border border-slate-200 hover:border-purple-500 hover:bg-purple-50/50 transition-all text-left group flex items-start space-x-3"
            >
              <div className="p-2.5 rounded-lg bg-purple-100 text-purple-700 group-hover:bg-purple-600 group-hover:text-white transition-all">
                <Users size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 group-hover:text-purple-700 transition-colors flex items-center gap-1">
                  Base de Usuários <ArrowUpRight size={14} />
                </h4>
                <p className="text-xs text-slate-500 mt-1">Consultar profissionais por cidade e perfis cadastrados.</p>
              </div>
            </button>
          </div>
        </div>

        {/* Resumo da Operação */}
        <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <ShieldCheck size={20} className="text-emerald-400" />
              <h3 className="text-base font-bold text-white">Certificação de Qualidade</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              O sistema UAI Fix opera com verificação contínua de segurança, políticas RLS ativas e monitoramento em tempo real.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>UAI Fix Admin v1.4.0</span>
            <span className="text-emerald-400 font-medium">100% Operacional</span>
          </div>
        </div>

      </div>

    </div>
  );
};

export default AdminDashboard;
