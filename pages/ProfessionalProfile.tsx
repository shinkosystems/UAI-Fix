
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { User, Avaliacao, Geral } from '../types';
import { ChevronLeft, Star, MapPin, BadgeCheck, Calendar, ShieldCheck, Clock, MessageCircle, MoreHorizontal, Briefcase } from 'lucide-react';

const ProfessionalProfile: React.FC = () => {
  const { uuid } = useParams<{ uuid: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get passed service details from navigation state
  const serviceId = location.state?.serviceId;
  const serviceName = location.state?.serviceName || 'Serviço';

  const [professional, setProfessional] = useState<User | null>(null);
  const [reviews, setReviews] = useState<Avaliacao[]>([]);
  const [services, setServices] = useState<Geral[]>([]);
  const [cityName, setCityName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (uuid) {
      fetchProfessionalData();
    }
  }, [uuid]);

  const fetchProfessionalData = async () => {
    try {
      setLoading(true);

      // 1. Fetch Professional Details
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('uuid', uuid)
        .single();

      if (userError) throw userError;
      setProfessional(userData);

      // Fetch City Name if exists
      if (userData.cidade) {
        const { data: cityData } = await supabase
          .from('cidades')
          .select('cidade')
          .eq('id', userData.cidade)
          .single();
        if (cityData) setCityName(cityData.cidade);
      }

      // 2. Fetch Services (Specialties)
      if (userData.atividade && userData.atividade.length > 0) {
          const { data: servicesData } = await supabase
            .from('geral')
            .select('*')
            .in('id', userData.atividade)
            .eq('ativa', true);
          
          if (servicesData) setServices(servicesData);
      }

      // 3. Fetch Reviews
      const { data: reviewsData, error: reviewsError } = await supabase
        .from('avaliacoes')
        .select('*')
        .eq('profissional', uuid)
        .order('created_at', { ascending: false });

      if (reviewsError) throw reviewsError;

      const reviewsList = reviewsData || [];

      // 4. Enrich Reviews with Client Names (Public Users Table)
      if (reviewsList.length > 0) {
        const clientUuids = reviewsList.map(r => r.cliente);
        
        const { data: clientsData } = await supabase
            .from('users')
            .select('uuid, nome, fotoperfil')
            .in('uuid', clientUuids);

        const enrichedReviews = reviewsList.map(review => {
            const client = clientsData?.find(c => c.uuid === review.cliente);
            return {
                ...review,
                clienteNome: client?.nome || 'Usuário',
                clienteFoto: client?.fotoperfil || ''
            };
        });
        
        setReviews(enrichedReviews);
      } else {
        setReviews([]);
      }

    } catch (error) {
      console.error('Error fetching professional details:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAverageRating = () => {
    if (reviews.length === 0) return 0;
    const sum = reviews.reduce((acc, curr) => acc + curr.nota, 0);
    return (sum / reviews.length).toFixed(1);
  };

  const handleSchedule = () => {
    if (!uuid) return;
    navigate(`/planning/${uuid}`, {
        state: {
            serviceId,
            serviceName
        }
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-ios-bg flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-ios-blue border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!professional) {
    return (
      <div className="min-h-screen bg-ios-bg flex items-center justify-center p-5 text-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Profissional não encontrado</h2>
          <button onClick={() => navigate(-1)} className="mt-4 text-ios-blue">Voltar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F2F4F8] relative">
      {/* Vitrified Header - Floating */}
      <div className="fixed top-0 left-0 right-0 z-40 px-4 pt-10 pb-2">
        <div className="flex items-center justify-between max-w-md mx-auto w-full">
            <button 
            onClick={() => navigate(-1)} 
            className="w-10 h-10 rounded-full vitrified flex items-center justify-center text-gray-800 shadow-sm active:scale-95 transition-transform"
            >
            <ChevronLeft size={22} />
            </button>
            
            <button 
            className="w-10 h-10 rounded-full vitrified flex items-center justify-center text-gray-800 shadow-sm active:scale-95 transition-transform"
            >
            <MoreHorizontal size={20} />
            </button>
        </div>
      </div>

      <div className="pb-32 pt-28">
        {/* Hero Card */}
        <div className="px-5 mb-6">
            <div className="bg-white rounded-[2.5rem] p-6 shadow-vitrified relative overflow-hidden text-center">
                
                {/* Background Decoration */}
                <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-blue-50 to-white opacity-50"></div>

                <div className="relative z-10">
                    <div className="relative inline-block mb-4">
                        <div className="w-32 h-32 rounded-full p-1.5 bg-white shadow-lg mx-auto">
                            <img 
                            src={professional.fotoperfil || `https://ui-avatars.com/api/?name=${professional.nome}`} 
                            alt={professional.nome} 
                            className="w-full h-full rounded-full object-cover"
                            />
                        </div>
                        <div className="absolute bottom-2 right-2 bg-blue-500 text-white p-1.5 rounded-full border-[3px] border-white shadow-md">
                            <BadgeCheck size={16} fill="currentColor" className="text-white" />
                        </div>
                    </div>
                    
                    <h2 className="text-2xl font-bold text-gray-900 leading-tight mb-1">{professional.nome}</h2>
                    
                    <div className="flex justify-center items-center text-gray-500 text-sm mb-4">
                        <MapPin size={14} className="mr-1 text-gray-400" />
                        <span>{professional.bairro || 'Centro'} • {cityName}</span>
                    </div>

                    <div className="flex justify-center space-x-3 mb-2">
                        <div className="flex items-center space-x-1.5 bg-yellow-50 px-3 py-1.5 rounded-full border border-yellow-100">
                            <Star size={14} className="text-yellow-500 fill-yellow-500" />
                            <span className="font-bold text-gray-900 text-sm">{getAverageRating()}</span>
                        </div>
                        <div className="flex items-center space-x-1.5 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
                            <span className="text-gray-600 text-sm font-medium">{reviews.length} avaliações</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Quick Stats Row */}
        <div className="px-5 mb-6 overflow-x-auto no-scrollbar">
            <div className="flex space-x-3">
                 <div className="flex-1 min-w-[100px] bg-white rounded-2xl p-4 text-center shadow-sm border border-gray-50">
                    <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mx-auto mb-2">
                        <ShieldCheck size={20} />
                    </div>
                    <span className="text-xs font-semibold text-gray-900">Verificado</span>
                 </div>
                 <div className="flex-1 min-w-[100px] bg-white rounded-2xl p-4 text-center shadow-sm border border-gray-50">
                    <div className="w-10 h-10 rounded-full bg-green-50 text-green-500 flex items-center justify-center mx-auto mb-2">
                        <Clock size={20} />
                    </div>
                    <span className="text-xs font-semibold text-gray-900">Rápido</span>
                 </div>
                 <div className="flex-1 min-w-[100px] bg-white rounded-2xl p-4 text-center shadow-sm border border-gray-50">
                    <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-500 flex items-center justify-center mx-auto mb-2">
                        <MessageCircle size={20} />
                    </div>
                    <span className="text-xs font-semibold text-gray-900">Atencioso</span>
                 </div>
            </div>
        </div>

        {/* About Section */}
        <div className="px-5 mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-3 ml-1">Sobre</h3>
            <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-50">
                <p className="text-gray-600 text-sm leading-relaxed">
                    Profissional experiente e dedicado, especializado em oferecer serviços de alta qualidade. Compromisso com pontualidade e satisfação do cliente.
                </p>
            </div>
        </div>

        {/* Specialties / Services List */}
        {services.length > 0 && (
            <div className="px-5 mb-6">
                <h3 className="text-lg font-bold text-gray-900 mb-3 ml-1 flex items-center">
                    <Briefcase size={18} className="mr-2 text-gray-400" />
                    Especialidades
                </h3>
                <div className="flex space-x-3 overflow-x-auto no-scrollbar pb-2">
                    {services.map(service => (
                        <div key={service.id} className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-3 min-w-[150px] whitespace-nowrap pr-5">
                            <div className="w-10 h-10 rounded-xl bg-gray-50 flex-shrink-0 overflow-hidden">
                                <img 
                                    src={service.imagem || `https://picsum.photos/seed/${service.id}/100`} 
                                    alt={service.nome} 
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <span className="text-xs font-bold text-gray-800">{service.nome}</span>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* Reviews Section */}
        <div className="px-5">
            <h3 className="text-lg font-bold text-gray-900 mb-3 ml-1">Avaliações</h3>
            
            {reviews.length > 0 ? (
                <div className="space-y-3">
                    {reviews.map((review) => (
                        <div key={review.id} className="bg-white p-5 rounded-3xl shadow-sm border border-gray-50">
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 rounded-full bg-gray-100 p-0.5">
                                        <img 
                                            src={review.clienteFoto || `https://ui-avatars.com/api/?name=${review.clienteNome || 'U'}&background=random`} 
                                            alt="Cliente" 
                                            className="w-full h-full rounded-full object-cover"
                                        />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-900">{review.clienteNome}</p>
                                        <p className="text-xs text-gray-400">
                                            {new Date(review.created_at).toLocaleDateString('pt-BR')}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex bg-yellow-50 px-2 py-1 rounded-lg">
                                    <Star size={12} className="text-yellow-500 fill-yellow-500 mr-1" />
                                    <span className="text-xs font-bold text-yellow-700">{review.nota.toFixed(1)}</span>
                                </div>
                            </div>
                            <p className="text-gray-600 text-sm leading-relaxed">{review.comentario}</p>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white/50 p-8 rounded-3xl border border-dashed border-gray-300 text-center">
                    <p className="text-gray-400 text-sm">Ainda não há avaliações.</p>
                </div>
            )}
        </div>
      </div>

      {/* Floating Action Island - Glassmorphism */}
      <div className="fixed bottom-6 left-5 right-5 z-50">
        <div className="max-w-md mx-auto w-full">
            <div className="vitrified rounded-[2rem] p-2 shadow-floating flex items-center justify-between pl-6 pr-2">
                <div className="flex flex-col">
                    <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide">Serviço</span>
                    <span className="text-sm font-bold text-gray-900 truncate max-w-[120px]">{serviceName}</span>
                </div>
                
                <button 
                    className="bg-black text-white px-8 py-3.5 rounded-[1.5rem] font-semibold text-sm shadow-lg active:scale-95 transition-transform flex items-center"
                    onClick={handleSchedule}
                >
                    <Calendar size={18} className="mr-2" />
                    Agendar
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ProfessionalProfile;