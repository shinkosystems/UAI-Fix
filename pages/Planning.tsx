
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { User } from '../types';
import { ChevronLeft, Calendar, FileText, CheckCircle, Loader2, AlertTriangle, MapPin, Package, Plus, X, Clock, Banknote, Wallet, Camera, Image as ImageIcon } from 'lucide-react';

const Planning: React.FC = () => {
  const { uuid } = useParams<{ uuid: string }>(); // Professional UUID
  const navigate = useNavigate();
  const location = useLocation();
  const serviceId = location.state?.serviceId;
  const serviceName = location.state?.serviceName || 'Serviço';

  const [professional, setProfessional] = useState<User | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Form State
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [paymentType, setPaymentType] = useState<'hora' | 'empreitada' | ''>('');
  
  // Image Upload State
  const [imagePedido, setImagePedido] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  // Resources State
  const [resources, setResources] = useState<string[]>([]);
  const [currentResource, setCurrentResource] = useState('');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
        try {
            setLoading(true);

            // 1. Get Current User
            const { data: { user: authUser } } = await supabase.auth.getUser();
            let currentUuid = authUser?.id;

            // Demo Fallback
            if (!currentUuid) {
                 const { data: demoUsers } = await supabase.from('users').select('*').eq('ativo', true).limit(1);
                 if (demoUsers && demoUsers.length > 0) currentUuid = demoUsers[0].uuid;
            }

            if (!currentUuid) throw new Error("Usuário não autenticado");

            const { data: userData } = await supabase
                .from('users')
                .select('*')
                .eq('uuid', currentUuid)
                .single();
            setCurrentUser(userData);

            // 2. Get Professional Data
            if (uuid) {
                const { data: proData } = await supabase
                    .from('users')
                    .select('*')
                    .eq('uuid', uuid)
                    .single();
                setProfessional(proData);
            }

        } catch (error) {
            console.error(error);
            setErrorMsg("Erro ao carregar dados.");
        } finally {
            setLoading(false);
        }
    };

    fetchData();
  }, [uuid]);

  const handleAddResource = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (currentResource.trim()) {
        if (!resources.includes(currentResource.trim())) {
            setResources([...resources, currentResource.trim()]);
        }
        setCurrentResource('');
    }
  };

  const handleRemoveResource = (indexToRemove: number) => {
    setResources(resources.filter((_, index) => index !== indexToRemove));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    setUploadingImage(true);
    try {
        const file = e.target.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `pedidos/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${fileName}`; // Saving to root or specific folder in 'imagens' bucket

        const { error: uploadError } = await supabase.storage.from('imagens').upload(filePath, file);
        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('imagens').getPublicUrl(filePath);
        setImagePedido(data.publicUrl);
    } catch (error: any) {
        console.error("Upload error:", error);
        alert("Erro ao enviar imagem: " + error.message);
    } finally {
        setUploadingImage(false);
    }
  };

  const handleRemoveImage = () => {
      setImagePedido(null);
  };

  const handleSubmit = async () => {
    if (!date || !description || !paymentType) {
        setErrorMsg("Por favor, preencha a data, tipo de pagamento e descrição.");
        return;
    }
    if (!currentUser || !professional || !serviceId) {
        setErrorMsg("Dados incompletos para o agendamento.");
        return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
        // 1. Generate Unique Key (simulated for now, usually random string)
        const uniqueKey = Math.random().toString(36).substring(2, 10).toUpperCase();

        // 2. Insert into 'chaves' (The Ticket)
        const { data: chaveData, error: chaveError } = await supabase
            .from('chaves')
            .insert({
                cliente: currentUser.uuid,
                profissional: professional.uuid,
                chaveunica: uniqueKey,
                status: 'pendente',
                atividade: parseInt(serviceId),
                cidade: currentUser.cidade, // Assuming service happens in user's city
                fotoantes: [],
                fotodepois: []
            })
            .select()
            .single();

        if (chaveError) throw chaveError;

        // 3. Insert into 'planejamento' (The Schedule)
        // Schema: execucao, descricao, chave, tempoprevisto, ativo, recursos (ARRAY), pagamento (TEXT), imagem_pedido (TEXT)
        const executionDate = new Date(date).toISOString();
        
        const { error: planError } = await supabase
            .from('planejamento')
            .insert({
                chave: chaveData.id,
                execucao: executionDate,
                descricao: description,
                recursos: resources, 
                pagamento: paymentType, // Insert payment type
                imagem_pedido: imagePedido, // Insert image URL
                ativo: true,
                tempoprevisto: 1 // Default 1 hour
            });

        if (planError) throw planError;

        setSuccess(true);
        
        // Redirect after delay
        setTimeout(() => {
            navigate('/calendar');
        }, 2500);

    } catch (error: any) {
        console.error("Erro ao criar planejamento:", error);
        setErrorMsg(error.message || "Erro ao solicitar agendamento.");
        setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-ios-bg flex items-center justify-center">
        <Loader2 className="animate-spin text-ios-blue" size={32} />
      </div>
    );
  }

  if (success) {
      return (
        <div className="min-h-screen bg-ios-bg flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-300">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
                <CheckCircle size={48} className="text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Solicitação Enviada!</h1>
            <p className="text-gray-500 mb-8 max-w-xs">
                Seu planejamento foi criado. Aguarde a confirmação do profissional <strong>{professional?.nome}</strong>.
            </p>
            <div className="bg-white p-4 rounded-2xl shadow-sm w-full max-w-xs border border-green-100">
                <p className="text-sm font-semibold text-gray-800">Redirecionando para agenda...</p>
                <div className="w-full bg-gray-100 h-1.5 rounded-full mt-3 overflow-hidden">
                    <div className="h-full bg-green-500 w-1/2 animate-[pulse_1s_infinite]"></div>
                </div>
            </div>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-ios-bg pb-32">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md px-5 pt-12 pb-4 sticky top-0 z-20 border-b border-gray-200 flex items-center">
        <button 
          onClick={() => navigate(-1)} 
          className="mr-3 p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft size={24} className="text-ios-blue" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Novo Agendamento</h1>
      </div>

      <div className="p-5 space-y-6">
        
        {/* Summary Card */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex items-center space-x-4">
             <img 
                src={professional?.fotoperfil || `https://ui-avatars.com/api/?name=${professional?.nome}`}
                alt="Pro"
                className="w-14 h-14 rounded-full object-cover bg-gray-100"
             />
             <div>
                 <h2 className="font-bold text-gray-900">{professional?.nome}</h2>
                 <div className="flex items-center text-xs text-gray-500 mt-1">
                     <span className="font-semibold text-ios-blue bg-blue-50 px-2 py-0.5 rounded-md mr-2">{serviceName}</span>
                 </div>
             </div>
        </div>

        {/* Form */}
        <div className="space-y-5">
            
            {/* Date Selection */}
            <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1 flex items-center">
                    <Calendar size={12} className="mr-1" /> Data e Hora Desejada
                </label>
                <div className="relative">
                    <input 
                        type="datetime-local" 
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-2xl p-4 text-gray-900 focus:outline-none focus:ring-2 focus:ring-ios-blue/30 focus:border-ios-blue shadow-sm appearance-none"
                    />
                </div>
            </div>

            {/* Payment Type Selection */}
            <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1 flex items-center">
                    <Banknote size={12} className="mr-1" /> Preferência de Pagamento
                </label>
                <div className="flex space-x-3">
                    <button
                        onClick={() => setPaymentType('hora')}
                        className={`flex-1 p-4 rounded-2xl border flex flex-col items-center justify-center space-y-2 transition-all active:scale-95 ${
                            paymentType === 'hora' 
                            ? 'bg-blue-50 border-ios-blue ring-1 ring-ios-blue' 
                            : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}
                    >
                        <Clock size={24} className={paymentType === 'hora' ? 'text-ios-blue' : 'text-gray-400'} />
                        <span className={`text-sm font-bold ${paymentType === 'hora' ? 'text-ios-blue' : 'text-gray-600'}`}>
                            Por Hora
                        </span>
                    </button>
                    
                    <button
                        onClick={() => setPaymentType('empreitada')}
                        className={`flex-1 p-4 rounded-2xl border flex flex-col items-center justify-center space-y-2 transition-all active:scale-95 ${
                            paymentType === 'empreitada' 
                            ? 'bg-blue-50 border-ios-blue ring-1 ring-ios-blue' 
                            : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}
                    >
                        <Wallet size={24} className={paymentType === 'empreitada' ? 'text-ios-blue' : 'text-gray-400'} />
                        <span className={`text-sm font-bold ${paymentType === 'empreitada' ? 'text-ios-blue' : 'text-gray-600'}`}>
                            Por Empreitada
                        </span>
                    </button>
                </div>
                <p className="text-[10px] text-gray-400 ml-1">
                    {paymentType === 'hora' && 'O valor final dependerá do tempo gasto na execução.'}
                    {paymentType === 'empreitada' && 'Valor fechado pelo serviço completo, independente do tempo.'}
                    {!paymentType && 'Selecione como deseja negociar o valor.'}
                </p>
            </div>

            {/* Resources Input */}
            <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1 flex items-center">
                    <Package size={12} className="mr-1" /> Recursos / Materiais
                </label>
                <p className="text-[10px] text-gray-400 ml-1 mb-1">Liste materiais ou ferramentas que você acredita serem necessários.</p>
                
                <div className="flex space-x-2">
                    <input 
                        type="text"
                        value={currentResource}
                        onChange={(e) => setCurrentResource(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddResource(e)}
                        placeholder="Ex: Escada, Detergente, Cimento..."
                        className="flex-1 bg-white border border-gray-200 rounded-2xl p-4 text-gray-900 focus:outline-none focus:ring-2 focus:ring-ios-blue/30 focus:border-ios-blue shadow-sm"
                    />
                    <button 
                        onClick={handleAddResource}
                        className="bg-gray-900 text-white p-4 rounded-2xl hover:bg-gray-800 transition-colors shadow-sm active:scale-95"
                    >
                        <Plus size={20} />
                    </button>
                </div>

                {/* Tags List */}
                {resources.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {resources.map((res, idx) => (
                            <div key={idx} className="bg-blue-50 text-blue-800 px-3 py-1.5 rounded-xl text-sm font-medium flex items-center shadow-sm border border-blue-100 animate-in zoom-in duration-200">
                                <span>{res}</span>
                                <button 
                                    onClick={() => handleRemoveResource(idx)}
                                    className="ml-2 text-blue-400 hover:text-blue-600 p-0.5 rounded-full hover:bg-blue-100 transition-colors"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

             {/* Image Upload for Request */}
             <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1 flex items-center">
                    <ImageIcon size={12} className="mr-1" /> Foto do Local / Item (Opcional)
                </label>
                <p className="text-[10px] text-gray-400 ml-1 mb-1">Uma foto ajuda o profissional a entender melhor o serviço.</p>
                
                {imagePedido ? (
                    <div className="relative w-full h-48 bg-gray-100 rounded-2xl overflow-hidden border border-gray-200 shadow-sm group">
                        <img src={imagePedido} alt="Foto do pedido" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button 
                                onClick={handleRemoveImage}
                                className="bg-red-500 text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-red-600 transition-colors flex items-center"
                            >
                                <X size={14} className="mr-1" /> Remover
                            </button>
                        </div>
                    </div>
                ) : (
                    <label className="w-full h-32 bg-white border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 hover:border-ios-blue/50 transition-colors">
                        {uploadingImage ? (
                            <Loader2 className="animate-spin text-ios-blue" size={24} />
                        ) : (
                            <>
                                <Camera size={24} className="text-gray-400 mb-2" />
                                <span className="text-xs font-bold text-gray-500">Toque para enviar uma foto</span>
                            </>
                        )}
                        <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={handleImageUpload}
                            disabled={uploadingImage}
                        />
                    </label>
                )}
            </div>

            {/* Description */}
            <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1 flex items-center">
                    <FileText size={12} className="mr-1" /> Descrição do Problema
                </label>
                <textarea 
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Descreva o que precisa ser feito ou detalhes importantes..."
                    className="w-full bg-white border border-gray-200 rounded-2xl p-4 text-gray-900 focus:outline-none focus:ring-2 focus:ring-ios-blue/30 focus:border-ios-blue shadow-sm resize-none"
                />
            </div>

            {/* Location Confirm */}
            {currentUser?.cidade && (
                 <div className="bg-gray-50 p-4 rounded-2xl flex items-start space-x-3 text-sm text-gray-600">
                    <MapPin size={18} className="text-gray-400 flex-shrink-0 mt-0.5" />
                    <p>O serviço será realizado na cidade cadastrada em seu perfil.</p>
                 </div>
            )}
        </div>

        {/* Error Message */}
        {errorMsg && (
             <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-sm font-medium flex items-center animate-in fade-in slide-in-from-top-2">
                 <AlertTriangle size={18} className="mr-2" />
                 {errorMsg}
             </div>
        )}

      </div>

      {/* Fixed Bottom Action */}
      <div className="fixed bottom-6 left-5 right-5 z-50">
        <div className="max-w-md mx-auto w-full">
            <button 
                onClick={handleSubmit}
                disabled={submitting || uploadingImage}
                className="w-full vitrified bg-black/90 text-white backdrop-blur-xl py-4 rounded-[1.5rem] font-bold text-base shadow-floating active:scale-95 transition-all flex items-center justify-center disabled:opacity-70 disabled:scale-100"
            >
                {submitting ? (
                    <Loader2 className="animate-spin" size={20} />
                ) : (
                    <>
                        Solicitar Orçamento
                    </>
                )}
            </button>
        </div>
      </div>
    </div>
  );
};

export default Planning;
