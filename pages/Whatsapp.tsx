// @sos-edit: false
import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  MoreVertical, 
  MessageSquare, 
  Paperclip, 
  Smile, 
  Send, 
  ChevronLeft, 
  UserPlus, 
  Filter,
  CheckCheck,
  Clock,
  ExternalLink,
  Phone,
  Video,
  Trash2,
  AlertTriangle,
  X,
  Loader2
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import ManagerQuickTicketModal from '../components/modals/ManagerQuickTicketModal';

interface Message {
  id: string;
  text: string;
  sender: 'me' | 'contact';
  timestamp: string;
  dateStr: string;
  status: 'sent' | 'delivered' | 'read' | 'received' | 'sending' | 'error';
  type?: string;
  metadata?: any;
}

interface Chat {
  id: string;
  phone: string;
  name: string;
  avatar: string;
  lastMessage: string;
  time: string;
  unread: number;
  online: boolean;
  messages?: Message[];
}

const MOCK_CHATS: Chat[] = [
  {
    id: '1',
    phone: '5531999990001',
    name: 'João Silva',
    avatar: 'https://i.pravatar.cc/150?u=1',
    lastMessage: 'Olá, gostaria de saber o status do meu pedido.',
    time: '10:45',
    unread: 2,
    online: true,
    messages: [
      { id: '1-1', text: 'Bom dia!', sender: 'contact', timestamp: '10:40', dateStr: '2023-10-10', status: 'read' },
      { id: '1-2', text: 'Bom dia, João! Como posso ajudar?', sender: 'me', timestamp: '10:42', dateStr: '2023-10-10', status: 'read' },
      { id: '1-3', text: 'Olá, gostaria de saber o status do meu pedido.', sender: 'contact', timestamp: '10:45', dateStr: '2023-10-10', status: 'read' },
    ]
  },
  {
    id: '2',
    phone: '5531999990002',
    name: 'Maria Oliveira',
    avatar: 'https://i.pravatar.cc/150?u=2',
    lastMessage: 'Obrigada pelo atendimento!',
    time: '09:30',
    unread: 0,
    online: false,
    messages: [
      { id: '2-1', text: 'Seu serviço foi concluído com sucesso.', sender: 'me', timestamp: '09:25', dateStr: '2023-10-10', status: 'read' },
      { id: '2-2', text: 'Obrigada pelo atendimento!', sender: 'contact', timestamp: '09:30', dateStr: '2023-10-10', status: 'read' },
    ]
  },
  {
    id: '3',
    phone: '5531999990003',
    name: 'Carlos Santos',
    avatar: 'https://i.pravatar.cc/150?u=3',
    lastMessage: 'Pode me enviar o orçamento?',
    time: 'Ontem',
    unread: 0,
    online: false,
    messages: [
      { id: '3-1', text: 'Pode me enviar o orçamento?', sender: 'contact', timestamp: 'Ontem', dateStr: '2023-10-09', status: 'read' },
    ]
  }
];

const Whatsapp: React.FC = () => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isQuickTicketModalOpen, setIsQuickTicketModalOpen] = useState(false);
  const [gestorUuid, setGestorUuid] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedChatRef = useRef<Chat | null>(null);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingChat, setDeletingChat] = useState(false);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  const getDateLabel = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    if (!year || !month || !day) return dateStr;
    const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    
    const today = new Date();
    today.setHours(0,0,0,0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateObj.getTime() === today.getTime()) return 'Hoje';
    if (dateObj.getTime() === yesterday.getTime()) return 'Ontem';
    return dateObj.toLocaleDateString('pt-BR');
  };

  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    fetchInitialData();
    subscribeToChanges();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (selectedChat) {
      fetchMessages(selectedChat.id);
    } else {
      setMessages([]);
    }
  }, [selectedChat]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // Fetch Logged-in Gestor UUID
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setGestorUuid(user.id);

      // Fetch Config
      const { data: configData } = await supabase.from('whatsapp_config').select('*').limit(1).maybeSingle();
      if (configData) setConfig(configData);

      // Fetch Chats
      const { data: chatsData, error } = await supabase
        .from('whatsapp_chats')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const formattedChats: Chat[] = (chatsData || []).map(c => ({
        id: c.id,
        phone: c.phone,
        name: c.name || c.phone,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name || c.phone)}&background=random`,
        lastMessage: c.last_message || '',
        time: c.last_message_time ? new Date(c.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
        unread: selectedChatRef.current?.id === c.id ? 0 : (c.unread_count || 0),
        online: false
      }));

      setChats(formattedChats);
    } catch (error) {
      console.error('Error fetching chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (chatId: string) => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('timestamp', { ascending: true });

      if (error) throw error;

      const formattedMsgs: Message[] = (data || []).map(m => {
        const msgDate = new Date(m.timestamp);
        return {
          id: m.id,
          text: m.content || '',
          sender: m.sender === 'manager' ? 'me' : 'contact',
          timestamp: msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          dateStr: msgDate.toISOString().split('T')[0],
          status: m.status as any,
          type: m.type,
          metadata: m.metadata
        };
      });

      setMessages(prev => {
        const pending = prev.filter(m => m.id.startsWith('temp-') && (m.status === 'sending' || m.status === 'error'));
        const filteredPending = pending.filter(p => !formattedMsgs.some(f => f.text === p.text && f.sender === 'me'));
        return [...formattedMsgs, ...filteredPending];
      });
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const subscribeToChanges = () => {
    console.log("Subscribing to Realtime changes...");
    const channelId = `whatsapp_changes_${Date.now()}`;
    const chatChannel = supabase.channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_chats' }, (payload) => {
        console.log("Realtime CHAT update received:", payload);
        fetchInitialData();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_messages' }, (payload) => {
        console.log("Realtime MESSAGE INSERT received:", payload);
        const activeChat = selectedChatRef.current;
        console.log("Active Chat ID:", activeChat?.id, "Payload Chat ID:", payload.new?.chat_id);
        if (activeChat && payload.new.chat_id === activeChat.id) {
          console.log("Chat matches, fetching messages...");
          fetchMessages(activeChat.id);
        } else {
          console.log("Chat does NOT match or no active chat.");
          fetchInitialData(); // Atualizar a lista de chats para mostrar que tem mensagem nova
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'whatsapp_messages' }, (payload) => {
        console.log("Realtime MESSAGE UPDATE received:", payload);
        const activeChat = selectedChatRef.current;
        if (activeChat && payload.new.chat_id === activeChat.id) {
          fetchMessages(activeChat.id);
        }
      })
      .subscribe((status) => {
        console.log("Realtime Subscription Status:", status);
      });

    return () => {
      supabase.removeChannel(chatChannel);
    };
  };

  const handleSendMessage = async (e?: React.FormEvent, messageToRetry?: Message) => {
    if (e) e.preventDefault();
    
    const messageText = messageToRetry ? messageToRetry.text : newMessage;
    if (!messageText.trim() || !selectedChat || !config) return;

    if (!messageToRetry) {
      setNewMessage('');
    }

    const tempId = messageToRetry ? messageToRetry.id : `temp-${Date.now()}`;
    const now = new Date();
    const tempMsg: Message = {
      id: tempId,
      text: messageText,
      sender: 'me',
      timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      dateStr: now.toISOString().split('T')[0],
      status: 'sending'
    };

    setMessages(prev => {
      const exists = prev.some(m => m.id === tempId);
      if (exists) {
        return prev.map(m => m.id === tempId ? tempMsg : m);
      }
      return [...prev, tempMsg];
    });

    const markAsError = () => {
      setMessages(prev => 
        prev.map(m => m.id === tempId ? { ...m, status: 'error' } : m)
      );
    };

    if (!navigator.onLine) {
      markAsError();
      return;
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (config.client_token) {
        headers['client-token'] = config.client_token;
      }

      const response = await fetch(`https://api.z-api.io/instances/${config.instance_id}/token/${config.token}/send-text`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          phone: selectedChat.phone,
          message: messageText
        })
      });

      if (!response.ok) {
        throw new Error(`Z-API returned status ${response.status}`);
      }

      const zapiData = await response.json();

      const { error } = await supabase
        .from('whatsapp_messages')
        .insert({
          chat_id: selectedChat.id,
          message_id: zapiData.messageId,
          content: messageText,
          type: 'text',
          sender: 'manager',
          status: 'sent',
          metadata: zapiData
        });

      if (error) throw error;
      
      await supabase
        .from('whatsapp_chats')
        .update({
          last_message: messageText,
          last_message_time: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedChat.id);

      // Sempre buscar as mensagens diretamente após enviar,
      // para garantir que a UI atualize mesmo se o Realtime falhar ou atrasar.
      fetchMessages(selectedChat.id);

      // Atualiza a lista de chats para refletir a última mensagem e hora
      fetchInitialData();

      setMessages(prev => prev.filter(m => m.id !== tempId));

    } catch (error) {
      console.error('Error sending message:', error);
      markAsError();
    }
  };

  const openTicket = () => {
    if (!selectedChat) return;
    setIsQuickTicketModalOpen(true);
  };

  const handleDeleteChat = async () => {
    if (!selectedChat) return;
    setDeletingChat(true);
    try {
      // 1. Apagar todas as mensagens do chat
      const { error: msgError } = await supabase
        .from('whatsapp_messages')
        .delete()
        .eq('chat_id', selectedChat.id);

      if (msgError) throw msgError;

      // 2. Apagar o chat
      const { error: chatError } = await supabase
        .from('whatsapp_chats')
        .delete()
        .eq('id', selectedChat.id);

      if (chatError) throw chatError;

      // 3. Atualizar a UI localmente
      setChats(prev => prev.filter(c => c.id !== selectedChat.id));
      setSelectedChat(null);
      setMessages([]);
      setIsMobileChatOpen(false);
      setShowDeleteConfirm(false);
      setShowChatMenu(false);
    } catch (error) {
      console.error('Erro ao apagar conversa:', error);
      alert('Erro ao apagar a conversa. Tente novamente.');
    } finally {
      setDeletingChat(false);
    }
  };

  const handleSelectChat = async (chat: Chat) => {
    setSelectedChat(chat);
    setIsMobileChatOpen(true);

    if (chat.unread > 0) {
      setChats(prev => prev.map(c => c.id === chat.id ? { ...c, unread: 0 } : c));
      try {
        await supabase
          .from('whatsapp_chats')
          .update({ unread_count: 0 })
          .eq('id', chat.id);
      } catch (error) {
        console.error('Erro ao resetar mensagens não lidas:', error);
      }
    }
  };

  const filteredChats = chats.filter(chat => 
    chat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 min-h-0 flex h-full bg-[#F0F2F5] overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
      {/* Sidebar - Chat List */}
      <div className={`
        ${isMobileChatOpen ? 'hidden' : 'flex'} 
        md:flex flex-col w-full md:w-[350px] lg:w-[400px] shrink-0 border-r border-gray-200 bg-white h-full min-h-0 overflow-hidden
      `}>
        {/* Search */}
        <div className="p-2 bg-white shrink-0">
          <div className="relative flex items-center bg-[#F0F2F5] rounded-xl px-4 py-2 transition-all focus-within:bg-white focus-within:shadow-md border border-transparent focus-within:border-gray-200">
            <Search size={18} className="text-gray-400 mr-3" />
            <input 
              type="text" 
              placeholder="Pesquisar ou começar uma nova conversa"
              className="bg-transparent border-none outline-none text-sm w-full"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
          {filteredChats.map(chat => (
            <div 
              key={chat.id}
              onClick={() => handleSelectChat(chat)}
              className={`
                flex items-center p-3 cursor-pointer border-b border-gray-50 transition-colors
                ${selectedChat?.id === chat.id ? 'bg-[#F0F2F5]' : 'hover:bg-gray-50'}
              `}
            >
              <div className="relative shrink-0">
                <img src={chat.avatar} alt={chat.name} className="w-12 h-12 rounded-full object-cover shadow-sm" />
                {chat.online && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>}
              </div>
              <div className="ml-4 flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 truncate">{chat.name}</h3>
                  <span className="text-xs text-gray-400">{chat.time}</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-sm text-gray-500 truncate pr-2">{chat.lastMessage}</p>
                  {chat.unread > 0 && (
                    <span className="bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                      {chat.unread}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={`
        ${isMobileChatOpen ? 'flex' : 'hidden'} 
        md:flex flex-col flex-1 min-w-0 bg-[#E5DDD5] relative h-full min-h-0 overflow-hidden
      `}>
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="p-3 bg-[#F0F2F5] flex items-center justify-between border-b border-gray-200 z-10 shrink-0">
              <div className="flex items-center">
                <button 
                  onClick={() => setIsMobileChatOpen(false)}
                  className="md:hidden mr-3 text-gray-500 hover:text-ios-blue"
                >
                  <ChevronLeft size={24} />
                </button>
                <img src={selectedChat.avatar} alt={selectedChat.name} className="w-10 h-10 rounded-full object-cover shadow-sm" />
                <div className="ml-3">
                  <h3 className="font-semibold text-gray-900 leading-tight">{selectedChat.name}</h3>
                  <p className="text-xs text-gray-500">{selectedChat.online ? 'Online' : 'Visto por último recentemente'}</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <button 
                  onClick={openTicket}
                  className="hidden sm:flex items-center space-x-2 bg-ios-blue text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors shadow-sm"
                >
                  <UserPlus size={16} />
                  <span>Abrir Chamado</span>
                </button>
                <div className="flex items-center space-x-4 text-gray-500">
                  <button className="hover:text-ios-blue transition-colors sm:hidden"><UserPlus size={20} /></button>
                  <button className="hover:text-ios-blue transition-colors"><Search size={20} /></button>
                  {/* Menu de opções (3 pontos) */}
                  <div className="relative">
                    <button 
                      onClick={() => setShowChatMenu(prev => !prev)}
                      className="hover:text-ios-blue transition-colors"
                    >
                      <MoreVertical size={20} />
                    </button>
                    {showChatMenu && (
                      <>
                        {/* Overlay para fechar o menu ao clicar fora */}
                        <div 
                          className="fixed inset-0 z-10" 
                          onClick={() => setShowChatMenu(false)} 
                        />
                        <div className="absolute right-0 top-8 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-20 min-w-[180px] overflow-hidden">
                          <button
                            onClick={() => { setShowDeleteConfirm(true); setShowChatMenu(false); }}
                            className="w-full flex items-center space-x-3 px-4 py-3 text-sm text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={16} />
                            <span>Apagar conversa</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Offline Alert Banner */}
            {!isOnline && (
              <div className="bg-red-500 text-white text-xs px-4 py-2 flex items-center justify-center space-x-2 z-10 shadow-md shrink-0">
                <AlertTriangle size={14} className="animate-bounce" />
                <span className="font-medium">Você está offline. As mensagens que falharem podem ser reenviadas clicando no ícone de aviso.</span>
              </div>
            )}

            {/* Messages Background (Doodle Pattern) */}
            <div 
              className="absolute inset-0 opacity-[0.06] pointer-events-none"
              style={{ backgroundImage: 'url("https://wweb.dev/assets/whatsapp-chat-wallpaper.png")' }}
            ></div>

            {/* Messages Container */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2 relative custom-scrollbar">
              {messages.map((msg, index) => {
                const showDateSeparator = index === 0 || msg.dateStr !== messages[index - 1].dateStr;
                
                const getMediaInfo = (m: Message) => {
                  const meta = m.metadata || {};
                  const img = meta.image?.imageUrl || meta.imageUrl || (typeof meta.image === 'string' && meta.image.startsWith('http') ? meta.image : (m.type === 'image' && m.text?.startsWith('http') ? m.text : null));
                  const audio = meta.audio?.audioUrl || meta.audioUrl || (typeof meta.audio === 'string' && meta.audio.startsWith('http') ? meta.audio : (m.type === 'audio' && m.text?.startsWith('http') ? m.text : null));
                  const video = meta.video?.videoUrl || meta.videoUrl || (typeof meta.video === 'string' && meta.video.startsWith('http') ? meta.video : (m.type === 'video' && m.text?.startsWith('http') ? m.text : null));
                  const doc = meta.document?.documentUrl || meta.documentUrl || (typeof meta.document === 'string' && meta.document.startsWith('http') ? meta.document : (m.type === 'document' && m.text?.startsWith('http') ? m.text : null));
                  const docName = meta.document?.fileName || meta.fileName || 'Documento';

                  return { img, audio, video, doc, docName };
                };

                const media = getMediaInfo(msg);

                const renderMessageText = (m: Message) => {
                  if (!m.text) return null;
                  let text = m.text;
                  
                  if (media.img) text = text.replace(/^\[Imagem\]\s*/, '');
                  if (media.audio) text = text.replace(/^\[Áudio\]\s*/, '');
                  if (media.video) text = text.replace(/^\[Vídeo\]\s*/, '');
                  if (media.doc) text = text.replace(/^\[Documento\]\s*/, '');

                  if (!text.trim()) return null;

                  return <p className="text-sm text-gray-800 break-words leading-relaxed whitespace-pre-wrap">{text}</p>;
                };

                return (
                  <React.Fragment key={msg.id}>
                    {showDateSeparator && (
                      <div className="flex justify-center my-4">
                        <span className="bg-white/80 backdrop-blur-sm text-gray-500 text-[11px] px-3 py-1 rounded-lg shadow-sm font-medium uppercase tracking-wider">
                          {getDateLabel(msg.dateStr)}
                        </span>
                      </div>
                    )}
                    <div className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`
                        max-w-[75%] px-3 py-2 rounded-xl shadow-sm relative group
                        ${msg.sender === 'me' ? 'bg-[#DCF8C6] rounded-tr-none' : 'bg-white rounded-tl-none'}
                      `}>
                        {media.img && (
                          <div className="mb-2">
                            <img 
                              src={media.img} 
                              alt="Imagem" 
                              className="rounded-lg max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity" 
                              style={{ maxHeight: '250px', minWidth: '150px' }} 
                              onClick={() => setExpandedImage(media.img!)}
                            />
                          </div>
                        )}
                        {media.audio && (
                          <div className="mb-2">
                            <audio controls className="max-w-[220px] sm:max-w-[300px]">
                              <source src={media.audio} />
                              Seu navegador não suporta o elemento de áudio.
                            </audio>
                          </div>
                        )}
                        {media.video && (
                          <div className="mb-2">
                            <video controls className="rounded-lg max-w-full h-auto" style={{ maxHeight: '250px' }}>
                              <source src={media.video} />
                              Seu navegador não suporta o elemento de vídeo.
                            </video>
                          </div>
                        )}
                        {media.doc && (
                          <div className="mb-2">
                            <a href={media.doc} target="_blank" rel="noopener noreferrer" className="flex items-center space-x-2 text-ios-blue hover:underline bg-black/5 p-2 rounded-lg">
                              <Paperclip size={16} />
                              <span className="text-sm truncate max-w-[200px]">{media.docName}</span>
                            </a>
                          </div>
                        )}
                        {renderMessageText(msg)}
                        <div className="flex items-center justify-end space-x-1 mt-1">
                          <span className="text-[10px] text-gray-400">{msg.timestamp}</span>
                          {msg.sender === 'me' && (
                            msg.status === 'read' ? <CheckCheck size={14} className="text-ios-blue" /> : 
                            msg.status === 'delivered' ? <CheckCheck size={14} className="text-gray-400" /> : 
                            msg.status === 'sending' ? <Loader2 size={14} className="text-gray-400 animate-spin" /> :
                            msg.status === 'error' ? (
                              <button 
                                onClick={() => handleSendMessage(undefined, msg)}
                                className="text-red-500 hover:text-red-700 transition-colors flex items-center justify-center p-0.5 rounded-full hover:bg-red-50"
                                title="Erro ao enviar. Clique para tentar novamente."
                              >
                                <AlertTriangle size={14} />
                              </button>
                            ) :
                            <CheckCheck size={14} className="opacity-50" />
                          )}
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input Area */}
            <div className="p-3 bg-[#F0F2F5] flex items-center space-x-3 z-10 shrink-0">
              <button className="text-gray-500 hover:text-ios-blue transition-colors"><Smile size={24} /></button>
              <button className="text-gray-500 hover:text-ios-blue transition-colors"><Paperclip size={24} /></button>
              <form onSubmit={handleSendMessage} className="flex-1">
                <input 
                  type="text" 
                  placeholder="Mensagem"
                  className="w-full bg-white rounded-xl px-4 py-2 text-sm outline-none shadow-sm focus:ring-1 focus:ring-ios-blue/30 transition-all"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                />
              </form>
              <button 
                onClick={(e) => handleSendMessage(e)}
                disabled={!newMessage.trim()}
                className={`
                  p-2 rounded-full transition-all
                  ${newMessage.trim() ? 'bg-ios-blue text-white shadow-md' : 'text-gray-400'}
                `}
              >
                <Send size={20} />
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-xl mb-6 text-ios-blue">
              <MessageSquare size={48} />
            </div>
            <h2 className="text-2xl font-bold text-gray-700 mb-2">UAI Fix Whatsapp</h2>
            <p className="text-gray-500 max-w-md">
              Selecione uma conversa para começar a atender seus clientes e abrir novos chamados.
            </p>
            <div className="mt-8 flex items-center space-x-2 text-xs text-gray-400">
              <Clock size={12} />
              <span>Conectado via Z-API</span>
            </div>
          </div>
        )}
      </div>

      {selectedChat && (
        <ManagerQuickTicketModal
          isOpen={isQuickTicketModalOpen}
          onClose={() => setIsQuickTicketModalOpen(false)}
          selectedChat={{
            id: selectedChat.id,
            name: selectedChat.name,
            phone: selectedChat.phone
          }}
          gestorUuid={gestorUuid}
          onSuccess={() => {
            // success feedback
          }}
          chatMessages={messages}
        />
      )}

      {/* Modal de Confirmação de Exclusão */}
      {showDeleteConfirm && selectedChat && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200">
            <div className="flex justify-end mb-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <Trash2 size={28} className="text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Apagar conversa?</h3>
              <p className="text-sm text-gray-500 mb-1">
                Você está prestes a apagar a conversa com
              </p>
              <p className="text-sm font-bold text-gray-800 mb-4">{selectedChat.name}</p>
              <div className="flex items-start space-x-2 bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-6 text-left">
                <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  Todas as mensagens desta conversa serão permanentemente removidas do banco de dados. Esta ação <strong>não pode ser desfeita</strong>.
                </p>
              </div>
              <div className="flex space-x-3 w-full">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deletingChat}
                  className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteChat}
                  disabled={deletingChat}
                  className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-semibold text-sm hover:bg-red-600 transition-colors shadow-lg shadow-red-200 disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  {deletingChat ? (
                    <span>Apagando...</span>
                  ) : (
                    <>
                      <Trash2 size={15} />
                      <span>Apagar</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Expanded Modal */}
      {expandedImage && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setExpandedImage(null)}
        >
          <div className="relative max-w-4xl w-full h-full flex items-center justify-center">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setExpandedImage(null);
              }}
              className="absolute top-4 right-4 text-white bg-black/50 hover:bg-black/80 rounded-full p-2 transition-colors z-10"
              title="Fechar (Esc)"
            >
              <X size={24} />
            </button>
            <img 
              src={expandedImage} 
              alt="Imagem ampliada" 
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Whatsapp;
