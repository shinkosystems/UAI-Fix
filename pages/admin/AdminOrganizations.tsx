import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { Organization } from '../../types';
import { 
  Building2, Plus, Search, CheckCircle2, XCircle, Users, 
  ClipboardList, Settings, Edit2, Shield, ArrowUpRight, Loader2, Sparkles, Filter
} from 'lucide-react';

interface OrgStats extends Organization {
  totalUsers?: number;
  totalChaves?: number;
}

export const AdminOrganizations: React.FC = () => {
  const [organizations, setOrganizations] = useState<OrgStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    nome: '',
    slug: '',
    cnpj: '',
    razao_social: '',
    email_contato: '',
    telefone_contato: '',
    plano: 'pro',
    limite_colaboradores: 25,
    limite_chamados_mes: 500,
    cor_primaria: '#f89301',
    ativo: true
  });

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      setErrorMsg('');

      const { data: orgs, error } = await supabase
        .from('organizations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Buscar métricas agregadas por organização
      const { data: users } = await supabase.from('users').select('organization_id');
      const { data: chaves } = await supabase.from('chaves').select('organization_id');

      const userCounts: Record<string, number> = {};
      const chaveCounts: Record<string, number> = {};

      users?.forEach(u => {
        if (u.organization_id) {
          userCounts[u.organization_id] = (userCounts[u.organization_id] || 0) + 1;
        }
      });

      chaves?.forEach(c => {
        if (c.organization_id) {
          chaveCounts[c.organization_id] = (chaveCounts[c.organization_id] || 0) + 1;
        }
      });

      const enriched: OrgStats[] = (orgs || []).map(o => ({
        ...o,
        totalUsers: userCounts[o.id] || 0,
        totalChaves: chaveCounts[o.id] || 0
      }));

      setOrganizations(enriched);
    } catch (err: any) {
      console.error('Erro ao carregar organizações:', err);
      setErrorMsg(err.message || 'Falha ao buscar organizações.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const handleOpenCreateModal = () => {
    setSelectedOrg(null);
    setFormData({
      nome: '',
      slug: '',
      cnpj: '',
      razao_social: '',
      email_contato: '',
      telefone_contato: '',
      plano: 'pro',
      limite_colaboradores: 25,
      limite_chamados_mes: 500,
      cor_primaria: '#f89301',
      ativo: true
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (org: Organization) => {
    setSelectedOrg(org);
    setFormData({
      nome: org.nome || '',
      slug: org.slug || '',
      cnpj: org.cnpj || '',
      razao_social: org.razao_social || '',
      email_contato: org.email_contato || '',
      telefone_contato: org.telefone_contato || '',
      plano: org.plano || 'pro',
      limite_colaboradores: org.limite_colaboradores || 25,
      limite_chamados_mes: org.limite_chamados_mes || 500,
      cor_primaria: org.cor_primaria || '#f89301',
      ativo: org.ativo !== false
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome || !formData.slug) {
      alert('Preencha o Nome e o Slug da Organização.');
      return;
    }

    try {
      setIsSubmitting(true);

      if (selectedOrg) {
        // Update
        const { error } = await supabase
          .from('organizations')
          .update({
            nome: formData.nome,
            slug: formData.slug.toLowerCase().trim(),
            cnpj: formData.cnpj,
            razao_social: formData.razao_social,
            email_contato: formData.email_contato,
            telefone_contato: formData.telefone_contato,
            plano: formData.plano,
            limite_colaboradores: Number(formData.limite_colaboradores),
            limite_chamados_mes: Number(formData.limite_chamados_mes),
            cor_primaria: formData.cor_primaria,
            ativo: formData.ativo,
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedOrg.id);

        if (error) throw error;
      } else {
        // Create
        const { error } = await supabase
          .from('organizations')
          .insert([{
            nome: formData.nome,
            slug: formData.slug.toLowerCase().trim(),
            cnpj: formData.cnpj,
            razao_social: formData.razao_social,
            email_contato: formData.email_contato,
            telefone_contato: formData.telefone_contato,
            plano: formData.plano,
            limite_colaboradores: Number(formData.limite_colaboradores),
            limite_chamados_mes: Number(formData.limite_chamados_mes),
            cor_primaria: formData.cor_primaria,
            ativo: formData.ativo
          }]);

        if (error) throw error;
      }

      setIsModalOpen(false);
      fetchOrganizations();
    } catch (err: any) {
      alert(`Erro ao salvar organização: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = organizations.filter(o => 
    o.nome?.toLowerCase().includes(search.toLowerCase()) ||
    o.slug?.toLowerCase().includes(search.toLowerCase()) ||
    o.cnpj?.includes(search)
  );

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 text-white rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden border border-amber-500/20">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold uppercase tracking-wider border border-amber-500/30">
              <Building2 size={13} className="text-amber-400" />
              Governança Multi-Tenant UAI Fix
            </span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Gestão de Organizações & Empresas</h1>
            <p className="text-sm text-slate-300">
              Gerencie empresas parceiras, configure limites de colaboradores, planos e audite tarefas e equipes de forma segregada.
            </p>
          </div>

          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold px-5 py-3 rounded-xl shadow-lg shadow-amber-500/20 transition-all text-xs uppercase tracking-wider flex-shrink-0"
          >
            <Plus size={16} />
            Nova Organização
          </button>
        </div>
      </div>

      {/* Toolbar / Search */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome, slug ou CNPJ..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-slate-50"
          />
        </div>

        <div className="text-xs text-slate-500 font-semibold flex items-center gap-2">
          <span>Total de Organizações:</span>
          <span className="bg-slate-100 text-slate-800 px-2.5 py-0.5 rounded-full font-bold">
            {filtered.length}
          </span>
        </div>
      </div>

      {/* Error state */}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-xs font-semibold">
          {errorMsg}
        </div>
      )}

      {/* Grid of Organizations */}
      {loading ? (
        <div className="min-h-[300px] flex flex-col items-center justify-center gap-3">
          <Loader2 className="animate-spin text-amber-500" size={32} />
          <p className="text-xs text-slate-500">Carregando organizações cadastradas...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-3">
          <Building2 size={40} className="mx-auto text-slate-400" />
          <h3 className="text-sm font-bold text-slate-700">Nenhuma organização encontrada</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Cadastre a primeira empresa para iniciar a gestão segregada de equipes e ordens de serviço.
          </p>
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 bg-amber-500 text-slate-950 px-4 py-2 rounded-lg text-xs font-bold hover:bg-amber-600 transition-all"
          >
            <Plus size={14} /> Cadastrar Empresa
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(org => (
            <div 
              key={org.id}
              className="bg-white rounded-2xl border border-slate-200 hover:border-amber-400/60 p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div className="space-y-4">
                {/* Org Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-500/20 border border-amber-500/30 flex items-center justify-center font-black text-amber-700 text-base">
                      {org.nome?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
                        {org.nome}
                      </h3>
                      <p className="text-[11px] font-mono text-slate-400">/{org.slug}</p>
                    </div>
                  </div>

                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    org.ativo !== false ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}>
                    {org.ativo !== false ? 'Ativa' : 'Inativa'}
                  </span>
                </div>

                {/* Details */}
                <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
                  {org.cnpj && (
                    <p className="flex justify-between">
                      <span className="text-slate-400">CNPJ:</span>
                      <span className="font-medium text-slate-800">{org.cnpj}</span>
                    </p>
                  )}
                  {org.email_contato && (
                    <p className="flex justify-between truncate">
                      <span className="text-slate-400">Contato:</span>
                      <span className="font-medium text-slate-800 truncate">{org.email_contato}</span>
                    </p>
                  )}
                  <p className="flex justify-between">
                    <span className="text-slate-400">Plano:</span>
                    <span className="font-bold text-amber-600 uppercase text-[10px] bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      {org.plano || 'Standard'}
                    </span>
                  </p>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-center gap-2.5">
                    <Users size={16} className="text-blue-500" />
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Colaboradores</p>
                      <p className="text-sm font-black text-slate-800">{org.totalUsers || 0} / {org.limite_colaboradores || 25}</p>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-center gap-2.5">
                    <ClipboardList size={16} className="text-emerald-500" />
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Ordens de Serviço</p>
                      <p className="text-sm font-black text-slate-800">{org.totalChaves || 0}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="pt-5 mt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => handleOpenEditModal(org)}
                  className="text-xs font-bold text-slate-600 hover:text-amber-600 flex items-center gap-1.5 transition-colors"
                >
                  <Edit2 size={13} />
                  Editar Dados
                </button>

                <button
                  onClick={() => {
                    localStorage.setItem('active_tenant_filter', org.id);
                    alert(`Filtro ativo: ${org.nome}. Redirecionando para o painel de chamados.`);
                    window.location.href = '#/admin/chamados';
                  }}
                  className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1 transition-colors"
                >
                  Ver Operação <ArrowUpRight size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-8 space-y-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl border border-amber-200">
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {selectedOrg ? 'Editar Organização' : 'Nova Organização'}
                  </h3>
                  <p className="text-xs text-slate-400">Dados da empresa para segregação multi-tenant</p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nome da Empresa *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Construtora Alfa"
                    value={formData.nome}
                    onChange={e => setFormData({ ...formData, nome: e.target.value })}
                    className="w-full text-xs px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Slug (URL / Tenant ID) *</label>
                  <input
                    type="text"
                    required
                    placeholder="ex: construtora-alfa"
                    value={formData.slug}
                    onChange={e => setFormData({ ...formData, slug: e.target.value })}
                    className="w-full text-xs px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">CNPJ</label>
                  <input
                    type="text"
                    placeholder="00.000.000/0000-00"
                    value={formData.cnpj}
                    onChange={e => setFormData({ ...formData, cnpj: e.target.value })}
                    className="w-full text-xs px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Razão Social</label>
                  <input
                    type="text"
                    placeholder="Razão Social LTDA"
                    value={formData.razao_social}
                    onChange={e => setFormData({ ...formData, razao_social: e.target.value })}
                    className="w-full text-xs px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email de Contato</label>
                  <input
                    type="email"
                    placeholder="gestao@empresa.com"
                    value={formData.email_contato}
                    onChange={e => setFormData({ ...formData, email_contato: e.target.value })}
                    className="w-full text-xs px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Telefone / WhatsApp</label>
                  <input
                    type="text"
                    placeholder="(31) 99999-9999"
                    value={formData.telefone_contato}
                    onChange={e => setFormData({ ...formData, telefone_contato: e.target.value })}
                    className="w-full text-xs px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Plano</label>
                  <select
                    value={formData.plano}
                    onChange={e => setFormData({ ...formData, plano: e.target.value })}
                    className="w-full text-xs px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="starter">Starter</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Limite Equipe</label>
                  <input
                    type="number"
                    value={formData.limite_colaboradores}
                    onChange={e => setFormData({ ...formData, limite_colaboradores: Number(e.target.value) })}
                    className="w-full text-xs px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Limite OS/Mês</label>
                  <input
                    type="number"
                    value={formData.limite_chamados_mes}
                    onChange={e => setFormData({ ...formData, limite_chamados_mes: Number(e.target.value) })}
                    className="w-full text-xs px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="org_ativo"
                  checked={formData.ativo}
                  onChange={e => setFormData({ ...formData, ativo: e.target.checked })}
                  className="rounded text-amber-500 focus:ring-amber-500 w-4 h-4"
                />
                <label htmlFor="org_ativo" className="text-xs font-semibold text-slate-700">
                  Organização Ativa e com acesso liberado ao sistema
                </label>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-5 py-2 rounded-lg text-xs transition-all shadow-md shadow-amber-500/20 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  Salvar Organização
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminOrganizations;
