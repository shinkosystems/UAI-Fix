
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { User } from '../types';
import { ChevronLeft, Star, MapPin, BadgeCheck, Calendar, AlertCircle } from 'lucide-react';

interface ReviewData {
  profissional: string; // uuid
  nota: number;
}

const ProfessionalList: React.FC = () => {
  const { serviceId } = useParams<{ serviceId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const serviceName = location.state?.serviceName || 'Profissionais';

  const [professionals, setProfessionals] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [userCityId, setUserCityId] = useState<number | null>(null);
  const [userCityName, setUserCityName] = useState<string>('');
  const [currentUserType, setCurrentUserType] = useState<string>('');

  useEffect(() => {
    const fetchProfessionals = async () => {
      if (!serviceId) return;

      try {
        setLoading(true);

        // 1. Obter o usuário atual para descobrir sua cidade (ID) e TIPO
        const { data: { user: authUser } } = await supabase.auth.getUser();
        let currentUuid = authUser?.id;

        // Fallback para demo se não estiver logado
        if (!currentUuid) {
            const { data: demoUsers } = await supabase.from('users').select('*').eq('ativo', true).limit(1);
            if (demoUsers && demoUsers.length > 0) currentUuid = demoUsers[0].uuid;
        }

        if (currentUuid) {
            // Buscar dados do usuário atual (ID da cidade e Tipo)
            const { data: currentUserData, error: userError } = await supabase
                .from('users')
                .select('cidade, tipo')
                .eq('uuid', currentUuid)
                .single();
            
            if (userError) {
                console.error('Erro ao buscar perfil do usuário:', userError);
            } else if (currentUserData) {
                if (currentUserData.cidade) setUserCityId(currentUserData.cidade);
                if (currentUserData.tipo) setCurrentUserType(currentUserData.tipo);
                
                // Buscar nome da cidade apenas para exibir na UI
                if (currentUserData.cidade) {
                    const { data: cityData } = await supabase.from('cidades').select('cidade').eq('id', currentUserData.cidade).single();
                    if (cityData) setUserCityName(cityData.cidade);
                }

                // 2. Buscar Profissionais FILTRANDO por ID da cidade e ID da atividade
                // A coluna 'atividade' é int8[]. Convertemos o serviceId para number.
                
                const targetServiceId = parseInt(serviceId, 10);

                const { data: users, error: usersError } = await supabase
                  .from('users')
                  .select('*')
                  .ilike('tipo', 'profissional') // Case insensitive fix ("Profissional" vs "profissional")
                  .eq('ativo', true) // Only active users
                  .eq('cidade', currentUserData.cidade) // Filtra pelo ID da cidade
                  .contains('atividade', [targetServiceId]); // Filtra array [id]

                if (usersError) throw usersError;

                if (!users || users.length === 0) {
                  setProfessionals([]);
                  setLoading(false);
                  return;
                }

                // 3. Fetch Ratings for these professionals
                const uuids = users.map(u => u.uuid);
                const { data: reviews, error: reviewsError } = await supabase
                  .from('avaliacoes')
                  .select('profissional, nota')
                  .in('profissional', uuids);
                
                if (reviewsError) console.error('Error fetching reviews:', reviewsError);

                // 4. Calculate average ratings
                const enhancedUsers = users.map(user => {
                  const userReviews = (reviews as ReviewData[])?.filter(r => r.profissional === user.uuid) || [];
                  const totalStars = userReviews.reduce((acc, curr) => acc + curr.nota, 0);
                  const avgRating = userReviews.length > 0 ? totalStars / userReviews.length : 0;
                  
                  return {
                    ...user,
                    rating: parseFloat(avgRating.toFixed(1)),
                    reviewCount: userReviews.length
                  };
                });

                // Sort by rating (highest first)
                enhancedUsers.sort((a, b) => (b.rating || 0) - (a.rating || 0));

                setProfessionals(enhancedUsers);
            } else {
                // Usuário sem cidade definida
                console.warn('Usuário sem cidade definida no perfil.');
                setProfessionals([]); 
            }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfessionals();
  }, [serviceId]);

  const handleProfileClick = (pro: User) => {
    navigate(`/professional/${pro.uuid}`, { 
      state: { 
        serviceId: serviceId, 
        serviceName: serviceName 
      } 
    });
  };

  const handleScheduleClick = (pro: User) => {
    // Atalho direto para o agendamento
    navigate(`/planning/${pro.uuid}`, { 
      state: { 
        serviceId: serviceId, 
        serviceName: serviceName 
      } 
    });
  };

  // Normalização para verificação de permissão
  const normType = currentUserType.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const canSchedule = normType === 'gestor' || normType === 'consumidor';

  return (
    <div className="min-h-screen bg-ios-bg">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md px-5 pt-12 pb-4 sticky top-0 z-20 border-b border-gray-200 flex items-center">
        <button 
          onClick={() => navigate(-1)} 
          className="mr-3 p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft size={24} className="text-ios-blue" />
        </button>
        <div className="flex-1 overflow-hidden">
            <h1 className="text-xl font-bold text-gray-900 truncate">{serviceName}</h1>
            <p className="text-xs text-gray-500 truncate">
                {userCityName ? `Profissionais em ${userCityName}` : 'Selecione um profissional'}
            </p>
        </div>
      </div>

      <div className="p-5 pb-24 space-y-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
             <div key={i} className="bg-white p-5 rounded-3xl shadow-sm h-32 animate-pulse">
                <div className="flex space-x-4">
                    <div className="w-16 h-16 bg-gray-200 rounded-full"></div>
                    <div className="flex-1 space-y-2 py-2">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                </div>
             </div>
          ))
        ) : (
          <>
            {/* Warning if no City set */}
            {!userCityId && !loading && (
                 <div className="bg-yellow-50 border border-yellow-100 rounded-2xl p-4 flex items-start mb-4">
                    <AlertCircle className="text-yellow-600 mr-2 flex-shrink-0" size={20} />
                    <div>
                        <h4 className="font-bold text-yellow-800 text-sm">Localização não definida</h4>
                        <p className="text-xs text-yellow-700 mt-1">
                            Precisamos saber sua cidade para mostrar profissionais próximos.
                        </p>
                        <button 
                            onClick={() => navigate('/profile')}
                            className="mt-2 text-xs font-bold text-white bg-yellow-600 px-3 py-1.5 rounded-lg"
                        >
                            Definir Cidade
                        </button>
                    </div>
                 </div>
            )}

            {professionals.map((pro) => (
              <div 
                key={pro.id}
                className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden transition-transform active:scale-[0.98]"
              >
                <div className="flex items-start space-x-4">
                  {/* Avatar */}
                  <div className="relative">
                    <img 
                      src={pro.fotoperfil || `https://ui-avatars.com/api/?name=${pro.nome}&background=random`} 
                      alt={pro.nome} 
                      className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-md"
                    />
                    <div className="absolute -bottom-1 -right-1 bg-green-500 text-white p-0.5 rounded-full border-2 border-white">
                        <BadgeCheck size={12} fill="currentColor" className="text-white" />
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                        <h3 className="text-lg font-bold text-gray-900 truncate pr-2">{pro.nome}</h3>
                        {/* Rating Badge */}
                        <div className="flex items-center bg-yellow-50 px-2 py-1 rounded-lg">
                            <Star size={12} className="text-yellow-500 fill-current mr-1" />
                            <span className="text-xs font-bold text-yellow-700">
                                {pro.rating && pro.rating > 0 ? pro.rating : 'Novo'}
                            </span>
                            {pro.reviewCount !== undefined && pro.reviewCount > 0 && (
                                <span className="text-[10px] text-yellow-600 ml-1">({pro.reviewCount})</span>
                            )}
                        </div>
                    </div>
                    
                    {pro.bairro && (
                        <div className="flex items-center text-gray-500 mt-1 mb-2">
                            <MapPin size={12} className="mr-1" />
                            <span className="text-xs font-medium truncate">{pro.bairro}</span>
                        </div>
                    )}
                    
                    <p className="text-xs text-gray-400 line-clamp-2">
                        Especialista em {serviceName.toLowerCase()}. Profissional verificado.
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-5 pt-4 border-t border-gray-50 flex space-x-3">
                    <button 
                        className="flex-1 bg-ios-bg text-gray-900 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors"
                        onClick={() => handleProfileClick(pro)}
                    >
                        Ver Perfil
                    </button>
                    
                    {/* Botão de Agendar apenas para Consumidores e Gestores */}
                    {canSchedule && (
                        <button 
                            className="flex-1 bg-black text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors flex items-center justify-center"
                            onClick={() => handleScheduleClick(pro)}
                        >
                            <Calendar size={14} className="mr-2" />
                            Agendar
                        </button>
                    )}
                </div>
              </div>
            ))}

            {professionals.length === 0 && userCityId && (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <MapPin size={32} className="text-gray-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Nenhum profissional na região</h3>
                <p className="text-sm text-gray-500 mt-2 max-w-xs mx-auto">
                    Não encontramos profissionais para <strong>{serviceName}</strong> em <strong>{userCityName}</strong>.
                </p>
                <button 
                    onClick={() => navigate('/search')}
                    className="mt-6 text-ios-blue text-sm font-semibold hover:underline"
                >
                    Buscar outros serviços
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ProfessionalList;
