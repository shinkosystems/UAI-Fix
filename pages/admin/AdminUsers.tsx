import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { Search, Users, UserCheck, Shield, Mail, Phone, MapPin, RefreshCw, Edit2 } from 'lucide-react';
import { User } from '../../types';
import AdminUserEditModal from '../../components/modals/AdminUserEditModal';

const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('todos');

  // Modal State
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('nome', { ascending: true });

      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error('Erro ao carregar usuários no Admin:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
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

    return matchesSearch && matchesRole;
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

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Gestão de Usuários & Profissionais</h1>
          <p className="text-xs text-slate-500 mt-1">Base de clientes e prestadores de serviços cadastrados na plataforma. Clique em um card para visualizar e editar os dados.</p>
        </div>
        <button
          onClick={fetchUsers}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all shadow-xs cursor-pointer"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Atualizar Lista
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-4 justify-between items-center">

        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome ou e-mail..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'cliente', label: 'Cliente' },
            { id: 'profissional', label: 'Profissional' },
            { id: 'orcamentista', label: 'Orçamentista' },
            { id: 'planejista', label: 'Planejista' },
            { id: 'gestor', label: 'Gestor' },
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
            Carregando usuários...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="col-span-full p-12 text-center text-slate-400">
            Nenhum usuário encontrado com os filtros aplicados.
          </div>
        ) : (
          filteredUsers.map((u) => {
            const isUserInactive = u.ativo === false;
            return (
              <div
                key={u.uuid || u.id}
                onClick={() => handleCardClick(u)}
                className={`p-5 rounded-2xl border shadow-xs space-y-4 hover:shadow-md transition-all cursor-pointer group relative ${
                  isUserInactive
                    ? 'bg-slate-50/80 border-rose-200 hover:border-rose-300'
                    : 'bg-white border-slate-200 hover:border-blue-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 truncate">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-700 overflow-hidden border border-slate-200 flex-shrink-0">
                      {u.fotoperfil ? (
                        <img src={u.fotoperfil} alt={u.nome} className="w-full h-full object-cover" />
                      ) : (
                        <span>{u.nome?.substring(0, 2).toUpperCase() || 'US'}</span>
                      )}
                    </div>
                    <div className="truncate">
                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">{u.nome || 'Usuário'}</h3>
                      <div className="flex items-center space-x-1.5 mt-0.5">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-slate-100 text-slate-700">
                          {u.tipo || 'Consumidor'}
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

                  <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50 group-hover:border-blue-100 transition-all flex-shrink-0">
                    <Edit2 size={14} />
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
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

