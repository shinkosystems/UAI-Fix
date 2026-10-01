import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { Search, Users, UserCheck, Shield, Mail, Phone, MapPin, RefreshCw, Edit2, Building2, Briefcase, Sparkles } from 'lucide-react';
import { User, Organization, Geral } from '../../types';
import AdminUserEditModal from '../../components/modals/AdminUserEditModal';

const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [services, setServices] = useState<Geral[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('todos');
  const [selectedOrgFilter, setSelectedOrgFilter] = useState<string>('todas');

  // Modal State
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersRes, orgsRes, servicesRes] = await Promise.all([
        supabase.from('users').select('*').order('nome', { ascending: true }),
        supabase.from('organizations').select('*').order('nome', { ascending: true }),
        supabase.from('geral').select('*').order('nome', { ascending: true })
      ]);

      if (usersRes.error) throw usersRes.error;
      setUsers(usersRes.data || []);
      setOrganizations(orgsRes.data || []);
      setServices(servicesRes.data || []);
    } catch (err) {
      console.error('Erro ao carregar usuários e organizações no Admin:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCardClick = (u: User) => {
    setSelectedUser(u);
    setIsModalOpen(true);
  };

  const handleUserUpdated = (updatedUser: User) => {
    setUsers((prevUsers) =>
      prevUsers.map((usr) => {
        if ((usr.uuid && usr.uuid === updatedUser.uuid) || usr.id === updatedUser.id) {
          return updatedUser;
        }
        return usr;
      })
    );
    if (selectedUser && ((selectedUser.uuid && selectedUser.uuid === updatedUser.uuid) || selectedUser.id === updatedUser.id)) {
      setSelectedUser(updatedUser);
    }
  };

  const filteredUsers = users.filter(u => {
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch = term === '' ||
      u.nome?.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term);

    const isInactive = u.ativo === false;

    // Filter for Inactive Users tab
    if (selectedRole === 'inativo') {
      return matchesSearch && isInactive;
    }

    // Exclude inactive users from active role tabs ('todos', 'cliente', 'gestor', etc.)
    if (isInactive) {
      return false;
    }

    const normTipo = (u.tipo || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    let matchesRole = true;
    if (selectedRole === 'cliente') {
      matchesRole = normTipo === 'consumidor' || normTipo === 'cliente';
    } else if (selectedRole === 'profissional') {
      matchesRole = normTipo === 'profissional' || normTipo === 'prestador';
    } else if (selectedRole === 'orcamentista') {
      matchesRole = normTipo === 'orcamentista';
    } else if (selectedRole === 'planejista') {
      matchesRole = normTipo === 'planejista';
    } else if (selectedRole === 'gestor') {
      matchesRole = normTipo === 'gestor';
    } else if (selectedRole !== 'todos') {
      matchesRole = normTipo === selectedRole;
    }

    // Filter by Organization
    let matchesOrg = true;
    if (selectedOrgFilter !== 'todas') {
      matchesOrg = u.organization_id === selectedOrgFilter;
    }

    return matchesSearch && matchesRole && matchesOrg;
  });

  const activeUsers = users.filter(u => u.ativo !== false);
  const inactiveUsers = users.filter(u => u.ativo === false);

  const getRoleCount = (roleId: string) => {
    if (roleId === 'inativo') return inactiveUsers.length;
    if (roleId === 'todos') return activeUsers.length;
    return activeUsers.filter(u => {
      const normTipo = (u.tipo || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (roleId === 'cliente') return normTipo === 'consumidor' || normTipo === 'cliente';
      if (roleId === 'profissional') return normTipo === 'profissional' || normTipo === 'prestador';
      if (roleId === 'orcamentista') return normTipo === 'orcamentista';
      if (roleId === 'planejista') return normTipo === 'planejista';
      if (roleId === 'gestor') return normTipo === 'gestor';
      return normTipo === roleId;
    }).length;
  };

  const getOrgName = (orgId?: string | null) => {
    if (!orgId) return null;
    const found = organizations.find(o => o.id === orgId);
    return found ? found.nome : null;
  };

  const getServiceNames = (activityIds?: number[]) => {
    if (!activityIds || !Array.isArray(activityIds) || activityIds.length === 0) return [];
    return services.filter(s => activityIds.includes(s.id)).map(s => s.nome);
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            Gestão de Equipes & Colaboradores
            <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-0.5 rounded-full font-bold border border-amber-300/60">
              Multi-Tenant
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">Gerencie colaboradores por organização, cargos, permissões e especialidades técnicas habilitadas.</p>
        </div>
        <button
          onClick={fetchData}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all shadow-xs cursor-pointer"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Atualizar Lista
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row gap-4 justify-between items-center">

        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          {/* Search input */}
          <div className="relative w-full sm:w-64">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nome ou e-mail..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 transition-all"
            />
          </div>

          {/* Organization Filter Dropdown */}
          <div className="w-full sm:w-56">
            <select
              value={selectedOrgFilter}
              onChange={(e) => setSelectedOrgFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="todas">🏢 Todas as Organizações</option>
              {organizations.map(org => (
                <option key={org.id} value={org.id}>
                  {org.nome} ({org.slug})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full lg:w-auto pb-1 lg:pb-0">
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'profissional', label: 'Técnicos / Colab.' },
            { id: 'gestor', label: 'Gestores' },
            { id: 'cliente', label: 'Clientes' },
            { id: 'orcamentista', label: 'Orçamentistas' },
            { id: 'planejista', label: 'Planejistas' },
            { id: 'inativo', label: 'Inativos' }
          ].map((role) => {
            const count = getRoleCount(role.id);
            const isSelected = selectedRole === role.id;
            const isInactiveTab = role.id === 'inativo';

            return (
              <button
                key={role.id}
                onClick={() => setSelectedRole(role.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? isInactiveTab
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-blue-600 text-white shadow-xs'
                    : isInactiveTab
                      ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/60'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{role.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                  isSelected
                    ? 'bg-white/20 text-white'
                    : isInactiveTab
                      ? 'bg-rose-200/60 text-rose-800'
                      : 'bg-slate-200 text-slate-700'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

      </div>

      {/* Grid of User Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full p-12 text-center text-slate-400">
            Carregando usuários e equipes...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="col-span-full p-12 text-center text-slate-400">
            Nenhum colaborador ou usuário encontrado com os filtros aplicados.
          </div>
        ) : (
          filteredUsers.map((u) => {
            const isUserInactive = u.ativo === false;
            const orgName = getOrgName(u.organization_id);
            const userServices = getServiceNames(u.atividade);

            return (
              <div
                key={u.uuid || u.id}
                onClick={() => handleCardClick(u)}
                className={`p-5 rounded-2xl border shadow-xs space-y-4 hover:shadow-md transition-all cursor-pointer group relative flex flex-col justify-between ${
                  isUserInactive
                    ? 'bg-slate-50/80 border-rose-200 hover:border-rose-300'
                    : 'bg-white border-slate-200 hover:border-amber-400/70'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-3 truncate">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-700 overflow-hidden border border-slate-200 flex-shrink-0">
                        {u.fotoperfil ? (
                          <img src={u.fotoperfil} alt={u.nome} className="w-full h-full object-cover" />
                        ) : (
                          <span>{u.nome?.substring(0, 2).toUpperCase() || 'US'}</span>
                        )}
                      </div>
                      <div className="truncate">
                        <h3 className="text-sm font-bold text-slate-900 group-hover:text-amber-600 transition-colors truncate flex items-center gap-1.5">
                          {u.nome || 'Usuário'}
                          {u.is_super_admin && (
                            <span className="bg-amber-500 text-slate-950 text-[9px] font-black uppercase px-1.5 py-0.2 rounded" title="Super Administrador">
                              Super Admin
                            </span>
                          )}
                        </h3>
                        
                        <div className="flex flex-wrap items-center gap-1 mt-1">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-slate-100 text-slate-700">
                            {u.cargo || u.tipo || 'Consumidor'}
                          </span>
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                            isUserInactive
                              ? 'bg-rose-100 text-rose-700 border border-rose-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}>
                            {isUserInactive ? 'Inativo' : 'Ativo'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-amber-600 group-hover:bg-amber-50 group-hover:border-amber-200 transition-all flex-shrink-0">
                      <Edit2 size={14} />
                    </div>
                  </div>

                  {/* Organization and Department Badge */}
                  {orgName && (
                    <div className="bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl flex items-center justify-between text-[11px] text-slate-600 font-medium">
                      <span className="flex items-center gap-1.5 font-bold text-slate-800 truncate">
                        <Building2 size={13} className="text-amber-600 flex-shrink-0" />
                        <span className="truncate">{orgName}</span>
                      </span>
                      {u.departamento && (
                        <span className="text-[10px] text-slate-500 font-semibold bg-white px-2 py-0.5 rounded border border-slate-200">
                          {u.departamento}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Technical Activities / Skills Badges */}
                  {userServices.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1">
                        <Briefcase size={10} /> Atividades Habilitadas ({userServices.length})
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {userServices.slice(0, 3).map((svc, idx) => (
                          <span key={idx} className="bg-blue-50 text-blue-700 text-[10px] font-semibold px-2 py-0.5 rounded border border-blue-200">
                            {svc}
                          </span>
                        ))}
                        {userServices.length > 3 && (
                          <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-1.5 py-0.5 rounded">
                            +{userServices.length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 pt-3 border-t border-slate-100 mt-2">
                  {u.email && (
                    <div className="flex items-center space-x-2 truncate">
                      <Mail size={14} className="text-slate-400 flex-shrink-0" />
                      <span className="truncate">{u.email}</span>
                    </div>
                  )}
                  {u.whatsapp && (
                    <div className="flex items-center space-x-2 truncate">
                      <Phone size={14} className="text-slate-400 flex-shrink-0" />
                      <span className="truncate">{u.whatsapp}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* User Edit Modal */}
      <AdminUserEditModal
        user={selectedUser}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onUserUpdated={handleUserUpdated}
      />

    </div>
  );
};

export default AdminUsers;

