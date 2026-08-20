import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { Geral } from '../../types';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Layers, 
  CheckCircle, 
  XCircle, 
  FolderTree, 
  Box, 
  Image as ImageIcon, 
  Loader2, 
  Save, 
  X, 
  AlertTriangle,
  Upload,
  ArrowRight,
  Sparkles,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';

export const AdminAtividades: React.FC = () => {
  const [services, setServices] = useState<Geral[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'primary' | 'secondary'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterParent, setFilterParent] = useState<string>('all');

  // Modal de Criação / Edição
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<{
    nome: string;
    imagem: string;
    primaria: boolean;
    dependencia: number | null;
    ativa: boolean;
  }>({
    nome: '',
    imagem: '',
    primaria: false,
    dependencia: null,
    ativa: true
  });

  // Modal de Realocação de dependências órfãs
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [orphanedChildrenCount, setOrphanedChildrenCount] = useState(0);
  const [newParentId, setNewParentId] = useState<number | ''>('');
  const [availableParents, setAvailableParents] = useState<Geral[]>([]);

  const fetchServices = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('geral')
        .select('*')
        .order('nome', { ascending: true });
      if (error) throw error;
      setServices(data || []);
    } catch (err: any) {
      console.error('Erro ao buscar serviços:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  // Primary categories lookup map
  const primaryCategories = services.filter(s => s.primaria);
  const parentMap: Record<number, string> = {};
  services.forEach(s => {
    parentMap[s.id] = s.nome;
  });

  // Quick Toggle Status
  const handleToggleStatus = async (item: Geral) => {
    const newStatus = !item.ativa;
    try {
      // Optimistic update
      setServices(prev => prev.map(s => s.id === item.id ? { ...s, ativa: newStatus } : s));
      const { error } = await supabase
        .from('geral')
        .update({ ativa: newStatus })
        .eq('id', item.id);
      if (error) throw error;
    } catch (err: any) {
      console.error('Erro ao atualizar status:', err);
      alert('Erro ao atualizar status da atividade.');
      fetchServices();
    }
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData({
      nome: '',
      imagem: '',
      primaria: false,
      dependencia: primaryCategories.length > 0 ? primaryCategories[0].id : null,
      ativa: true
    });
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (item: Geral) => {
    setEditingId(item.id);
    setFormData({
      nome: item.nome || '',
      imagem: item.imagem || '',
      primaria: !!item.primaria,
      dependencia: item.dependencia || null,
      ativa: item.ativa !== false
    });
    setIsModalOpen(true);
  };

  // Upload de Imagem
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      if (!event.target.files || event.target.files.length === 0) return;
      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `categorias/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('categorias').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('categorias').getPublicUrl(filePath);
      setFormData(prev => ({ ...prev, imagem: data.publicUrl }));
    } catch (error: any) {
      alert('Erro ao fazer upload da imagem: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  // Salvar Criação ou Edição
  const handleSave = async () => {
    if (!formData.nome || formData.nome.trim() === '') {
      alert('Por favor, informe o nome da atividade.');
      return;
    }

    if (!formData.primaria && !formData.dependencia) {
      alert('Por favor, selecione uma Categoria Pai para o serviço secundário.');
      return;
    }

    // Se estiver editando uma categoria primária e transformando em secundária
    if (editingId) {
      const original = services.find(s => s.id === editingId);
      if (original?.primaria && !formData.primaria) {
        setSaving(true);
        const { count } = await supabase
          .from('geral')
          .select('*', { count: 'exact', head: true })
          .eq('dependencia', editingId);

        if (count && count > 0) {
          setOrphanedChildrenCount(count);
          setAvailableParents(services.filter(s => s.primaria && s.id !== editingId));
          setNewParentId('');
          setSaving(false);
          setIsReassignModalOpen(true);
          return;
        }
        setSaving(false);
      }
    }

    const payload = {
      nome: formData.nome.trim(),
      imagem: formData.imagem || '',
      primaria: formData.primaria,
      dependencia: formData.primaria ? null : formData.dependencia,
      ativa: formData.ativa
    };

    await executeSave(payload);
  };

  const executeSave = async (payload: any) => {
    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from('geral')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('geral')
          .insert(payload);
        if (error) throw error;
      }

      setIsModalOpen(false);
      await fetchServices();
      alert(editingId ? 'Atividade atualizada com sucesso!' : 'Atividade criada com sucesso!');
    } catch (err: any) {
      console.error('Erro ao salvar:', err);
      alert(`Erro ao salvar atividade: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Reatribuição de dependências órfãs
  const handleReassignAndSave = async () => {
    if (!newParentId) {
      alert('Selecione uma nova categoria pai.');
      return;
    }
    setSaving(true);
    try {
      const { error: childrenError } = await supabase
        .from('geral')
        .update({ dependencia: newParentId })
        .eq('dependencia', editingId);
      if (childrenError) throw childrenError;

      const payload = {
        nome: formData.nome.trim(),
        imagem: formData.imagem || '',
        primaria: formData.primaria,
        dependencia: formData.dependencia,
        ativa: formData.ativa
      };
      await executeSave(payload);
      setIsReassignModalOpen(false);
    } catch (err: any) {
      console.error('Erro ao realocar dependências:', err);
      alert('Erro ao realocar dependências.');
      setSaving(false);
    }
  };

  // Excluir Atividade
  const handleDelete = async (id: number, nome: string) => {
    // Verifica se possui dependentes
    const children = services.filter(s => s.dependencia === id);
    if (children.length > 0) {
      alert(`Não é possível excluir a categoria "${nome}" pois existem ${children.length} sub-serviço(s) vinculados a ela. Remova ou realoque os sub-serviços primeiro.`);
      return;
    }

    if (!window.confirm(`Tem certeza que deseja excluir a atividade "${nome}"?`)) return;

    try {
      const { error } = await supabase.from('geral').delete().eq('id', id);
      if (error) throw error;
      setServices(prev => prev.filter(s => s.id !== id));
      alert('Atividade excluída com sucesso.');
    } catch (err: any) {
      console.error('Erro ao excluir:', err);
      alert(`Erro ao excluir atividade: ${err.message}`);
    }
  };

  // Filtros aplicados
  const filteredServices = services.filter(s => {
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch = term === '' || s.nome.toLowerCase().includes(term);

    const matchesType = 
      filterType === 'all' || 
      (filterType === 'primary' && s.primaria) || 
      (filterType === 'secondary' && !s.primaria);

    const matchesStatus = 
      filterStatus === 'all' || 
      (filterStatus === 'active' && s.ativa !== false) || 
      (filterStatus === 'inactive' && s.ativa === false);

    const matchesParent = 
      filterParent === 'all' || 
      (s.dependencia?.toString() === filterParent);

    return matchesSearch && matchesType && matchesStatus && matchesParent;
  });

  const totalPrimary = services.filter(s => s.primaria).length;
  const totalSecondary = services.filter(s => !s.primaria).length;
  const totalActive = services.filter(s => s.ativa !== false).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header & Ação Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-blue-600 mb-1">
            <Layers size={22} />
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Gestão de Atividades & Serviços</h1>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Gerencie o catálogo completo de categorias, serviços e especialidades da plataforma UAI Fix
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 active:scale-95 flex-shrink-0"
        >
          <Plus size={16} />
          <span>Nova Atividade / Serviço</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Cadastrado</span>
            <Layers size={16} className="text-blue-500" />
          </div>
          <p className="text-2xl font-black text-slate-900">{services.length}</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Categorias Principais</span>
            <FolderTree size={16} className="text-indigo-500" />
          </div>
          <p className="text-2xl font-black text-slate-900">{totalPrimary}</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Sub-Serviços</span>
            <Box size={16} className="text-purple-500" />
          </div>
          <p className="text-2xl font-black text-slate-900">{totalSecondary}</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Ativos na Plataforma</span>
            <CheckCircle size={16} className="text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-600">{totalActive}</p>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          
          {/* Busca por Texto */}
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nome da atividade..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:bg-white transition-all"
            />
          </div>

          {/* Filtro por Tipo */}
          <div>
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value as any)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all"
            >
              <option value="all">Todos os Tipos</option>
              <option value="primary">Apenas Categorias Principais (Primárias)</option>
              <option value="secondary">Apenas Sub-Serviços (Secundárias)</option>
            </select>
          </div>

          {/* Filtro por Categoria Pai */}
          <div>
            <select
              value={filterParent}
              onChange={e => setFilterParent(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all"
            >
              <option value="all">Todas as Categorias Pai</option>
              {primaryCategories.map(p => (
                <option key={p.id} value={p.id.toString()}>{p.nome}</option>
              ))}
            </select>
          </div>

          {/* Filtro por Status */}
          <div>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as any)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all"
            >
              <option value="all">Todos os Status</option>
              <option value="active">Apenas Ativos</option>
              <option value="inactive">Apenas Inativos</option>
            </select>
          </div>

        </div>
      </div>

      {/* Tabela de Atividades */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <Loader2 className="animate-spin mx-auto mb-2 text-blue-600" size={28} />
            <p className="text-xs font-bold uppercase tracking-wider">Carregando catálogo de atividades...</p>
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <Layers className="mx-auto text-slate-300" size={36} />
            <p className="text-sm font-bold text-slate-600">Nenhuma atividade encontrada com os filtros selecionados.</p>
            <p className="text-xs text-slate-400">Tente ajustar a busca ou clique no botão acima para cadastrar uma nova.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 uppercase tracking-wider font-bold">
                <tr>
                  <th className="px-6 py-4">ID</th>
                  <th className="px-6 py-4">Atividade / Imagem</th>
                  <th className="px-6 py-4">Tipo</th>
                  <th className="px-6 py-4">Categoria Pai</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredServices.map(item => {
                  const parentName = item.dependencia ? parentMap[item.dependencia] : null;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      
                      {/* ID */}
                      <td className="px-6 py-4 font-mono font-bold text-slate-400">
                        #{item.id}
                      </td>

                      {/* Nome e Imagem */}
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {item.imagem ? (
                              <img src={item.imagem} alt={item.nome} className="w-full h-full object-cover" />
                            ) : (
                              <ImageIcon size={18} className="text-slate-400" />
                            )}
                          </div>
                          <div>
                            <p className="font-extrabold text-slate-900 text-sm tracking-tight">{item.nome}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {item.primaria ? 'Categoria Raiz no Catálogo' : 'Sub-serviço / Especialidade'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Tipo */}
                      <td className="px-6 py-4">
                        {item.primaria ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <FolderTree size={12} />
                            <span>Primária</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            <Box size={12} />
                            <span>Secundária</span>
                          </span>
                        )}
                      </td>

                      {/* Categoria Pai */}
                      <td className="px-6 py-4">
                        {item.primaria ? (
                          <span className="text-slate-400 italic">—</span>
                        ) : parentName ? (
                          <span className="font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                            {parentName}
                          </span>
                        ) : (
                          <span className="text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            Sem Pai Vinculado
                          </span>
                        )}
                      </td>

                      {/* Status Toggle */}
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleToggleStatus(item)}
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold border transition-all active:scale-95 ${
                            item.ativa !== false
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                          }`}
                          title="Clique para alternar o status"
                        >
                          {item.ativa !== false ? (
                            <>
                              <CheckCircle size={12} className="text-emerald-600" />
                              <span>Ativa</span>
                            </>
                          ) : (
                            <>
                              <XCircle size={12} className="text-red-500" />
                              <span>Inativa</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Ações */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-2 rounded-xl bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600 transition-all active:scale-95"
                            title="Editar atividade"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id, item.nome)}
                            className="p-2 rounded-xl bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 transition-all active:scale-95"
                            title="Excluir atividade"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Criação / Edição */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl p-6 sm:p-7 space-y-5 border border-slate-100">
            
            {/* Header Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Layers size={18} />
                </div>
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                  {editingId ? 'Editar Atividade / Serviço' : 'Nova Atividade / Serviço'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Formulário */}
            <div className="space-y-4 text-xs font-semibold text-slate-700">
              
              {/* Nome */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Nome da Atividade / Serviço *
                </label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={e => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: Faxina Residencial Completa, Instalação Elétrica, etc."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 outline-none focus:border-blue-500 focus:bg-white transition-all"
                />
              </div>

              {/* Tipo: Primária ou Secundária */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Tipo de Classificação
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, primaria: true, dependencia: null })}
                    className={`p-3 rounded-2xl border text-left flex items-start gap-2.5 transition-all ${
                      formData.primaria
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-900 shadow-2xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <FolderTree size={16} className={formData.primaria ? 'text-indigo-600' : 'text-slate-400'} />
                    <div>
                      <p className="font-bold text-xs">Categoria Principal</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Aparece na tela inicial</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, primaria: false, dependencia: formData.dependencia || (primaryCategories[0]?.id || null) })}
                    className={`p-3 rounded-2xl border text-left flex items-start gap-2.5 transition-all ${
                      !formData.primaria
                        ? 'bg-purple-50 border-purple-300 text-purple-900 shadow-2xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Box size={16} className={!formData.primaria ? 'text-purple-600' : 'text-slate-400'} />
                    <div>
                      <p className="font-bold text-xs">Sub-Serviço</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Vinculado a uma categoria</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Se for Secundária: Seleção da Categoria Pai */}
              {!formData.primaria && (
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Categoria Pai (Dependência) *
                  </label>
                  <select
                    value={formData.dependencia || ''}
                    onChange={e => setFormData({ ...formData, dependencia: parseInt(e.target.value) || null })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 outline-none focus:border-blue-500 focus:bg-white transition-all"
                  >
                    <option value="">Selecione a categoria pai...</option>
                    {primaryCategories
                      .filter(p => p.id !== editingId)
                      .map(p => (
                        <option key={p.id} value={p.id}>{p.nome}</option>
                      ))}
                  </select>
                </div>
              )}

              {/* Imagem / Ícone com Upload ou URL */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Ícone / Imagem da Atividade
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {formData.imagem ? (
                      <img src={formData.imagem} alt="Prévia" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon size={22} className="text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <label className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-colors w-full">
                      {uploading ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
                      <span>{uploading ? 'Enviando imagem...' : 'Fazer Upload de Imagem'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={uploading}
                        className="hidden"
                      />
                    </label>
                    <input
                      type="text"
                      placeholder="Ou cole o link direto da imagem..."
                      value={formData.imagem}
                      onChange={e => setFormData({ ...formData, imagem: e.target.value })}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-700 outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Status Ativo / Inativo */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                <div>
                  <p className="font-bold text-xs text-slate-900">Status no Catálogo</p>
                  <p className="text-[10px] text-slate-400">Atividades inativas não ficam visíveis para novos pedidos</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, ativa: !formData.ativa })}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    formData.ativa
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-red-50 text-red-600 border-red-200'
                  }`}
                >
                  {formData.ativa ? 'Ativa' : 'Inativa'}
                </button>
              </div>

            </div>

            {/* Footer Modal */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-3 rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || uploading}
                className="px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20 active:scale-95 disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                <span>{editingId ? 'Salvar Alterações' : 'Criar Atividade'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Modal de Realocação de Dependências Órfãs */}
      {isReassignModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-6 sm:p-7 space-y-5 border border-slate-100">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="p-2.5 bg-amber-50 rounded-2xl">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Realocar Sub-serviços</h3>
                <p className="text-xs text-slate-500">Ajuste de estrutura de catálogo</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Esta categoria possui <strong className="text-slate-900">{orphanedChildrenCount} sub-serviço(s)</strong> vinculados a ela. Para transformá-la em secundária, escolha para qual Categoria Principal eles devem ser transferidos:
            </p>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Nova Categoria Principal Destino *
              </label>
              <select
                value={newParentId}
                onChange={e => setNewParentId(parseInt(e.target.value) || '')}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="">Selecione uma categoria principal...</option>
                {availableParents.map(p => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsReassignModalOpen(false)}
                className="px-5 py-3 rounded-2xl border border-slate-200 text-slate-600 text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleReassignAndSave}
                disabled={saving || !newParentId}
                className="px-6 py-3 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-md shadow-amber-500/20 active:scale-95 disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? <Loader2 className="animate-spin" size={16} /> : <ArrowRight size={16} />}
                <span>Realocar e Salvar</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminAtividades;
