import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Planejamento, Orcamento, OrdemServico } from '../types';
// FIX: Replaced non-existent 'Tool' icon with 'Wrench'.
import { Loader2, FileText, DollarSign, Wrench, User as UserIcon, Briefcase, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type Tab = 'planejamentos' | 'orcamentos' | 'ordens';

const Chamados: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('planejamentos');
  const [loading, setLoading] = useState(true);
  
  const [planejamentos, setPlanejamentos] = useState<Planejamento[]>([]);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);

  const navigate = useNavigate();

  useEffect(() => {
    fetchChamados();
  }, []);

  const fetchChamados = async () => {
    setLoading(true);
    try {
      const { data: planData, error: planError } = await supabase
        .from('planejamento')
        .select('*, chaves(*, cliente(*), profissional(*), geral(*))')
        .order('created_at', { ascending: false });
      if (planError) throw planError;
      setPlanejamentos(planData || []);

      const { data: orcaData, error: orcaError } = await supabase
        .from('orcamento')
        .select('*, chaves(*, cliente(*), profissional(*), geral(*))')
        .order('id', { ascending: false });
      if (orcaError) throw orcaError;
      setOrcamentos(orcaData || []);
      
      const { data: osData, error: osError } = await supabase
        .from('ordemservico')
        .select('*, chaves(*, cliente(*), profissional(*), geral(*))')
        .order('created_at', { ascending: false });

      if (osError) {
          console.warn("Não foi possível buscar 'ordemservico'. A tabela pode não existir.", osError);
          setOrdens([]);
      } else {
          setOrdens(osData || []);
      }
    } catch (error) {
      console.error("Erro ao buscar chamados:", error);
    } finally {
      setLoading(false);
    }
  };

  const TabButton: React.FC<{tab: Tab, label: string, icon: React.ReactNode, count: number}> = ({ tab, label, icon, count }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`flex-1 py-3 px-2 rounded-xl text-sm font-bold transition-all flex items-center justify-center space-x-2 ${activeTab === tab ? 'bg-white shadow-md text-gray-900' : 'text-gray-500 hover:text-gray-700 hover:bg-white/30'}`}
    >
        {icon}
        <span>{label}</span>
        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${activeTab === tab ? 'bg-ios-blue text-white' : 'bg-gray-200 text-gray-600'}`}>
            {count}
        </span>
    </button>
  );

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('pt-BR', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }).replace('. de', '').replace(' ',' às ');
  };

  const getStatusChip = (status: string | undefined) => {
    const s = status?.toLowerCase() || 'desconhecido';
    switch (s) {
        case 'pendente': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
        case 'aprovado':
        case 'confirmado':
            return 'bg-blue-100 text-blue-800 border-blue-200';
        case 'executando': return 'bg-purple-100 text-purple-800 border-purple-200';
        case 'concluido': return 'bg-green-100 text-green-800 border-green-200';
        case 'cancelado': return 'bg-red-100 text-red-800 border-red-200';
        default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const renderContent = () => {
    if (loading) {
        return <div className="flex justify-center items-center p-20"><Loader2 className="animate-spin text-ios-blue" size={32} /></div>;
    }
    
    let items: any[] = [];
    if (activeTab === 'planejamentos') items = planejamentos;
    if (activeTab === 'orcamentos') items = orcamentos;
    if (activeTab === 'ordens') items = ordens;
    
    if (items.length === 0) {
        return (
            <div className="text-center py-20 px-5">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                    <FileText size={32} />
                </div>
                <h3 className="font-bold text-lg text-gray-800">Nenhum chamado encontrado</h3>
                <p className="text-sm text-gray-500 mt-1">Não há itens para esta categoria no momento.</p>
            </div>
        );
    }
    
    return (
        <div className="space-y-4">
            {items.map(item => (
                <div key={`${activeTab}-${item.id}`} className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 cursor-pointer hover:bg-gray-50 active:scale-[0.99] transition-all group">
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="font-bold text-gray-900 text-base">{item.chaves?.geral?.nome || 'Serviço não especificado'}</h3>
                            <p className="text-xs text-gray-400 font-mono">CHAVE: {item.chaves?.chaveunica}</p>
                        </div>
                        <span className={`px-2.5 py-1 text-xs font-bold rounded-full border capitalize ${getStatusChip(item.chaves?.status)}`}>
                            {item.chaves?.status || 'N/A'}
                        </span>
                    </div>
                    <div className="border-t border-dashed border-gray-200 my-4"></div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div className="flex items-start space-x-2">
                            <UserIcon size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-xs text-gray-500 font-semibold">Cliente</p>
                                <p className="font-medium text-gray-800">{item.chaves?.cliente?.nome || 'N/A'}</p>
                            </div>
                        </div>
                        <div className="flex items-start space-x-2">
                            <Briefcase size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-xs text-gray-500 font-semibold">Profissional</p>
                                <p className="font-medium text-gray-800">{item.chaves?.profissional?.nome || 'N/A'}</p>
                            </div>
                        </div>
                        
                        {activeTab === 'planejamentos' && (
                            <div className="flex items-start space-x-2">
                                <Clock size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="text-xs text-gray-500 font-semibold">Execução</p>
                                    <p className="font-medium text-gray-800">{formatDate(item.execucao)}</p>
                                </div>
                            </div>
                        )}
                        {activeTab === 'orcamentos' && (
                             <div className="flex items-start space-x-2">
                                <DollarSign size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="text-xs text-gray-500 font-semibold">Preço</p>
                                    <p className="font-medium text-gray-800">{item.preco ? `R$ ${item.preco.toFixed(2)}` : 'Aguardando'}</p>
                                </div>
                            </div>
                        )}
                        {activeTab === 'ordens' && (
                            <div className="flex items-start space-x-2">
                                <Clock size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="text-xs text-gray-500 font-semibold">Início</p>
                                    <p className="font-medium text-gray-800">{formatDate(item.datainicio)}</p>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            ))}
        </div>
    );
  };
  
  return (
    <div className="min-h-screen bg-ios-bg">
      <div className="sticky top-0 bg-white/80 backdrop-blur-md z-20 px-5 pt-12 md:pt-6 pb-4 border-b border-gray-200">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Chamados</h1>
        <p className="text-gray-500 text-sm mt-1">Acompanhe todos os estágios dos serviços.</p>
      </div>
      
      <div className="p-5">
        <div className="bg-gray-100 p-1.5 rounded-2xl flex max-w-lg mx-auto md:mx-0 shadow-sm border border-gray-200/50 mb-6">
            <TabButton tab="planejamentos" label="Planejamentos" icon={<FileText size={16} />} count={planejamentos.length} />
            <TabButton tab="orcamentos" label="Orçamentos" icon={<DollarSign size={16} />} count={orcamentos.length} />
            <TabButton tab="ordens" label="O.S." icon={<Wrench size={16} />} count={ordens.length} />
        </div>
        
        {renderContent()}
      </div>
    </div>
  );
};

export default Chamados;
