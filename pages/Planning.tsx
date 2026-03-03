import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { User, Geral } from '../types';
import {
    ChevronLeft, Calendar, FileText, CheckCircle, Loader2, AlertTriangle,
    MapPin, Package, Plus, X, Clock, Banknote, Wallet, Camera,
    Image as ImageIcon, Ban, CreditCard, Smartphone, CalendarDays, Briefcase, Play,
    Mic, Square, Trash2 as Trash
} from 'lucide-react';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const Planning: React.FC = () => {
    const { serviceId: paramServiceId } = useParams<{ serviceId: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const serviceNameFromState = location.state?.serviceName || 'Serviço';

    const [professional, setProfessional] = useState<User | null>(null);
    const [serviceInfo, setServiceInfo] = useState<Geral | null>(null);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [userType, setUserType] = useState<string>('');

    // Form State
    const [date, setDate] = useState('');
    const [flexibility, setFlexibility] = useState('');
    const [description, setDescription] = useState('');
    const [paymentType, setPaymentType] = useState<string>('');
    const [installments, setInstallments] = useState(1);

    // Audio Recording State
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Image Upload State
    const [imagePedido, setImagePedido] = useState<string | null>(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);

    // Resources State
    const [resources, setResources] = useState<string[]>([]);
    const [currentResource, setCurrentResource] = useState('');

    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Audio Functions
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;

            const chunks: BlobPart[] = [];
            mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
            mediaRecorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'audio/webm' });
                setAudioBlob(blob);
                setAudioUrl(URL.createObjectURL(blob));
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);
            timerRef.current = setInterval(() => {
                setRecordingTime((prev) => prev + 1);
            }, 1000);
        } catch (err) {
            console.error("Erro ao acessar microfone:", err);
            alert("Não foi possível acessar o microfone. Verifique as permissões do navegador.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            setIsRecording(false);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    };

    const deleteAudio = () => {
        setAudioBlob(null);
        setAudioUrl(null);
        setRecordingTime(0);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Melhoria: getTodayMin agora garante que o atributo 'min' do input datetime-local 
    // bloqueie minutos passados no dia de hoje.
    const getTodayMin = () => {
        const now = new Date();
        // Ajuste de fuso horário para o formato ISO aceito pelo input HTML
        const offset = now.getTimezoneOffset() * 60000;
        return new Date(now.getTime() - offset).toISOString().slice(0, 16);
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const { data: { user: authUser } } = await supabase.auth.getUser();
                let currentUuid = authUser?.id;

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
                setUserType(userData.tipo || '');

                // Fetch Service Data
                if (paramServiceId) {
                    const { data: serviceData } = await supabase
                        .from('geral')
                        .select('*')
                        .eq('id', paramServiceId)
                        .single();
                    if (serviceData) setServiceInfo(serviceData);
                }

            } catch (error) {
                console.error(error);
                setErrorMsg("Erro ao carregar dados.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [paramServiceId]);

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

        const file = e.target.files[0];
        setUploadError(null);

        if (file.size > MAX_FILE_SIZE) {
            const sizeMB = (file.size / 1024 / 1024).toFixed(1);
            setUploadError(`O vídeo selecionado (${sizeMB}MB) é maior que o tamanho máximo suportado de 50MB.`);
            e.target.value = '';
            return;
        }

        setUploadingImage(true);
        try {
            const fileExt = file.name.split('.').pop()?.toLowerCase() || 'bin';
            const fileName = `pedidos/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage.from('imagens').upload(filePath, file, {
                contentType: file.type || undefined
            });
            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('imagens').getPublicUrl(filePath);
            setImagePedido(data.publicUrl);
            setErrorMsg(null);
        } catch (error: any) {
            console.error("Upload error:", error);
            setUploadError("Falha ao enviar arquivo. Tente novamente.");
        } finally {
            setUploadingImage(false);
        }
    };

    const handleRemoveImage = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setImagePedido(null);
        setUploadError(null);
    };

    const handleSubmit = async () => {
        const normType = userType.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (normType !== 'gestor' && normType !== 'consumidor') {
            setErrorMsg("Apenas Consumidores e Gestores podem criar novos pedidos.");
            return;
        }

        if (!date || !paymentType || (!description && !audioBlob)) {
            setErrorMsg("Por favor, preencha a data, forma de pagamento e a descrição (ou grave um áudio).");
            return;
        }

        if (!imagePedido) {
            setErrorMsg("Por favor, envie uma foto ou vídeo do local para continuar.");
            return;
        }

        // VALIDAÇÃO RIGOROSA DE DATA E HORA
        const selectedDate = new Date(date);
        const now = new Date();

        // Truncamos segundos e milissegundos para permitir agendar no minuto atual exato
        now.setSeconds(0, 0);

        if (selectedDate.getTime() < now.getTime()) {
            setErrorMsg("Não é possível agendar serviços para uma data ou horário que já passaram.");
            return;
        }

        if (!currentUser || !paramServiceId) {
            setErrorMsg("Dados incompletos para o agendamento.");
            return;
        }

        setSubmitting(true);
        setErrorMsg(null);

        try {
            let finalAudioUrl = null;
            if (audioBlob) {
                const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.webm`;
                const { error: uploadError } = await supabase.storage.from('audios').upload(fileName, audioBlob, {
                    contentType: 'audio/webm'
                });
                if (uploadError) throw uploadError;

                const { data: audioData } = supabase.storage.from('audios').getPublicUrl(fileName);
                finalAudioUrl = audioData.publicUrl;
            }

            const uniqueKey = Math.random().toString(36).substring(2, 10).toUpperCase();

            const { data: chaveData, error: chaveError } = await supabase
                .from('chaves')
                .insert({
                    cliente: currentUser.uuid,
                    profissional: null,
                    chaveunica: uniqueKey,
                    status: 'pendente',
                    atividade: parseInt(paramServiceId),
                    cidade: currentUser.cidade,
                    fotoantes: [],
                    fotodepois: []
                })
                .select()
                .single();

            if (chaveError) throw chaveError;

            const executionDate = new Date(date).toISOString();

            let fullDescription = description;
            if (flexibility) fullDescription += `\n\n[FLEXIBILIDADE DE AGENDA]:\n${flexibility}`;
            if (paymentType === 'Cartão de Crédito') fullDescription += `\n\n[PARCELAMENTO DESEJADO]: ${installments}x`;

            const { error: planError } = await supabase
                .from('planejamento')
                .insert({
                    chave: chaveData.id,
                    execucao: executionDate,
                    descricao: fullDescription,
                    recursos: resources,
                    pagamento: paymentType,
                    imagem_pedido: imagePedido,
                    audio_pedido: finalAudioUrl,
                    ativo: true,
                    tempoprevisto: 1
                });

            if (planError) throw planError;

            setSuccess(true);
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

    const normType = userType.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const canCreate = normType === 'gestor' || normType === 'consumidor';

    if (!canCreate) {
        return (
            <div className="min-h-screen bg-ios-bg flex flex-col items-center justify-center p-6 text-center">
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6 text-red-500">
                    <Ban size={40} />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Acesso Restrito</h2>
                <p className="text-gray-500 mb-6 max-w-xs">
                    Seu perfil ({userType}) não tem permissão para solicitar novos serviços.
                </p>
                <button onClick={() => navigate('/home')} className="bg-black text-white px-6 py-3 rounded-xl font-bold shadow-lg">Voltar ao Início</button>
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
                    Sua solicitação foi criada. O **Planejista** irá escalonamento o melhor profissional para você em breve.
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

    const paymentOptions = [
        { id: 'PIX', label: 'PIX', icon: Smartphone },
        { id: 'Cartão de Crédito', label: 'Crédito', icon: CreditCard },
        { id: 'Cartão de Débito', label: 'Débito', icon: CreditCard },
        { id: 'Dinheiro', label: 'Dinheiro', icon: Banknote }
    ];

    return (
        <div className="min-h-screen bg-ios-bg pb-32">
            <div className="bg-white/80 backdrop-blur-md px-5 pt-12 pb-4 sticky top-0 z-20 border-b border-gray-200 flex items-center">
                <button onClick={() => navigate(-1)} className="mr-3 p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors">
                    <ChevronLeft size={24} className="text-ios-blue" />
                </button>
                <h1 className="text-xl font-bold text-gray-900">Nova Solicitação</h1>
            </div>

            <div className="p-5 space-y-6">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center space-x-4">
                    <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center text-ios-blue overflow-hidden flex-shrink-0">
                        {serviceInfo?.imagem ? (
                            <img src={serviceInfo.imagem} className="w-full h-full object-cover" alt={serviceInfo.nome} />
                        ) : (
                            <Briefcase size={32} />
                        )}
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Serviço Selecionado</p>
                        <h2 className="text-lg font-black text-gray-900 leading-tight">{serviceInfo?.nome || serviceNameFromState}</h2>
                        <div className="flex items-center text-xs text-gray-500 mt-1">
                            <span className="font-semibold text-ios-blue">O Planejista escolherá o profissional.</span>
                        </div>
                    </div>
                </div>

                <div className="space-y-5">
                    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 space-y-5">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 flex items-center">
                                <Calendar size={12} className="mr-1" /> Data e Hora Preferencial
                            </label>
                            <input
                                type="datetime-local"
                                value={date}
                                min={getTodayMin()}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-gray-900 font-bold focus:outline-none focus:ring-2 focus:ring-ios-blue/30 shadow-inner appearance-none"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 flex items-center">
                                <Clock size={12} className="mr-1" /> Flexibilidade de Horário
                            </label>
                            <textarea
                                rows={2}
                                value={flexibility}
                                onChange={(e) => setFlexibility(e.target.value)}
                                placeholder="Ex: Disponível também aos sábados de manhã ou qualquer dia útil após as 18h."
                                className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-ios-blue/30 shadow-inner resize-none"
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 flex items-center">
                            <Banknote size={12} className="mr-1" /> Forma de Pagamento Preferencial
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            {paymentOptions.map((opt) => (
                                <button
                                    key={opt.id}
                                    onClick={() => setPaymentType(opt.id)}
                                    className={`p-4 rounded-2xl border flex flex-col items-center justify-center space-y-2 transition-all active:scale-95 ${paymentType === opt.id
                                        ? 'bg-ios-blue text-white border-ios-blue shadow-lg shadow-blue-100'
                                        : 'bg-white border-gray-100 text-gray-900 hover:bg-gray-50'
                                        }`}
                                >
                                    <opt.icon size={22} className={paymentType === opt.id ? 'text-white' : 'text-gray-400'} />
                                    <span className="text-xs font-bold">{opt.label}</span>
                                </button>
                            ))}
                        </div>

                        {paymentType === 'Cartão de Crédito' && (
                            <div className="bg-white p-5 rounded-3xl border border-blue-100 shadow-sm space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                <label className="text-[10px] font-black text-ios-blue uppercase tracking-widest ml-1 flex items-center">
                                    <CreditCard size={12} className="mr-1" /> Número de Parcelas Desejado
                                </label>
                                <select
                                    value={installments}
                                    onChange={(e) => setInstallments(parseInt(e.target.value))}
                                    className="w-full bg-gray-50 border border-blue-50 rounded-xl p-4 text-sm font-bold text-gray-900 outline-none appearance-none shadow-inner"
                                >
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                                        <option key={n} value={n}>{n}x {n === 1 ? 'sem juros' : ''}</option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-gray-400 font-medium italic ml-1">
                                    * O parcelamento final será confirmado no orçamento.
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 flex items-center">
                            <Package size={12} className="mr-1" /> Recursos / Materiais
                        </label>
                        <div className="flex space-x-2">
                            <input
                                type="text"
                                value={currentResource}
                                onChange={(e) => setCurrentResource(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddResource(e)}
                                placeholder="Ex: Escada, Detergente..."
                                className="flex-1 bg-white border border-gray-200 rounded-2xl p-4 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-ios-blue/30 shadow-sm"
                            />
                            <button onClick={handleAddResource} className="bg-black text-white px-5 rounded-2xl hover:bg-gray-800 transition-colors shadow-sm active:scale-95"><Plus size={20} /></button>
                        </div>
                        {resources.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                                {resources.map((res, idx) => (
                                    <div key={idx} className="bg-blue-50 text-blue-800 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center shadow-sm border border-blue-100 animate-in zoom-in duration-200">
                                        <span>{res}</span>
                                        <button onClick={() => handleRemoveResource(idx)} className="ml-2 text-blue-400 hover:text-blue-600 p-0.5"><X size={14} /></button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 flex items-center">
                            <ImageIcon size={12} className="mr-1" /> Foto ou Vídeo do Local <span className="text-red-500 ml-1 font-black">(Obrigatório)</span>
                        </label>
                        {uploadError && (
                            <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-start space-x-3 animate-in slide-in-from-bottom-2 duration-300 mb-3">
                                <AlertTriangle size={18} className="text-red-500 mt-0.5 flex-shrink-0" />
                                <p className="text-xs font-bold text-red-700 leading-tight">{uploadError}</p>
                                <button onClick={() => setUploadError(null)} className="text-red-400 hover:text-red-600 transition-colors"><X size={16} /></button>
                            </div>
                        )}
                        {imagePedido ? (
                            <div className="relative w-full h-48 bg-gray-100 rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
                                {imagePedido.toLowerCase().includes('.mp4') || imagePedido.toLowerCase().includes('.mov') ? (
                                    <video src={imagePedido} className="w-full h-full object-cover" controls playsInline />
                                ) : (
                                    <img src={imagePedido} alt="Foto do pedido" className="w-full h-full object-cover" />
                                )}
                                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                    <button onClick={handleRemoveImage} className="bg-red-500 text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-red-600 shadow-lg flex items-center"><X size={14} className="mr-1" /> Remover</button>
                                </div>
                            </div>
                        ) : (
                            <label className={`w-full h-32 bg-white border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors ${errorMsg && !imagePedido ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                                {uploadingImage ? <Loader2 className="animate-spin text-ios-blue" size={24} /> : (
                                    <>
                                        <div className="flex gap-2 mb-2">
                                            <Camera size={24} className={errorMsg && !imagePedido ? 'text-red-300' : 'text-gray-300'} />
                                            <Play size={24} className={errorMsg && !imagePedido ? 'text-red-300' : 'text-gray-300'} />
                                        </div>
                                        <span className={`text-[10px] font-bold uppercase tracking-widest ${errorMsg && !imagePedido ? 'text-red-500' : 'text-gray-400'}`}>Enviar Foto ou Vídeo</span>
                                        <span className="text-[9px] text-gray-400 mt-1">(Máx 50MB)</span>
                                    </>
                                )}
                                <input type="file" accept="image/*,video/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
                            </label>
                        )}
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between ml-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center">
                                <FileText size={12} className="mr-1" /> Detalhes do Problema
                            </label>
                            <div className="flex items-center gap-2">
                                {audioUrl ? (
                                    <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100 animate-in fade-in zoom-in duration-300">
                                        <audio src={audioUrl} controls className="h-6 w-32" />
                                        <button onClick={deleteAudio} className="text-red-400 hover:text-red-600 transition-colors">
                                            <Trash size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={isRecording ? stopRecording : startRecording}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all ${isRecording
                                            ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-200'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                    >
                                        {isRecording ? (
                                            <>
                                                <Square size={12} fill="currentColor" />
                                                <span>{formatTime(recordingTime)} Parar</span>
                                            </>
                                        ) : (
                                            <>
                                                <Mic size={12} />
                                                <span>Gravar Áudio</span>
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                        <textarea
                            rows={4}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Descreva detalhadamente o que precisa ser feito..."
                            className="w-full bg-white border border-gray-200 rounded-2xl p-4 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-ios-blue/30 shadow-sm resize-none"
                        />
                    </div>
                </div>

                {errorMsg && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-xs font-bold flex items-center animate-in fade-in slide-in-from-top-2">
                        <AlertTriangle size={16} className="mr-2" />
                        {errorMsg}
                    </div>
                )}
            </div>

            <div className="fixed bottom-6 left-5 right-5 z-50">
                <div className="max-w-md mx-auto w-full">
                    <button
                        onClick={handleSubmit}
                        disabled={submitting || uploadingImage || isRecording}
                        className="w-full bg-black text-white py-4 rounded-[1.5rem] font-bold text-base shadow-floating active:scale-95 transition-all flex items-center justify-center disabled:opacity-70 disabled:scale-100"
                    >
                        {submitting ? <Loader2 className="animate-spin" size={20} /> : "Solicitar Serviço"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Planning;