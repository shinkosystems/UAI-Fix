// @sos-edit: false
import React, { useState, useEffect, useRef } from 'react';
import {
  X, Loader2, Search, Briefcase, MapPin, CheckCircle, AlertTriangle,
  Calendar, Clock, Banknote, CreditCard, Smartphone, Package, Plus, Camera, Play,
  FileText, Trash2 as Trash, Square, Mic, User, Hash
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../../supabaseClient';
import { Geral, City } from '../../types';

/** Cria um client Supabase temporário sem persistência de sessão para criação de shadow users */
const createTempSupabaseClient = () =>
  createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  );

interface ManagerQuickTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedChat: { id: string; name: string; phone: string } | null;
  gestorUuid: string;
  onSuccess: () => void;
  chatMessages?: any[];
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const paymentOptions = [
  { id: 'PIX', label: 'PIX', icon: Smartphone },
  { id: 'Cartão de Crédito', label: 'Crédito', icon: CreditCard },
  { id: 'Cartão de Débito', label: 'Débito', icon: CreditCard },
  { id: 'Dinheiro', label: 'Dinheiro', icon: Banknote }
];

const ManagerQuickTicketModal: React.FC<ManagerQuickTicketModalProps> = ({ isOpen, onClose, selectedChat, gestorUuid, onSuccess, chatMessages }) => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Service Search
  const [services, setServices] = useState<Geral[]>([]);
  const [serviceSearchTerm, setServiceSearchTerm] = useState('');
  const [searchedServices, setSearchedServices] = useState<Geral[]>([]);
  const [selectedService, setSelectedService] = useState<Geral | null>(null);
  const [searchingService, setSearchingService] = useState(false);
  const [showServiceDropdown, setShowServiceDropdown] = useState(false);

  // City search
  const [citySearchTerm, setCitySearchTerm] = useState('');
  const [searchedCities, setSearchedCities] = useState<City[]>([]);
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [searchingCity, setSearchingCity] = useState(false);
  const [showCityDropdown, setShowCityDropdown] = useState(false);

  // Form State
  const [date, setDate] = useState('');
  const [flexibility, setFlexibility] = useState('');
  const [description, setDescription] = useState('');
  const [paymentType, setPaymentType] = useState<string>('Dinheiro');
  const [installments, setInstallments] = useState(1);
  const [resources, setResources] = useState<string[]>([]);
  const [currentResource, setCurrentResource] = useState('');

  // Image Upload State
  const [imagePedido, setImagePedido] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [useChatMedia, setUseChatMedia] = useState(false);

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [useChatAudio, setUseChatAudio] = useState(false);
  const [audioChatUrl, setAudioChatUrl] = useState<string | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientCpf, setClientCpf] = useState('');
  const [clientCep, setClientCep] = useState('');
  const [clientStreet, setClientStreet] = useState('');
  const [clientNumber, setClientNumber] = useState('');
  const [clientComplement, setClientComplement] = useState('');
  const [clientNeighborhood, setClientNeighborhood] = useState('');
  const [searchingCep, setSearchingCep] = useState(false);

  const formatCpf = (v: string) => {
    return v.replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
      .slice(0, 14);
  };

  // Service Address State
  const [useDifferentAddress, setUseDifferentAddress] = useState(false);
  const [serviceCep, setServiceCep] = useState('');
  const [serviceStreet, setServiceStreet] = useState('');
  const [serviceNumber, setServiceNumber] = useState('');
  const [serviceComplement, setServiceComplement] = useState('');
  const [serviceNeighborhood, setServiceNeighborhood] = useState('');
  const [searchingServiceCep, setSearchingServiceCep] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen) {
      resetForm();
      if (selectedChat) {
        setClientName(selectedChat.name);
        fetchClientByPhone(selectedChat.phone);
      }
      fetchInitialData();
    }
  }, [isOpen, selectedChat]);

  // Debounce for City Search
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (citySearchTerm.length >= 2 && showCityDropdown) {
        performCitySearch(citySearchTerm);
      } else {
        setSearchedCities([]);
      }
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [citySearchTerm, showCityDropdown]);

  // Debounce for Service Search
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (serviceSearchTerm.length >= 2 && showServiceDropdown) {
        performServiceSearch(serviceSearchTerm);
      } else {
        setSearchedServices(services);
      }
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [serviceSearchTerm, showServiceDropdown, services]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const fetchCepData = async (cepValue: string) => {
    const cleanCep = cepValue.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;

    setSearchingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();
      if (!data.erro) {
        if (data.logradouro) setClientStreet(data.logradouro);
        if (data.bairro) setClientNeighborhood(data.bairro);

        // Se retornar localidade, tenta encontrar a cidade correspondente no Supabase
        if (data.localidade) {
          const { data: cityData } = await supabase
            .from('cidades')
            .select('*')
            .ilike('cidade', data.localidade)
            .limit(1);
          if (cityData && cityData.length > 0) {
            setSelectedCity(cityData[0]);
            setCitySearchTerm(cityData[0].cidade);
          } else {
            // Se não achar a cidade exata, atualiza pelo menos o termo de busca
            setCitySearchTerm(data.localidade);
          }
        }
      }
    } catch (err) {
      console.error("Erro ao buscar CEP:", err);
    } finally {
      setSearchingCep(false);
    }
  };

  const fetchServiceCepData = async (cepValue: string) => {
    const cleanCep = cepValue.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;

    setSearchingServiceCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();
      if (!data.erro) {
        if (data.logradouro) setServiceStreet(data.logradouro);
        if (data.bairro) setServiceNeighborhood(data.bairro);
      }
    } catch (err) {
      console.error("Erro ao buscar CEP de serviço:", err);
    } finally {
      setSearchingServiceCep(false);
    }
  };

  const fetchClientByPhone = async (rawPhone: string) => {
    try {
      const cleanPhone = rawPhone.replace(/\D/g, '');
      let localPhone = cleanPhone;

      if (cleanPhone.startsWith('55') && cleanPhone.length >= 12) {
        localPhone = cleanPhone.substring(2);
      }

      let phonesToSearch = new Set<string>();
      phonesToSearch.add(rawPhone);
      phonesToSearch.add(cleanPhone);
      phonesToSearch.add(localPhone);

      const addFormatted = (p: string) => {
        if (p.length === 11) {
          phonesToSearch.add(`(${p.substring(0, 2)}) ${p.substring(2, 7)}-${p.substring(7)}`);
        } else if (p.length === 10) {
          phonesToSearch.add(`(${p.substring(0, 2)}) ${p.substring(2, 6)}-${p.substring(6)}`);
        }
      };

      addFormatted(localPhone);

      if (localPhone.length === 10) {
        const withNine = localPhone.substring(0, 2) + '9' + localPhone.substring(2);
        phonesToSearch.add(withNine);
        phonesToSearch.add('55' + withNine);
        addFormatted(withNine);
      } else if (localPhone.length === 11 && localPhone[2] === '9') {
        const withoutNine = localPhone.substring(0, 2) + localPhone.substring(3);
        phonesToSearch.add(withoutNine);
        phonesToSearch.add('55' + withoutNine);
        addFormatted(withoutNine);
      }

      const searchPhones = Array.from(phonesToSearch);

      const { data: existingUsers } = await supabase
        .from('users')
        .select('uuid, nome, rua, numero, complemento, bairro, cep, cidade, estado, cpf')
        .in('whatsapp', searchPhones)
        .limit(1);

      if (existingUsers && existingUsers.length > 0) {
        const existingUser = existingUsers[0];
        if (existingUser.nome) setClientName(existingUser.nome);
        if (existingUser.cep) setClientCep(existingUser.cep);
        if (existingUser.rua) setClientStreet(existingUser.rua);
        if (existingUser.numero) setClientNumber(existingUser.numero);
        if (existingUser.complemento) setClientComplement(existingUser.complemento);
        if (existingUser.bairro) setClientNeighborhood(existingUser.bairro);
        if (existingUser.cpf) setClientCpf(existingUser.cpf);

        if (existingUser.cidade) {
          const { data: cityData } = await supabase
            .from('cidades')
            .select('*')
            .eq('id', existingUser.cidade)
            .single();
          if (cityData) {
            setSelectedCity(cityData);
            setCitySearchTerm(cityData.cidade);
          }
        }
      }
    } catch (err) {
      console.error('Erro ao buscar cliente por telefone:', err);
    }
  };

  const resetForm = () => {
    setClientName('');
    setClientCpf('');
    setClientCep('');
    setClientStreet('');
    setClientNumber('');
    setClientComplement('');
    setClientNeighborhood('');
    setUseDifferentAddress(false);
    setServiceCep('');
    setServiceStreet('');
    setServiceNumber('');
    setServiceComplement('');
    setServiceNeighborhood('');
    setSelectedService(null);
    setServiceSearchTerm('');
    setDescription('');
    setDate('');
    setFlexibility('');
    setPaymentType('Dinheiro');
    setInstallments(1);
    setResources([]);
    setCurrentResource('');
    setImagePedido(null);
    deleteAudio();
    setUseChatMedia(false);
    setUseChatAudio(false);
    setAudioChatUrl(null);
    setErrorMsg(null);
    setUploadError(null);
    setSuccess(false);
  };

  const fetchInitialData = async () => {
    try {
      // 1. Buscar Gestor para pegar a cidade padrão
      const { data: gestorData } = await supabase
        .from('users')
        .select('cidade')
        .eq('uuid', gestorUuid)
        .single();

      if (gestorData?.cidade) {
        const { data: cityData } = await supabase
          .from('cidades')
          .select('*')
          .eq('id', gestorData.cidade)
          .single();
        if (cityData) {
          setSelectedCity(cityData);
          setCitySearchTerm(cityData.cidade);
        }
      }

      // 2. Buscar Serviços
      const { data: servicesData } = await supabase
        .from('geral')
        .select('*')
        .eq('primaria', false)
        .eq('ativa', true)
        .order('nome', { ascending: true });

      if (servicesData) {
        setServices(servicesData);
        setSearchedServices(servicesData);
      }
    } catch (err) {
      console.error('Error fetching initial data:', err);
    }
  };

  const performCitySearch = async (term: string) => {
    try {
      setSearchingCity(true);
      const { data } = await supabase
        .from('cidades')
        .select('*')
        .ilike('cidade', `%${term}%`)
        .limit(20);
      setSearchedCities(data || []);
    } catch (err) {
      console.error('Error searching cities:', err);
    } finally {
      setSearchingCity(false);
    }
  };

  const performServiceSearch = (term: string) => {
    setSearchingService(true);
    const normalizedTerm = term.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const filtered = services.filter(s => {
      const normalizedName = s.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return normalizedName.includes(normalizedTerm);
    });
    setSearchedServices(filtered);
    setSearchingService(false);
  };

  // --- Functions from Planning.tsx ---
  const getTodayMin = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 16);
  };

  const handleAddResource = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (currentResource.trim() && !resources.includes(currentResource.trim())) {
      setResources([...resources, currentResource.trim()]);
    }
    setCurrentResource('');
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
      setUploadError(`O arquivo (${sizeMB}MB) é maior que o tamanho máximo de 50MB.`);
      e.target.value = '';
      return;
    }

    setUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'bin';
      const fileName = `pedidos/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from('imagens').upload(fileName, file, {
        contentType: file.type || undefined
      });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('imagens').getPublicUrl(fileName);
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
      timerRef.current = setInterval(() => setRecordingTime((prev) => prev + 1), 1000);
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
    setAudioChatUrl(null);
    setRecordingTime(0);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // --- Submit Logic ---
  const handleSubmit = async () => {
    if (!selectedChat) return;
    if (!selectedService) {
      setErrorMsg('Selecione um serviço.');
      return;
    }
    if (!selectedCity) {
      setErrorMsg('Selecione uma cidade válida.');
      return;
    }
    const cleanCpf = clientCpf.replace(/\D/g, '');
    if (!cleanCpf) {
      setErrorMsg('Por favor, preencha o CPF do cliente.');
      return;
    }
    if (cleanCpf.length !== 11) {
      setErrorMsg('CPF inválido. O CPF deve conter 11 dígitos.');
      return;
    }
    if (!date) {
      setErrorMsg('Por favor, preencha a data e hora preferencial.');
      return;
    }
    if (!description && !audioBlob && !audioChatUrl) {
      setErrorMsg('Por favor, forneça uma descrição em texto ou selecione/grave um áudio.');
      return;
    }

    const selectedDate = new Date(date);
    const now = new Date();
    now.setSeconds(0, 0);

    if (selectedDate.getTime() < now.getTime()) {
      setErrorMsg("Não é possível agendar serviços para uma data passada.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const finalStreet = useDifferentAddress ? serviceStreet : clientStreet;
      const finalNumber = useDifferentAddress ? serviceNumber : clientNumber;
      const finalComplement = useDifferentAddress ? serviceComplement : clientComplement;
      const finalNeighborhood = useDifferentAddress ? serviceNeighborhood : clientNeighborhood;
      const finalCep = useDifferentAddress ? serviceCep : clientCep;

      const finalAddress = [
        finalStreet,
        finalNumber && `Nº ${finalNumber}`,
        finalComplement,
        finalNeighborhood && `Bairro: ${finalNeighborhood}`,
        finalCep && `CEP: ${finalCep}`
      ].filter(Boolean).join(', ');

      // 1. Verify or create user (Shadow User)
      let clientUuid = '';

      const rawPhone = selectedChat.phone;
      const cleanPhone = rawPhone.replace(/\D/g, '');
      let localPhone = cleanPhone;

      if (cleanPhone.startsWith('55') && cleanPhone.length >= 12) {
        localPhone = cleanPhone.substring(2);
      }

      let phonesToSearch = new Set<string>();
      phonesToSearch.add(rawPhone);
      phonesToSearch.add(cleanPhone);
      phonesToSearch.add(localPhone);

      const addFormatted = (p: string) => {
        if (p.length === 11) {
          phonesToSearch.add(`(${p.substring(0, 2)}) ${p.substring(2, 7)}-${p.substring(7)}`);
        } else if (p.length === 10) {
          phonesToSearch.add(`(${p.substring(0, 2)}) ${p.substring(2, 6)}-${p.substring(6)}`);
        }
      };

      addFormatted(localPhone);

      if (localPhone.length === 10) {
        const withNine = localPhone.substring(0, 2) + '9' + localPhone.substring(2);
        phonesToSearch.add(withNine);
        phonesToSearch.add('55' + withNine);
        addFormatted(withNine);
      } else if (localPhone.length === 11 && localPhone[2] === '9') {
        const withoutNine = localPhone.substring(0, 2) + localPhone.substring(3);
        phonesToSearch.add(withoutNine);
        phonesToSearch.add('55' + withoutNine);
        addFormatted(withoutNine);
      }

      const searchPhones = Array.from(phonesToSearch);

      const { data: existingUsers } = await supabase
        .from('users')
        .select('uuid, email, origem')
        .in('whatsapp', searchPhones)
        .limit(1);

      let isShadowUser = true;

      if (existingUsers && existingUsers.length > 0) {
        clientUuid = existingUsers[0].uuid;
        const email = existingUsers[0].email;
        const origem = existingUsers[0].origem;
        if (email && !email.startsWith('whatsapp_') && origem !== 'whatsapp') {
          isShadowUser = false;
        }

        // Update name, address and CPF if provided
        await supabase.from('users').update({
          nome: clientName,
          cpf: cleanCpf,
          rua: clientStreet || '',
          numero: clientNumber || '',
          complemento: clientComplement || '',
          bairro: clientNeighborhood || '',
          cep: clientCep || '',
          cidade: selectedCity.id,
          estado: selectedCity.uf
        }).eq('uuid', clientUuid);
      } else {
        const fakeEmail = `whatsapp_${selectedChat.phone.replace(/\D/g, '')}@uaifix.com`;

        const tempClient = createTempSupabaseClient();

        const { data: authData, error: authError } = await tempClient.auth.signUp({
          email: fakeEmail,
          password: 'UaiFix@2025' // Senha padrão para shadow users
        });

        if (authError) throw new Error(`Erro de autenticação: ${authError.message}`);
        if (!authData.user) throw new Error("Erro ao criar usuário na autenticação.");

        clientUuid = authData.user.id;

        const { error: userError } = await supabase.from('users').insert({
          uuid: clientUuid,
          nome: clientName,
          email: fakeEmail,
          cpf: cleanCpf,
          whatsapp: selectedChat.phone,
          tipo: 'consumidor',
          ativo: true,
          cidade: selectedCity.id,
          estado: selectedCity.uf,
          sexo: 'Não informado',
          rua: clientStreet || '',
          numero: clientNumber || '',
          complemento: clientComplement || '',
          bairro: clientNeighborhood || '',
          cep: clientCep || '',
          origem: 'whatsapp',
          fotoperfil: ''
        });
        if (userError) throw new Error(`Erro ao criar perfil do cliente: ${userError.message}`);
      }

      // Upsert lead in whatsapp_leads table if it's a shadow user (or new)
      if (isShadowUser) {
        const { error: leadError } = await supabase
          .from('whatsapp_leads')
          .upsert({
            cpf: cleanCpf,
            nome: clientName,
            telefone: rawPhone,
            chat_id: selectedChat.id,
            user_uuid: clientUuid,
            vinculado: false,
            updated_at: new Date().toISOString()
          }, { onConflict: 'cpf' });

        if (leadError) throw new Error(`Erro ao registrar lead do WhatsApp: ${leadError.message}`);
      }

      // 2. Upload Audio if exists
      let finalAudioUrl = null;
      if (!useChatAudio && audioBlob) {
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.webm`;
        const { error: audioUploadError } = await supabase.storage.from('audios').upload(fileName, audioBlob, { contentType: 'audio/webm' });
        if (audioUploadError) throw audioUploadError;
        const { data: audioData } = supabase.storage.from('audios').getPublicUrl(fileName);
        finalAudioUrl = audioData.publicUrl;
      } else if (useChatAudio && audioChatUrl) {
        finalAudioUrl = audioChatUrl;
      }

      // 3. Create ticket (Chave)
      const uniqueKey = Math.random().toString(36).substring(2, 10).toUpperCase();
      const { data: chaveData, error: chaveError } = await supabase
        .from('chaves')
        .insert({
          cliente: clientUuid,
          profissional: null,
          chaveunica: uniqueKey,
          status: 'pendente',
          atividade: selectedService.id,
          cidade: selectedCity.id,
          fotoantes: [],
          fotodepois: [],
          whatsapp_chat_id: selectedChat.id,
          whatsapp_lead_cpf: cleanCpf
        })
        .select()
        .single();

      if (chaveError) throw new Error(`Erro ao criar chamado: ${chaveError.message}`);

      // 4. Create planning (Planejamento)
      let fullDescription = description;
      if (finalAddress) fullDescription += `\n\n[VIÇO]:\n${finalAddress}`;
      if (flexibility) fullDescription += `\n\n[FLEXIBILIDADE DE AGENDA]:\n${flexibility}`;
      if (paymentType === 'Cartão de Crédito') fullDescription += `\n\n[PARCELAMENTO DESEJADO]: ${installments}x`;

      const { error: planError } = await supabase
        .from('planejamento')
        .insert({
          chave: chaveData.id,
          execucao: new Date(date).toISOString(),
          descricao: `[ABERTO VIA WHATSAPP POR GESTOR]\n\n${fullDescription}`,
          recursos: resources,
          pagamento: paymentType,
          imagem_pedido: imagePedido,
          audio_pedido: finalAudioUrl,
          ativo: true,
          tempoprevisto: 1
        });

      if (planError) throw new Error(`Erro ao salvar detalhes do chamado: ${planError.message}`);

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2500);

    } catch (err: any) {
      console.error('Error creating ticket:', err);
      setErrorMsg(err.message || 'Ocorreu um erro ao abrir o chamado.');
    } finally {
      setLoading(false);
    }
  };

  const mediaMessages = (chatMessages || []).filter(m => m.type === 'image' || m.type === 'video');
  const audioMessages = (chatMessages || []).filter(m => m.type === 'audio');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10 shrink-0">
          <div className="flex-1 mr-4">
            <h3 className="font-black text-gray-900 text-lg leading-tight">Novo Chamado</h3>
          </div>
          <button
            onClick={onClose}
            disabled={loading || success}
            className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto no-scrollbar space-y-6 flex-1 bg-gray-50/30">
          {success ? (
            <div className="py-20 flex flex-col items-center justify-center text-center animate-in zoom-in duration-300">
              <div className="w-24 h-24 bg-green-100 text-green-500 rounded-full flex items-center justify-center mb-4">
                <CheckCircle size={48} />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Chamado Aberto!</h2>
              <p className="text-sm text-gray-500">O ticket completo foi criado com sucesso no painel principal.</p>
            </div>
          ) : (
            <>
              {errorMsg && (
                <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-xs font-bold flex items-start border border-red-100 shadow-sm animate-in fade-in">
                  <AlertTriangle size={18} className="mr-2 mt-0.5 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* SECTION: Básico */}
              <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-5">
                {/* Nome do Cliente */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 flex items-center">
                    <User size={12} className="mr-1" /> Nome do Cliente
                  </label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Nome do Cliente"
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-4 pl-4 pr-10 text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-ios-blue/30"
                  />
                </div>

                {/* CPF do Cliente */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 flex items-center">
                    <FileText size={12} className="mr-1" /> CPF do Cliente
                  </label>
                  <input
                    type="text"
                    value={clientCpf}
                    onChange={(e) => setClientCpf(formatCpf(e.target.value))}
                    maxLength={14}
                    placeholder="000.000.000-00"
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-4 pl-4 pr-10 text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-ios-blue/30"
                  />
                </div>

                {/* Categoria do Serviço (Search Bar) */}
                <div className="space-y-2 relative">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 flex items-center">
                    <Briefcase size={12} className="mr-1" /> Serviço / Categoria
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={serviceSearchTerm}
                      onChange={(e) => {
                        setServiceSearchTerm(e.target.value);
                        setShowServiceDropdown(true);
                        if (selectedService && e.target.value !== selectedService.nome) {
                          setSelectedService(null);
                        }
                      }}
                      onFocus={() => setShowServiceDropdown(true)}
                      placeholder="Buscar categoria de serviço..."
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-4 pl-4 pr-10 text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-ios-blue/30"
                    />
                    {searchingService ? (
                      <Loader2 size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
                    ) : (
                      <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    )}
                  </div>

                  {showServiceDropdown && searchedServices.length > 0 && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-gray-100 shadow-xl rounded-2xl max-h-48 overflow-y-auto">
                      {searchedServices.map(service => (
                        <div
                          key={service.id}
                          onClick={() => {
                            setSelectedService(service);
                            setServiceSearchTerm(service.nome);
                            setShowServiceDropdown(false);
                          }}
                          className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0"
                        >
                          <p className="text-sm font-bold text-gray-900">{service.nome}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Cidade */}
                <div className="space-y-2 relative">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 flex items-center">
                    <MapPin size={12} className="mr-1" /> Cidade do Cliente
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={citySearchTerm}
                      onChange={(e) => {
                        setCitySearchTerm(e.target.value);
                        setShowCityDropdown(true);
                        if (selectedCity && e.target.value !== selectedCity.cidade) {
                          setSelectedCity(null);
                        }
                      }}
                      onFocus={() => setShowCityDropdown(true)}
                      placeholder="Buscar cidade..."
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-4 pl-4 pr-10 text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-ios-blue/30"
                    />
                    {searchingCity ? (
                      <Loader2 size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
                    ) : (
                      <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    )}
                  </div>

                  {showCityDropdown && searchedCities.length > 0 && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-gray-100 shadow-xl rounded-2xl max-h-48 overflow-y-auto">
                      {searchedCities.map(city => (
                        <div
                          key={city.id}
                          onClick={() => {
                            setSelectedCity(city);
                            setCitySearchTerm(city.cidade);
                            setShowCityDropdown(false);
                          }}
                          className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0"
                        >
                          <p className="text-sm font-bold text-gray-900">{city.cidade}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Checkbox para endereço diferente (MOVED TO TOP) */}
                <div className="pt-4 mt-4 border-t border-gray-100">
                  <label className="flex items-center space-x-3 cursor-pointer group w-max">
                    <div className="relative flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={useDifferentAddress}
                        onChange={(e) => setUseDifferentAddress(e.target.checked)}
                        className="peer appearance-none w-5 h-5 border-2 border-gray-300 rounded-md checked:bg-ios-blue checked:border-ios-blue focus:outline-none focus:ring-2 focus:ring-ios-blue/30 transition-all cursor-pointer"
                      />
                      <CheckCircle size={14} className="text-white absolute opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                    </div>
                    <span className="text-sm font-bold text-gray-700 group-hover:text-gray-900 transition-colors">
                      O serviço será realizado em outro endereço?
                    </span>
                  </label>
                </div>

                {/* Campos para endereço de serviço (se diferente) */}
                {useDifferentAddress && (
                  <div className="pt-4 mt-2 space-y-4 animate-in slide-in-from-top-2 duration-200 border-b border-gray-100 pb-4">
                    <h4 className="text-xs font-black text-ios-blue uppercase tracking-widest flex items-center mb-2">
                      <MapPin size={14} className="mr-1.5" /> Endereço Alternativo
                    </h4>

                    {/* CEP do Serviço */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 flex items-center">
                        <MapPin size={12} className="mr-1" /> CEP do Serviço
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={serviceCep}
                          onChange={(e) => {
                            const val = e.target.value;
                            setServiceCep(val);
                            if (val.replace(/\D/g, '').length === 8) {
                              fetchServiceCepData(val);
                            }
                          }}
                          placeholder="Ex: 00000-000"
                          maxLength={9}
                          className="w-full bg-blue-50/50 border border-blue-100 rounded-2xl py-4 pl-4 pr-10 text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-ios-blue/30"
                        />
                        {searchingServiceCep && (
                          <Loader2 size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-ios-blue animate-spin" />
                        )}
                      </div>
                    </div>

                    {/* Rua / Bairro Serviço */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 flex items-center">
                          <MapPin size={12} className="mr-1" /> Rua / Logradouro
                        </label>
                        <input
                          type="text"
                          value={serviceStreet}
                          onChange={(e) => setServiceStreet(e.target.value)}
                          placeholder="Nome da Rua"
                          className="w-full bg-blue-50/50 border border-blue-100 rounded-2xl py-4 pl-4 pr-4 text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-ios-blue/30"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 flex items-center">
                          <MapPin size={12} className="mr-1" /> Bairro
                        </label>
                        <input
                          type="text"
                          value={serviceNeighborhood}
                          onChange={(e) => setServiceNeighborhood(e.target.value)}
                          placeholder="Nome do Bairro"
                          className="w-full bg-blue-50/50 border border-blue-100 rounded-2xl py-4 pl-4 pr-4 text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-ios-blue/30"
                        />
                      </div>
                    </div>

                    {/* Número / Complemento Serviço */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 flex items-center">
                          <Hash size={12} className="mr-1" /> Número
                        </label>
                        <input
                          type="text"
                          value={serviceNumber}
                          onChange={(e) => setServiceNumber(e.target.value)}
                          placeholder="Nº"
                          className="w-full bg-blue-50/50 border border-blue-100 rounded-2xl py-4 pl-4 pr-4 text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-ios-blue/30"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 flex items-center">
                          <Plus size={12} className="mr-1" /> Complemento
                        </label>
                        <input
                          type="text"
                          value={serviceComplement}
                          onChange={(e) => setServiceComplement(e.target.value)}
                          placeholder="Apto, Bloco..."
                          className="w-full bg-blue-50/50 border border-blue-100 rounded-2xl py-4 pl-4 pr-4 text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-ios-blue/30"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Título opcional para o Endereço do Cliente */}
                <h4 className={`text-xs font-black uppercase tracking-widest flex items-center mb-2 ${useDifferentAddress ? 'text-gray-400 mt-4' : 'text-gray-500 mt-4'}`}>
                  <User size={14} className="mr-1.5" /> Endereço do Cliente {useDifferentAddress && '(Cadastrado)'}
                </h4>

                {/* CEP */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 flex items-center">
                    <MapPin size={12} className="mr-1" /> CEP
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={clientCep}
                      onChange={(e) => {
                        const val = e.target.value;
                        setClientCep(val);
                        if (val.replace(/\D/g, '').length === 8) {
                          fetchCepData(val);
                        }
                      }}
                      placeholder="Ex: 00000-000"
                      maxLength={9}
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-4 pl-4 pr-10 text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-ios-blue/30"
                    />
                    {searchingCep && (
                      <Loader2 size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-ios-blue animate-spin" />
                    )}
                  </div>
                </div>

                {/* Rua / Bairro (Auto-filled) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 flex items-center">
                      <MapPin size={12} className="mr-1" /> Rua / Logradouro
                    </label>
                    <input
                      type="text"
                      value={clientStreet}
                      onChange={(e) => setClientStreet(e.target.value)}
                      placeholder="Nome da Rua"
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-4 pl-4 pr-4 text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-ios-blue/30"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 flex items-center">
                      <MapPin size={12} className="mr-1" /> Bairro
                    </label>
                    <input
                      type="text"
                      value={clientNeighborhood}
                      onChange={(e) => setClientNeighborhood(e.target.value)}
                      placeholder="Nome do Bairro"
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-4 pl-4 pr-4 text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-ios-blue/30"
                    />
                  </div>
                </div>

                {/* Número / Complemento */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 flex items-center">
                      <Hash size={12} className="mr-1" /> Número
                    </label>
                    <input
                      type="text"
                      value={clientNumber}
                      onChange={(e) => setClientNumber(e.target.value)}
                      placeholder="Nº"
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-4 pl-4 pr-4 text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-ios-blue/30"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 flex items-center">
                      <Plus size={12} className="mr-1" /> Complemento
                    </label>
                    <input
                      type="text"
                      value={clientComplement}
                      onChange={(e) => setClientComplement(e.target.value)}
                      placeholder="Apto, Bloco..."
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-4 pl-4 pr-4 text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-ios-blue/30"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION: Agendamento */}
              <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-5">
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
                    placeholder="Ex: Disponível sábados de manhã ou após as 18h."
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-ios-blue/30 shadow-inner resize-none"
                  />
                </div>
              </div>

              {/* SECTION: Pagamento */}
              <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-5">
                <div className="space-y-4">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 flex items-center">
                    <Banknote size={12} className="mr-1" /> Forma de Pagamento
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {paymentOptions.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setPaymentType(opt.id)}
                        className={`p-4 rounded-2xl border flex flex-col items-center justify-center space-y-2 transition-all active:scale-95 ${paymentType === opt.id
                          ? 'bg-ios-blue text-white border-ios-blue shadow-md'
                          : 'bg-gray-50 border-gray-100 text-gray-900 hover:bg-gray-100'
                          }`}
                      >
                        <opt.icon size={22} className={paymentType === opt.id ? 'text-white' : 'text-gray-400'} />
                        <span className="text-xs font-bold">{opt.label}</span>
                      </button>
                    ))}
                  </div>

                  {paymentType === 'Cartão de Crédito' && (
                    <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 shadow-inner space-y-3 animate-in fade-in">
                      <label className="text-[10px] font-black text-ios-blue uppercase tracking-widest ml-1 flex items-center">
                        <CreditCard size={12} className="mr-1" /> Número de Parcelas
                      </label>
                      <select
                        value={installments}
                        onChange={(e) => setInstallments(parseInt(e.target.value))}
                        className="w-full bg-white border border-blue-50 rounded-xl p-3 text-sm font-bold text-gray-900 outline-none appearance-none shadow-sm"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                          <option key={n} value={n}>{n}x {n === 1 ? 'sem juros' : ''}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION: Detalhes do Serviço */}
              <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-5">
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
                      className="flex-1 bg-gray-50 border border-gray-100 rounded-xl p-3 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-ios-blue/30 shadow-inner"
                    />
                    <button onClick={handleAddResource} className="bg-black text-white px-4 rounded-xl hover:bg-gray-800 transition-colors shadow-sm active:scale-95"><Plus size={20} /></button>
                  </div>
                  {resources.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {resources.map((res, idx) => (
                        <div key={idx} className="bg-blue-50 text-blue-800 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center shadow-sm border border-blue-100">
                          <span>{res}</span>
                          <button onClick={() => handleRemoveResource(idx)} className="ml-2 text-blue-400 hover:text-blue-600 p-0.5"><X size={14} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center">
                      <Camera size={12} className="mr-1" /> Foto / Vídeo (Opcional p/ Gestor)
                    </label>
                    {mediaMessages.length > 0 && !imagePedido && (
                      <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                        <button
                          onClick={() => setUseChatMedia(false)}
                          className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all ${!useChatMedia ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                          Computador
                        </button>
                        <button
                          onClick={() => setUseChatMedia(true)}
                          className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all ${useChatMedia ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                          Do Chat
                        </button>
                      </div>
                    )}
                  </div>

                  {uploadError && (
                    <div className="bg-red-50 p-3 rounded-xl flex items-start space-x-2 mb-2">
                      <AlertTriangle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                      <p className="text-xs font-bold text-red-700">{uploadError}</p>
                      <button onClick={() => setUploadError(null)} className="text-red-400"><X size={14} /></button>
                    </div>
                  )}

                  {imagePedido ? (
                    <div className="relative w-full h-40 bg-gray-100 rounded-2xl overflow-hidden border border-gray-200">
                      {imagePedido.toLowerCase().includes('.mp4') || imagePedido.toLowerCase().includes('video') ? (
                        <video src={imagePedido} className="w-full h-full object-cover" controls playsInline />
                      ) : (
                        <img src={imagePedido} className="w-full h-full object-cover" />
                      )}
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <button onClick={handleRemoveImage} className="bg-red-500 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-lg flex items-center"><Trash size={14} className="mr-1" /> Remover</button>
                      </div>
                    </div>
                  ) : useChatMedia && mediaMessages.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1 no-scrollbar animate-in fade-in">
                      {mediaMessages.map((msg, idx) => (
                        <div
                          key={idx}
                          onClick={() => setImagePedido(msg.text)}
                          className="aspect-square bg-gray-100 rounded-xl overflow-hidden relative cursor-pointer border-2 border-transparent hover:border-ios-blue transition-all group"
                        >
                          {msg.type === 'video' ? (
                            <video src={msg.text} className="w-full h-full object-cover" />
                          ) : (
                            <img src={msg.text} className="w-full h-full object-cover" />
                          )}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 flex items-center justify-center transition-all">
                            <div className="bg-ios-blue text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 scale-50 group-hover:scale-100 transition-all shadow-md">
                              <Plus size={16} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <label className={`w-full h-24 bg-gray-50 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors border-gray-200 animate-in fade-in`}>
                      {uploadingImage ? <Loader2 className="animate-spin text-ios-blue" size={24} /> : (
                        <>
                          <div className="flex gap-2 mb-1">
                            <Camera size={20} className="text-gray-400" />
                            <Play size={20} className="text-gray-400" />
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                            {useChatMedia ? 'Nenhuma mídia no chat' : 'Anexar Mídia do PC'}
                          </span>
                        </>
                      )}
                      <input type="file" accept="image/*,video/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
                    </label>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center">
                      <Mic size={12} className="mr-1" /> Áudio do Chamado (Opcional)
                    </label>
                    {audioMessages.length > 0 && !audioUrl && !audioChatUrl && (
                      <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                        <button
                          onClick={() => setUseChatAudio(false)}
                          className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all ${!useChatAudio ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                          Gravar
                        </button>
                        <button
                          onClick={() => setUseChatAudio(true)}
                          className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all ${useChatAudio ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                          Do Chat
                        </button>
                      </div>
                    )}
                  </div>

                  {useChatAudio ? (
                    <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 animate-in fade-in">
                      {audioChatUrl ? (
                        <div className="flex flex-col items-center gap-3">
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Áudio do chat selecionado</p>
                          <div className="flex items-center gap-3 w-full">
                            <audio src={audioChatUrl} controls className="h-10 flex-1" />
                            <button onClick={deleteAudio} className="text-red-400 hover:text-red-600 p-2"><Trash size={18} /></button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-2 no-scrollbar">
                          {audioMessages.length > 0 ? audioMessages.map((msg, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl p-3 hover:border-ios-blue transition-all"
                            >
                              <div className="flex-1 overflow-hidden flex flex-col gap-1.5">
                                <div className="flex items-center gap-2">
                                  <Mic size={12} className="text-blue-500" />
                                  <p className="text-xs font-bold text-gray-900 truncate">Áudio Recebido ({msg.timestamp})</p>
                                </div>
                                <audio src={msg.text} controls className="h-8 w-full max-w-[220px]" />
                              </div>
                              <button
                                onClick={() => setAudioChatUrl(msg.text)}
                                className="bg-gray-100 text-gray-600 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-ios-blue hover:text-white transition-all shrink-0"
                              >
                                Selecionar
                              </button>
                            </div>
                          )) : (
                            <p className="text-xs text-gray-500 text-center py-4 font-bold">Nenhum áudio encontrado neste chat.</p>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      {audioUrl ? (
                        <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-xl border border-blue-100 w-full">
                          <audio src={audioUrl} controls className="h-8 flex-1" />
                          <button onClick={deleteAudio} className="text-red-400 hover:text-red-600"><Trash size={18} /></button>
                        </div>
                      ) : (
                        <button
                          onClick={isRecording ? stopRecording : startRecording}
                          className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-sm transition-all shadow-sm border ${isRecording
                            ? 'bg-red-50 border-red-200 text-red-600 animate-pulse'
                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                          {isRecording ? (
                            <><Square size={16} fill="currentColor" /><span>Gravando... {formatTime(recordingTime)} (Parar)</span></>
                          ) : (
                            <><Mic size={16} /><span>Gravar Áudio Novo</span></>
                          )}
                        </button>
                      )}
                    </div>
                  )}

                  <div className="pt-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center ml-1 mb-2">
                      <FileText size={12} className="mr-1" /> Detalhes do Problema em Texto
                    </label>
                    <textarea
                      rows={4}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Descreva detalhadamente o que precisa ser feito..."
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-ios-blue/30 resize-none shadow-inner"
                    />
                  </div>
                </div>
              </div>

            </>
          )}
        </div>

        {/* Footer actions */}
        {!success && (
          <div className="p-4 border-t border-gray-100 bg-white shrink-0">
            <button
              onClick={handleSubmit}
              disabled={loading || uploadingImage || isRecording}
              className="w-full bg-black text-white py-4 rounded-2xl font-bold text-base shadow-lg active:scale-[0.98] transition-all flex items-center justify-center disabled:opacity-70"
            >
              {loading ? <Loader2 className="animate-spin" size={24} /> : 'Abrir Chamado'}
            </button>
          </div>
        )}
      </div>

      {/* Invisible overlay to close dropdowns */}
      {(showCityDropdown || showServiceDropdown) && (
        <div className="fixed inset-0 z-10" onClick={() => { setShowCityDropdown(false); setShowServiceDropdown(false); }} />
      )}
    </div>
  );
};

export default ManagerQuickTicketModal;
