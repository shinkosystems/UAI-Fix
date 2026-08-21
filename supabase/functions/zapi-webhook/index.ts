// @sos-edit: false
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Mapeamento de palavras-chave para categorias de serviço (Classificador Semântico com Word Boundaries)
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'hidráulica': ['vazamento', 'pia', 'cano', 'torneira', 'descarga', 'vaso sanitário', 'vaso sanitario', 'encanador', 'encanamento', 'registro', 'esgoto', 'ralo', 'sifao', 'sifão', 'infiltracao', 'infiltração', 'caixa d\'agua', 'caixa d água', 'caixa dagua', 'hidraulico', 'hidráulica', 'bomba'],
  'elétrica': ['chuveiro', 'tomada', 'disjuntor', 'curto', 'curto circuito', 'fiacao', 'fiação', 'eletricista', 'lampada', 'lâmpada', 'quadro eletrico', 'quadro elétrico', '110v', '220v', 'interruptor', 'eletrica', 'elétrica'],
  'pintura': ['pintar', 'pintura', 'pintor', 'parede', 'massa corrida', 'textura', 'verniz', 'trinca', 'rachadura', 'fachada'],
  'climatização': ['ar condicionado', 'ar-condicionado', 'split', 'carga de gas', 'refrigeracao', 'refrigeração', 'inverter', 'limpeza de ar condicionado'],
  'marcenaria': ['movel', 'móvel', 'armario', 'armário', 'guarda-roupa', 'guarda roupa', 'montagem de moveis', 'montar movel', 'desmontar movel', 'marceneiro', 'dobradica', 'dobradiça'],
  'alvenaria': ['pedreiro', 'alvenaria', 'piso', 'azulejo', 'porcelanato', 'gesso', 'drywall', 'calha', 'telhado', 'reboco', 'cimento']
};

function isGenericIntent(text: string): boolean {
  const clean = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  if (clean === '1') return true;
  const genericTerms = [
    'servico', 'servicos', 'agendar', 'agendamento', 'solicitar', 'atendimento',
    'ola', 'oi', 'bom dia', 'boa tarde', 'boa noite', 'ajuda', 'orcamento', 'chamado'
  ];
  return genericTerms.some(term => clean === term || clean.includes(`agendar`) || clean.includes(`solicitar`) || clean === `quero agendar um servico` || clean === `quero agendar`);
}

function classifyCategoryFromText(text: string, categories: any[]): any | null {
  const clean = text.trim();
  if (!clean || clean.length < 4) return null;

  const lower = clean.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  // 1. Verificar correspondência por palavras-chave com limite de palavra (\b)
  for (const [key, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      const kwNorm = kw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const regex = new RegExp(`\\b${kwNorm}\\b`, 'i');
      if (regex.test(lower)) {
        const keyNorm = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const matched = categories.find(c => 
          c.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(keyNorm)
        );
        if (matched) return matched;
      }
    }
  }

  // 2. Verificar match exato no nome completo das categorias
  for (const cat of categories) {
    const catNorm = cat.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const regex = new RegExp(`\\b${catNorm}\\b`, 'i');
    if (regex.test(lower)) {
      return cat;
    }
  }

  return null;
}

function formatCpf(val: string): string {
  const clean = val.replace(/\D/g, '');
  if (clean.length !== 11) return clean;
  return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function parseServiceDate(text: string): { dataStr: string; estimatedIso: string } {
  const clean = text.trim();
  const lower = clean.toLowerCase();
  const now = new Date();
  
  if (lower === '1' || lower.includes('hoje')) {
    const dStr = now.toLocaleDateString('pt-BR');
    return { dataStr: `Hoje (${dStr})`, estimatedIso: now.toISOString() };
  }
  
  if (lower === '2' || lower.includes('amanhã') || lower.includes('amanha')) {
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const dStr = tomorrow.toLocaleDateString('pt-BR');
    return { dataStr: `Amanhã (${dStr})`, estimatedIso: tomorrow.toISOString() };
  }
  
  if (lower === '3' || lower.includes('nesta semana') || lower.includes('esta semana') || lower.includes('essa semana')) {
    return { dataStr: 'Nesta semana', estimatedIso: now.toISOString() };
  }

  // Tentar capturar datas no formato DD/MM ou DD/MM/AAAA
  const dateMatch = clean.match(/(\d{1,2})[\/\-\.](\d{1,2})(?:[\/\-\.](\d{2,4}))?/);
  if (dateMatch) {
    const day = parseInt(dateMatch[1], 10);
    const month = parseInt(dateMatch[2], 10) - 1;
    let year = dateMatch[3] ? parseInt(dateMatch[3], 10) : now.getFullYear();
    if (year < 100) year += 2000;
    
    const parsedDate = new Date(year, month, day, 9, 0, 0);
    if (!isNaN(parsedDate.getTime())) {
      const dStr = `${String(day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`;
      return { dataStr: dStr, estimatedIso: parsedDate.toISOString() };
    }
  }

async function fetchViaCep(cep: string): Promise<any | null> {
  const clean = cep.replace(/\D/g, '');
  if (clean.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.erro) return null;
    return data;
  } catch (err) {
    console.error("Erro no fetchViaCep:", err);
    return null;
  }
}

async function lookupCepFromAddressEdge(cityName: string, ufCode: string = 'MG', streetName?: string): Promise<string | null> {
  if (!cityName || !streetName) return null;
  try {
    const cleanStreet = streetName
      .replace(/^(rua|avenida|av\.?|travessa|alameda|rodovia|estrada|praca|praça|alameda|beco)\s+/i, '')
      .trim();

    if (cleanStreet.length < 3) return null;

    const cleanUf = ufCode ? ufCode.trim().toUpperCase() : 'MG';
    const url = `https://viacep.com.br/ws/${encodeURIComponent(cleanUf)}/${encodeURIComponent(cityName.trim())}/${encodeURIComponent(cleanStreet)}/json/`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0 && data[0].cep) {
      return data[0].cep;
    }
  } catch (err) {
    console.error("Erro na busca reversa de CEP no webhook:", err);
  }
  return null;
}

async function getOrProvisionCityInEdge(
  supabase: any,
  cityName: string,
  ufCode?: string
): Promise<{ id: number; cidade: string; uf: number } | null> {
  if (!cityName || !cityName.trim()) return null;
  const rawCity = cityName.trim();
  const normalizedCity = rawCity.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  try {
    let estadoId: number | null = null;
    const cleanUf = ufCode ? ufCode.trim().toUpperCase() : '';

    if (cleanUf) {
      const { data: estadoData } = await supabase
        .from('estados')
        .select('id')
        .ilike('uf', cleanUf)
        .maybeSingle();

      if (estadoData) {
        estadoId = estadoData.id;
      } else {
        const { data: newEstado } = await supabase
          .from('estados')
          .insert({ uf: cleanUf })
          .select('id')
          .single();
        if (newEstado) estadoId = newEstado.id;
      }
    }

    // 1. Busca exata ou ilike na tabela cidades
    let query = supabase.from('cidades').select('*');
    if (estadoId) query = query.eq('uf', estadoId);

    const { data: existingCities } = await query.ilike('cidade', `%${rawCity}%`).limit(10);
    if (existingCities && existingCities.length > 0) {
      const match = existingCities.find((c: any) =>
        c.cidade.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === normalizedCity
      );
      if (match) return match;
      return existingCities[0];
    }

    // 2. Se não encontrou, busca estado padrão (MG ou id 1)
    if (!estadoId) {
      const { data: defaultEstado } = await supabase
        .from('estados')
        .select('id')
        .ilike('uf', 'MG')
        .maybeSingle();
      estadoId = defaultEstado?.id || 1;
    }

    // Formata o nome da cidade em Title Case se for digitada toda minúscula
    const formattedCityName = rawCity
      .split(' ')
      .map(w => w.length > 2 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase())
      .join(' ');

    const { data: inserted, error: insErr } = await supabase
      .from('cidades')
      .insert({
        cidade: formattedCityName,
        uf: estadoId
      })
      .select('*')
      .single();

    if (insErr) {
      console.error("Erro ao provisionar cidade:", insErr);
      return null;
    }

    return inserted;
  } catch (err) {
    console.error("Erro em getOrProvisionCityInEdge:", err);
    return null;
  }
}

function parseFullAddress(text: string, cities: any[]): {
  rua: string;
  numero: string;
  bairro: string;
  cidade_id: number | null;
  cidade_nome: string;
  isFullAddress: boolean;
} {
  const clean = text.trim();
  const lower = clean.toLowerCase();
  
  let matchedCity: any = null;
  
  // Procura cidade no texto ordenando por tamanho decrescente de nome
  const sortedCities = [...cities].sort((a, b) => (b.cidade?.length || 0) - (a.cidade?.length || 0));
  for (const c of sortedCities) {
    const cName = c.cidade.toLowerCase();
    if (lower.includes(cName)) {
      matchedCity = c;
      break;
    }
  }

  // Fallbacks comuns para cidades conhecidas
  if (!matchedCity) {
    if (lower.includes('lafaiete')) {
      matchedCity = cities.find(c => c.cidade.toLowerCase().includes('conselheiro lafaiete')) || null;
    } else if (lower.includes('ouro branco')) {
      matchedCity = cities.find(c => c.cidade.toLowerCase().includes('ouro branco')) || null;
    } else if (lower.includes('congonhas')) {
      matchedCity = cities.find(c => c.cidade.toLowerCase().includes('congonhas')) || null;
    } else if (lower.includes('pouso alegre')) {
      matchedCity = cities.find(c => c.cidade.toLowerCase().includes('pouso alegre')) || null;
    }
  }

  // Separa por vírgula ou hífen
  const parts = clean.split(/[,-]/).map(p => p.trim()).filter(Boolean);
  
  let rua = clean;
  let numero = '';
  let bairro = '';

  if (parts.length >= 2) {
    rua = parts[0];
    for (let i = 1; i < parts.length; i++) {
      const p = parts[i];
      const pLower = p.toLowerCase();
      const numMatch = p.match(/\b\d+\b/);

      if (numMatch && !numero && p.length < 10) {
        numero = numMatch[0];
      } else if (!bairro && matchedCity && !pLower.includes(matchedCity.cidade.toLowerCase()) && !['mg', 'sp', 'rj', 'brasil', 'minas gerais'].includes(pLower)) {
        bairro = p;
      } else if (!bairro && !matchedCity && p.length > 2 && !['mg', 'sp', 'rj'].includes(pLower)) {
        bairro = p;
      }
    }
  }

  const isFull = !!(numero || bairro || (matchedCity && parts.length >= 2));

  return {
    rua,
    numero,
    bairro,
    cidade_id: matchedCity?.id || null,
    cidade_nome: matchedCity?.cidade || '',
    isFullAddress: isFull
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json()
    console.log("Recebido da Z-API:", JSON.stringify(body))

    // Helper para enviar mensagens via Z-API
    const sendZApiMessage = async (phone: string, text: string) => {
      try {
        const { data: config } = await supabase
          .from('whatsapp_config')
          .select('instance_id, token, client_token')
          .limit(1)
          .maybeSingle();

        const instanceId = config?.instance_id || '3F35D1FCB74EC226D64CF6B0730C054E';
        const token = config?.token || '8F7D4AA58AC96A11B75178F4';
        const clientToken = config?.client_token || 'F7e9c17967b0f4968bcd39c8fb49e20d2S';

        if (instanceId && token) {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (clientToken) headers['client-token'] = clientToken;
          
          let cleanPhone = phone.replace(/\D/g, '');
          if (cleanPhone.length === 10 || cleanPhone.length === 11) {
            cleanPhone = `55${cleanPhone}`;
          }

          const response = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ phone: cleanPhone, message: text })
          });

          if (response.ok) {
            const zapiData = await response.json();
            const messageId = zapiData.messageId || `msg_${Date.now()}`;

            let contactName = `WhatsApp (${cleanPhone})`;
            const { data: foundUser } = await supabase
              .from('users')
              .select('nome')
              .ilike('whatsapp', `%${cleanPhone.slice(-8)}%`)
              .limit(1)
              .maybeSingle();

            if (foundUser?.nome) {
              contactName = foundUser.nome;
            }

            const { data: chat } = await supabase
              .from('whatsapp_chats')
              .upsert({
                phone: cleanPhone,
                name: contactName,
                last_message: text,
                last_message_time: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }, { onConflict: 'phone' })
              .select()
              .single();

            if (chat) {
              await supabase.from('whatsapp_messages').insert({
                chat_id: chat.id,
                message_id: messageId,
                content: text,
                type: 'text',
                sender: 'manager',
                status: 'sent',
                metadata: zapiData
              });

              await supabase
                .from('whatsapp_chats')
                .update({
                  last_message: text,
                  last_message_time: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                })
                .eq('id', chat.id);
            }
          } else {
            console.error("Erro no envio Z-API:", await response.text());
          }
        }
      } catch (err) {
        console.error("Erro ao enviar msg Z-API:", err);
      }
    };

    // Helper para notificar gestor no WhatsApp
    const notifyManager = async (msg: string) => {
      try {
        const { data: config } = await supabase
          .from('whatsapp_config')
          .select('manager_phone')
          .limit(1)
          .maybeSingle();

        let managerPhone = config?.manager_phone;

        // Se não tiver manager_phone configurado, busca o primeiro usuário do tipo 'Gestor'
        if (!managerPhone) {
          const { data: gestores } = await supabase
            .from('users')
            .select('whatsapp')
            .eq('tipo', 'Gestor')
            .not('whatsapp', 'is', null)
            .limit(1);

          if (gestores && gestores.length > 0) {
            managerPhone = gestores[0].whatsapp;
          }
        }

        if (managerPhone) {
          let cleanMgr = String(managerPhone).replace(/\D/g, '');
          if (cleanMgr.length === 10 || cleanMgr.length === 11) cleanMgr = `55${cleanMgr}`;
          if (cleanMgr) {
            console.log("Notificando Gestor:", cleanMgr);
            await sendZApiMessage(cleanMgr, msg);
          }
        }
      } catch (err) {
        console.error("Erro ao notificar gestor:", err);
      }
    };

    // 1. Identificar o tipo de evento Z-API
    const isMessage = body.text || body.image || body.audio || body.video || body.buttonResponseMessage || body.buttonsResponseMessage || body.listResponseMessage || body.buttonReply || body.listResponse || body.type === 'button_reply' || body.type === 'BUTTONS_RESPONSE';
    const isStatusUpdate = body.status && body.messageId;

    if (isMessage) {
      let phone = String(body.phone || '');
      if (phone.includes('@')) {
        phone = phone.split('@')[0];
      }
      let cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.length === 10 || cleanPhone.length === 11) {
        cleanPhone = `55${cleanPhone}`;
      }

      const name = body.senderName || body.chatName || "Cliente WhatsApp";
      
      let content = "";
      if (body.text) {
        content = typeof body.text === 'object' ? body.text.message : body.text;
      } else if (body.image) {
        content = body.image.caption ? `[Imagem] ${body.image.caption}` : "[Imagem]";
      } else if (body.audio) {
        content = "[Áudio]";
      } else if (body.video) {
        content = body.video.caption ? `[Vídeo] ${body.video.caption}` : "[Vídeo]";
      } else if (body.document) {
        content = `[Documento] ${body.document.fileName || ""}`;
      } else if (body.buttonResponseMessage) {
        content = body.buttonResponseMessage.selectedDisplayText || body.buttonResponseMessage.message || "";
      } else if (body.buttonsResponseMessage) {
        content = body.buttonsResponseMessage.selectedDisplayText || body.buttonsResponseMessage.message || "";
      } else if (body.listResponseMessage) {
        content = body.listResponseMessage.title || "";
      } else if (body.message) {
        content = body.message;
      }

      const messageId = body.messageId || `msg_${Date.now()}`;
      const isFromMe = body.fromMe === true || body.fromMe === 'true';

      // Busca ou cria o chat
      let { data: chat } = await supabase
        .from('whatsapp_chats')
        .select('*')
        .eq('phone', cleanPhone)
        .maybeSingle();

      const newUnreadCount = isFromMe ? 0 : ((chat?.unread_count || 0) + 1);

      if (!chat) {
        const { data: createdChat, error: chatErr } = await supabase
          .from('whatsapp_chats')
          .insert({
            phone: cleanPhone,
            name: name,
            last_message: content,
            last_message_time: new Date().toISOString(),
            unread_count: newUnreadCount,
            bot_step: 'menu_principal',
            bot_data: {},
            bot_active: true,
            updated_at: new Date().toISOString()
          })
          .select()
          .single();
        if (chatErr) console.error("Erro ao criar chat:", chatErr);
        chat = createdChat;
      } else {
        await supabase
          .from('whatsapp_chats')
          .update({
            name: chat.name && !chat.name.startsWith('WhatsApp (') ? chat.name : name,
            last_message: content,
            last_message_time: new Date().toISOString(),
            unread_count: newUnreadCount,
            updated_at: new Date().toISOString()
          })
          .eq('id', chat.id);
      }

      // Salva a mensagem recebida/enviada
      if (chat) {
        const { data: existingMsg } = await supabase
          .from('whatsapp_messages')
          .select('id')
          .eq('message_id', messageId)
          .maybeSingle();

        if (!existingMsg) {
          await supabase.from('whatsapp_messages').insert({
            chat_id: chat.id,
            message_id: messageId,
            content: content || "[Mensagem]",
            type: body.type || 'text',
            sender: isFromMe ? 'manager' : 'client',
            status: isFromMe ? 'sent' : 'received',
            metadata: body
          });
        }
      }

      // Se a mensagem partiu do próprio gestor/sistema, não processa resposta automática do bot
      if (isFromMe) {
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      // --- LOGICA DE BOTÕES DE ORÇAMENTO / AVALIAÇÃO ---
      const btnId = body.buttonResponseMessage?.selectedButtonId || 
                    body.buttonResponseMessage?.buttonId ||
                    body.buttonsResponseMessage?.selectedButtonId ||
                    body.buttonsResponseMessage?.buttonId ||
                    body.listResponseMessage?.selectedRowId ||
                    body.listResponseMessage?.listItemId ||
                    body.buttonReply?.id ||
                    body.listResponse?.id ||
                    body.button?.id;

      if (btnId && (btnId.startsWith('ACEITAR_') || btnId.startsWith('RECUSAR_'))) {
        if (btnId.startsWith('ACEITAR_SUG_') || btnId.startsWith('ACEITAR_ORIG_')) {
          const isSuggested = btnId.startsWith('ACEITAR_SUG_');
          const ticketId = btnId.replace('ACEITAR_SUG_', '').replace('ACEITAR_ORIG_', '');
          
          try {
            const { data: ticketInfo } = await supabase
              .from('chaves')
              .select('cliente, profissional, orcamentos (*), planejamento (*)')
              .eq('id', ticketId)
              .maybeSingle();

            if (ticketInfo) {
              const budget = Array.isArray(ticketInfo.orcamentos) ? ticketInfo.orcamentos[0] : ticketInfo.orcamentos;
              const plan = Array.isArray(ticketInfo.planejamento) ? ticketInfo.planejamento[0] : ticketInfo.planejamento;
              const profId = ticketInfo.profissional;
              
              if (budget) {
                const finalType = isSuggested ? budget.tipopagmto_sugerido : budget.tipopagmto;
                const finalParcelas = isSuggested ? budget.parcelas_sugerido : budget.parcelas;
                let finalPrice = budget.preco;
                if (isSuggested && (budget.desconto_sugerido || 0) > 0) {
                  finalPrice = budget.preco * (1 - (budget.desconto_sugerido || 0) / 100);
                }
                await supabase.from('orcamentos').update({
                  tipopagmto: finalType,
                  parcelas: finalParcelas,
                  preco: finalPrice
                }).eq('id', budget.id);
              }

              if (plan && profId) {
                const { data: existingAgenda } = await supabase.from('agenda').select('id').eq('chave', ticketId).maybeSingle();
                const agendaPayload = {
                  chave: ticketId,
                  cliente: ticketInfo.cliente,
                  profissional: profId,
                  execucao: plan.execucao,
                  observacoes: ''
                };
                if (existingAgenda) await supabase.from('agenda').update(agendaPayload).eq('id', existingAgenda.id);
                else await supabase.from('agenda').insert(agendaPayload);
              }
            }
          } catch (err) {
            console.error("Erro ao aprovar orcamento:", err);
          }

          await supabase.from('chaves').update({ status: 'aprovado' }).eq('id', ticketId);
          await sendZApiMessage(cleanPhone, "✅ *Orçamento aceito com sucesso!*\n\nO profissional responsável já foi notificado e entrará em contato para iniciar a execução.");
          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        } else if (btnId.startsWith('RECUSAR_')) {
          const ticketId = btnId.replace('RECUSAR_', '');
          await supabase.from('chaves').update({ status: 'recusado', whatsapp_chat_id: chat?.id }).eq('id', ticketId);
          await sendZApiMessage(cleanPhone, "❌ *Orçamento recusado.*\n\nPor favor, digite o motivo da recusa para que nossa gestão possa avaliar uma melhor condição para você:");
          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }
      }

      // --- MÁQUINA DE ESTADOS DO BOT DE AGENDAMENTO ---
      const { data: config } = await supabase.from('whatsapp_config').select('*').limit(1).maybeSingle();
      const botActiveGlobally = config?.bot_active !== false;
      const chatBotActive = chat?.bot_active !== false;

      if (!botActiveGlobally || !chatBotActive) {
        // Bot pausado para este chat (atendimento humano ativo)
        return new Response(JSON.stringify({ success: true, bot: 'disabled' }), { headers: corsHeaders });
      }

      let currentStep = chat?.bot_step || 'menu_principal';
      let sessionData = chat?.bot_data || {};
      const userText = content.trim();
      const lowerText = userText.toLowerCase();

      // Comandos globais de escape e transbordo
      if (['humano', 'atendente', 'falar com atendente', 'pessoa', '3'].includes(lowerText) && currentStep === 'menu_principal') {
        await supabase.from('whatsapp_chats').update({ bot_active: false, bot_step: 'menu_principal' }).eq('id', chat.id);
        await sendZApiMessage(cleanPhone, "👤 *Transferindo para Atendimento Humano...*\n\nNossa equipe gestora foi notificada e entrará em contato com você por aqui em instantes!");
        await notifyManager(`🔔 *Solicitação de Atendimento Humano*\n\n👤 *Cliente:* ${chat.name || 'Cliente'}\n📱 *Telefone:* ${cleanPhone}\n💬 *Última mensagem:* "${userText}"`);
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      if (['cancelar', 'reiniciar', 'menu', 'inicio', 'início'].includes(lowerText)) {
        await supabase.from('whatsapp_chats').update({ bot_step: 'menu_principal', bot_data: {} }).eq('id', chat.id);
        await sendZApiMessage(cleanPhone, 
          `👋 Olá! Bem-vindo(a) à *UAI-Fix* 🛠️\nSua plataforma de serviços e manutenções rápidas.\n\nComo podemos te ajudar hoje?\n\n1️⃣ *Solicitar / Agendar Serviço*\n2️⃣ *Consultar meu Chamado / Status*\n3️⃣ *Falar com um Atendente*\n\n_(Digite o número da opção desejada ou nos conte o que você precisa)_`
        );
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      // Busca categorias ativas do banco
      const { data: dbCategories } = await supabase
        .from('geral')
        .select('*')
        .eq('primaria', true)
        .eq('ativa', true)
        .order('id', { ascending: true });
      const activeCats = dbCategories || [];

      // ----------------------------------------------------
      // ESTADO: MENU PRINCIPAL
      // ----------------------------------------------------
      if (currentStep === 'menu_principal') {
        if (userText === '2' || lowerText.includes('consultar') || lowerText.includes('status')) {
          // Consultar chamado existente
          const { data: tickets } = await supabase
            .from('chaves')
            .select('id, chaveunica, status, created_at, geral(nome)')
            .or(`whatsapp_chat_id.eq.${chat.id}`)
            .order('created_at', { ascending: false })
            .limit(3);

          if (tickets && tickets.length > 0) {
            let resMsg = "📋 *Seus Chamados na UAI-Fix:*\n\n";
            tickets.forEach(tk => {
              const servNome = (tk.geral as any)?.nome || 'Serviço';
              const dt = new Date(tk.created_at).toLocaleDateString('pt-BR');
              resMsg += `📌 *OS:* ${tk.chaveunica}\n🛠️ *Serviço:* ${servNome}\n📊 *Status:* ${tk.status.toUpperCase()}\n📅 *Data:* ${dt}\n\n`;
            });
            resMsg += "Para solicitar um novo chamado, digite *1*. Para falar com a equipe, digite *3*.";
            await sendZApiMessage(cleanPhone, resMsg);
          } else {
            await sendZApiMessage(cleanPhone, "🔍 Não localizamos nenhum chamado recente vinculado a este número.\n\nDeseja solicitar um novo serviço? Digite *1* para iniciar o agendamento.");
          }
          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }

        // Se o usuário digitou '1' ou qualquer texto solicitando serviço / descrevendo problema
        sessionData = {}; // Inicia uma nova sessão limpa para este chamado
        const detectedCat = classifyCategoryFromText(userText, activeCats);
        if (detectedCat) {
          sessionData.categoria_id = detectedCat.id;
          sessionData.categoria_nome = detectedCat.nome;
          sessionData.descricao = userText;
        } else if (!isGenericIntent(userText) && userText.length > 8) {
          sessionData.descricao = userText;
        }

        // Avança para coleta do CPF
        await supabase
          .from('whatsapp_chats')
          .update({ bot_step: 'aguardando_cpf', bot_data: sessionData })
          .eq('id', chat.id);

        await sendZApiMessage(cleanPhone, "Excelente! Para iniciarmos seu agendamento, por favor informe seu *CPF* (apenas números):");
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      // ----------------------------------------------------
      // ESTADO: AGUARDANDO CPF
      // ----------------------------------------------------
      if (currentStep === 'aguardando_cpf') {
        const cleanCpf = userText.replace(/\D/g, '');
        if (cleanCpf.length !== 11) {
          await sendZApiMessage(cleanPhone, "⚠️ Por favor, digite um CPF válido contendo *11 números* para localizarmos seu cadastro:");
          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }

        sessionData.cpf = cleanCpf;
        sessionData.formattedCpf = formatCpf(cleanCpf);

        // Busca cliente no banco por CPF ou telefone
        const { data: foundUser } = await supabase
          .from('users')
          .select('*, cidades(cidade, uf)')
          .or(`cpf.eq.${cleanCpf},whatsapp.ilike.%${cleanPhone.slice(-8)}%`)
          .limit(1)
          .maybeSingle();

        if (foundUser) {
          sessionData.user_uuid = foundUser.uuid;
          sessionData.nome = foundUser.nome;
          sessionData.cidade_id = foundUser.cidade;
          sessionData.cidade_nome = (foundUser.cidades as any)?.cidade || '';
          sessionData.rua = foundUser.rua || '';
          sessionData.numero = foundUser.numero || '';
          sessionData.bairro = foundUser.bairro || '';

          const hasFullAddress = foundUser.rua && foundUser.numero && foundUser.bairro;
          if (hasFullAddress) {
            const addrStr = `${foundUser.rua}, ${foundUser.numero} - ${foundUser.bairro}${sessionData.cidade_nome ? ` (${sessionData.cidade_nome})` : ''}`;
            sessionData.endereco_completo = addrStr;

            await supabase
              .from('whatsapp_chats')
              .update({ bot_step: 'confirmar_endereco', bot_data: sessionData })
              .eq('id', chat.id);

            await sendZApiMessage(cleanPhone, 
              `Que bom ter você de volta, *${foundUser.nome}*! 😊\n\nO atendimento será no seu endereço cadastrado?\n📍 *${addrStr}*\n\n1️⃣ *Sim, neste mesmo endereço*\n2️⃣ *Não, informar outro endereço*`
            );
            return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
          } else {
            // Usuário sem endereço completo salvo
            await supabase
              .from('whatsapp_chats')
              .update({ bot_step: 'aguardando_cidade', bot_data: sessionData })
              .eq('id', chat.id);

            await sendZApiMessage(cleanPhone, `Que bom ter você de volta, *${foundUser.nome}*! 👋\n\nQual é a *Cidade* onde o serviço será realizado?`);
            return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
          }
        } else {
          // Novo Cliente
          await supabase
            .from('whatsapp_chats')
            .update({ bot_step: 'aguardando_nome', bot_data: sessionData })
            .eq('id', chat.id);

          await sendZApiMessage(cleanPhone, "Perfeito! Para concluirmos seu cadastro rápido, qual é o seu *Nome Completo*?");
          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }
      }

      // ----------------------------------------------------
      // ESTADO: AGUARDANDO NOME (Novo Cliente)
      // ----------------------------------------------------
      if (currentStep === 'aguardando_nome') {
        sessionData.nome = userText;
        await supabase
          .from('whatsapp_chats')
          .update({ name: userText, bot_step: 'aguardando_cidade', bot_data: sessionData })
          .eq('id', chat.id);

        await sendZApiMessage(cleanPhone, `Prazer, *${userText}*! 🤝\n\nEm qual *Cidade* você precisa do atendimento?`);
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      // ----------------------------------------------------
      // ESTADO: CONFIRMAR ENDEREÇO EXISTENTE
      // ----------------------------------------------------
      if (currentStep === 'confirmar_endereco') {
        if (userText === '1' || lowerText.includes('sim') || lowerText.includes('mesmo')) {
          // Usa endereço salvo. Verifica se já temos a categoria/descrição coletada
          if (sessionData.categoria_id && sessionData.descricao) {
            await supabase
              .from('whatsapp_chats')
              .update({ bot_step: 'aguardando_data', bot_data: sessionData })
              .eq('id', chat.id);

            await sendZApiMessage(cleanPhone, 
              `Identifiquei seu pedido de *${sessionData.categoria_nome}*:\n_\"${sessionData.descricao}\"_\n\n📅 Para qual *dia* você gostaria de agendar o atendimento?\n\n1️⃣ *Hoje*\n2️⃣ *Amanhã*\n3️⃣ *Nesta semana*\n4️⃣ *A combinar / Outra data (digite a data desejada)*`
            );
            return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
          }

          // Senão, pergunta o serviço
          await supabase
            .from('whatsapp_chats')
            .update({ bot_step: 'aguardando_servico', bot_data: sessionData })
            .eq('id', chat.id);

          let menuServicos = "Qual o tipo de serviço que você precisa?\n\n";
          activeCats.forEach((cat, idx) => {
            menuServicos += `${idx + 1}️⃣ *${cat.nome}*\n`;
          });
          menuServicos += "\n_(Digite o número da categoria ou descreva diretamente o problema)_";

          await sendZApiMessage(cleanPhone, menuServicos);
          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        } else {
          // Informar outro endereço - limpa dados de endereço anteriores da sessão
          sessionData.cidade_id = null;
          sessionData.cidade_nome = '';
          sessionData.rua = '';
          sessionData.numero = '';
          sessionData.bairro = '';
          sessionData.endereco_completo = '';

          await supabase
            .from('whatsapp_chats')
            .update({ bot_step: 'aguardando_cidade', bot_data: sessionData })
            .eq('id', chat.id);

          await sendZApiMessage(cleanPhone, "Sem problemas! Informe a *Cidade* do local onde o serviço será realizado:");
          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }
      }

      // ----------------------------------------------------
      // ESTADO: AGUARDANDO CIDADE / CEP
      // ----------------------------------------------------
      if (currentStep === 'aguardando_cidade') {
        const { data: allCities } = await supabase
          .from('cidades')
          .select('id, cidade, uf');
        const citiesList = allCities || [];

        // 1. Verifica se o usuário digitou um CEP (ex: "36420-000", "36420000" ou texto com CEP)
        const digitsOnly = userText.replace(/\D/g, '');
        const cepMatch = userText.match(/\b\d{5}-?\d{3}\b/) || (digitsOnly.length === 8 ? [digitsOnly] : null);

        if (cepMatch) {
          const cepData = await fetchViaCep(cepMatch[0]);
          if (cepData && cepData.localidade) {
            const provisioned = await getOrProvisionCityInEdge(supabase, cepData.localidade, cepData.uf);
            if (provisioned) {
              sessionData.cidade_id = provisioned.id;
              sessionData.cidade_nome = provisioned.cidade;
              sessionData.cep = cepData.cep || formatCpf(cepMatch[0]);
              if (cepData.logradouro) sessionData.rua = cepData.logradouro;
              if (cepData.bairro) sessionData.bairro = cepData.bairro;

              // Tenta extrair número do texto se o usuário digitou ex: "36420000 numero 120"
              const numMatch = userText.match(/\b(?:n[º°]?|numero|número)?\s*(\d{1,5})\b/i);
              if (numMatch && numMatch[1] && numMatch[1].length <= 5 && numMatch[1] !== digitsOnly) {
                sessionData.numero = numMatch[1];
              }

              if (sessionData.rua && sessionData.bairro && sessionData.numero) {
                sessionData.endereco_completo = `${sessionData.rua}, ${sessionData.numero} - ${sessionData.bairro} (${sessionData.cidade_nome})`;
                if (sessionData.categoria_id && sessionData.descricao) {
                  await supabase
                    .from('whatsapp_chats')
                    .update({ bot_step: 'aguardando_data', bot_data: sessionData })
                    .eq('id', chat.id);

                  await sendZApiMessage(cleanPhone, 
                    `Localizamos seu endereço pelo CEP: 📍\n*${sessionData.endereco_completo}*\n\nPara o serviço de *${sessionData.categoria_nome}*, para qual *dia* você gostaria de agendar?\n\n1️⃣ *Hoje*\n2️⃣ *Amanhã*\n3️⃣ *Nesta semana*\n4️⃣ *A combinar / Outra data (digite a data desejada)*`
                  );
                  return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
                }

                await supabase
                  .from('whatsapp_chats')
                  .update({ bot_step: 'aguardando_servico', bot_data: sessionData })
                  .eq('id', chat.id);

                let menuServicos = `Endereço localizado pelo CEP: *${sessionData.endereco_completo}* 📍\n\nQual serviço você precisa?\n\n`;
                activeCats.forEach((cat, idx) => {
                  menuServicos += `${idx + 1}️⃣ *${cat.nome}*\n`;
                });
                menuServicos += "\n_(Digite o número correspondente ou descreva em texto o que precisa)_";

                await sendZApiMessage(cleanPhone, menuServicos);
                return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
              }

              if (sessionData.rua && sessionData.bairro) {
                // Rua e bairro localizados pelo CEP, falta o número
                await supabase
                  .from('whatsapp_chats')
                  .update({ bot_step: 'aguardando_endereco', bot_data: sessionData })
                  .eq('id', chat.id);

                await sendZApiMessage(cleanPhone, 
                  `CEP identificado! 📍\n*${sessionData.rua} - ${sessionData.bairro} (${sessionData.cidade_nome})*\n\nPor favor, informe o *Número* e *Complemento* (se houver):`
                );
                return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
              }
            }
          }
        }

        // 2. Se digitou endereço completo com cidade
        const parsed = parseFullAddress(userText, citiesList);

        if (parsed.isFullAddress && parsed.cidade_id) {
          sessionData.cidade_id = parsed.cidade_id;
          sessionData.cidade_nome = parsed.cidade_nome;
          sessionData.rua = parsed.rua;
          sessionData.numero = parsed.numero;
          sessionData.bairro = parsed.bairro;
          sessionData.endereco_completo = `${parsed.rua}${parsed.numero ? `, ${parsed.numero}` : ''}${parsed.bairro ? ` - ${parsed.bairro}` : ''} (${parsed.cidade_nome})`;

          if (sessionData.categoria_id && sessionData.descricao) {
            await supabase
              .from('whatsapp_chats')
              .update({ bot_step: 'aguardando_data', bot_data: sessionData })
              .eq('id', chat.id);

            await sendZApiMessage(cleanPhone, 
              `Endereço salvo com sucesso! 📍\n*${sessionData.endereco_completo}*\n\nPara o serviço de *${sessionData.categoria_nome}*, para qual *dia* você gostaria de agendar?\n\n1️⃣ *Hoje*\n2️⃣ *Amanhã*\n3️⃣ *Nesta semana*\n4️⃣ *A combinar / Outra data (digite a data desejada)*`
            );
            return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
          }

          await supabase
            .from('whatsapp_chats')
            .update({ bot_step: 'aguardando_servico', bot_data: sessionData })
            .eq('id', chat.id);

          let menuServicos = `Endereço salvo: *${sessionData.endereco_completo}* 📍\n\nQual serviço você precisa?\n\n`;
          activeCats.forEach((cat, idx) => {
            menuServicos += `${idx + 1}️⃣ *${cat.nome}*\n`;
          });
          menuServicos += "\n_(Digite o número correspondente ou descreva em texto o que precisa)_";

          await sendZApiMessage(cleanPhone, menuServicos);
          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }

        // 3. Se digitou nome de cidade (existente ou nova)
        const ufMatch = userText.match(/[-,\/]\s*([a-zA-Z]{2})\b/);
        const ufCode = ufMatch ? ufMatch[1] : undefined;
        const cleanCityName = userText.replace(/[-,\/]\s*[a-zA-Z]{2}\b/, '').trim();

        const provisionedCity = await getOrProvisionCityInEdge(supabase, cleanCityName, ufCode);
        sessionData.cidade_id = provisionedCity?.id || 1;
        sessionData.cidade_nome = provisionedCity?.cidade || cleanCityName;

        await supabase
          .from('whatsapp_chats')
          .update({ bot_step: 'aguardando_endereco', bot_data: sessionData })
          .eq('id', chat.id);

        await sendZApiMessage(cleanPhone, `Anotado (*${sessionData.cidade_nome}*). 📍\n\nAgora por favor informe a *Rua, Número e Bairro* do local do serviço (ou digite seu CEP):`);
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      // ----------------------------------------------------
      // ESTADO: AGUARDANDO ENDEREÇO
      // ----------------------------------------------------
      if (currentStep === 'aguardando_endereco') {
        const digitsOnly = userText.replace(/\D/g, '');
        const cepMatch = userText.match(/\b\d{5}-?\d{3}\b/) || (digitsOnly.length === 8 ? [digitsOnly] : null);

        if (cepMatch && digitsOnly.length === 8) {
          const cepData = await fetchViaCep(cepMatch[0]);
          if (cepData && cepData.localidade) {
            const provisioned = await getOrProvisionCityInEdge(supabase, cepData.localidade, cepData.uf);
            if (provisioned) {
              sessionData.cidade_id = provisioned.id;
              sessionData.cidade_nome = provisioned.cidade;
              sessionData.cep = cepData.cep;
              if (cepData.logradouro) sessionData.rua = cepData.logradouro;
              if (cepData.bairro) sessionData.bairro = cepData.bairro;
            }
          }
        }

        const { data: allCities } = await supabase.from('cidades').select('id, cidade, uf');
        const parsed = parseFullAddress(userText, allCities || []);

        if (parsed.cidade_id && (!sessionData.cidade_id || sessionData.cidade_id === 1)) {
          sessionData.cidade_id = parsed.cidade_id;
          sessionData.cidade_nome = parsed.cidade_nome;
        }

        // Se a sessão já tinha rua de um CEP e o usuário enviou apenas o número
        const isOnlyNumber = /^\d{1,5}(?:\s*[,-]\s*.*)?$/.test(userText.trim());
        if (sessionData.rua && isOnlyNumber) {
          sessionData.numero = userText.trim();
        } else {
          sessionData.rua = parsed.rua || userText;
          sessionData.numero = parsed.numero || sessionData.numero || '';
          sessionData.bairro = parsed.bairro || sessionData.bairro || '';
        }

        sessionData.endereco_completo = `${sessionData.rua}${sessionData.numero ? `, ${sessionData.numero}` : ''}${sessionData.bairro ? ` - ${sessionData.bairro}` : ''} (${sessionData.cidade_nome})`;

        // Tenta descobrir o CEP automaticamente se não tiver sido fornecido
        if (!sessionData.cep && sessionData.rua && sessionData.cidade_nome) {
          const autoCep = await lookupCepFromAddressEdge(sessionData.cidade_nome, 'MG', sessionData.rua);
          if (autoCep) sessionData.cep = autoCep;
        }

        if (sessionData.categoria_id && sessionData.descricao) {
          await supabase
            .from('whatsapp_chats')
            .update({ bot_step: 'aguardando_data', bot_data: sessionData })
            .eq('id', chat.id);

          await sendZApiMessage(cleanPhone, 
            `Endereço salvo! 📍\n*${sessionData.endereco_completo}*\n\nPara o serviço de *${sessionData.categoria_nome}*, para qual *dia* você gostaria de agendar?\n\n1️⃣ *Hoje*\n2️⃣ *Amanhã*\n3️⃣ *Nesta semana*\n4️⃣ *A combinar / Outra data (digite a data desejada)*`
          );
          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }

        await supabase
          .from('whatsapp_chats')
          .update({ bot_step: 'aguardando_servico', bot_data: sessionData })
          .eq('id', chat.id);

        let menuServicos = `Endereço registrado: *${sessionData.endereco_completo}* 📍\n\nQual serviço você precisa?\n\n`;
        activeCats.forEach((cat, idx) => {
          menuServicos += `${idx + 1}️⃣ *${cat.nome}*\n`;
        });
        menuServicos += "\n_(Digite o número correspondente ou descreva em texto o que precisa)_";

        await sendZApiMessage(cleanPhone, menuServicos);
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      // ----------------------------------------------------
      // ESTADO: AGUARDANDO SERVIÇO / CATEGORIA
      // ----------------------------------------------------
      if (currentStep === 'aguardando_servico') {
        const choiceNum = parseInt(userText, 10);
        let selectedCat = null;

        if (!isNaN(choiceNum) && choiceNum >= 1 && choiceNum <= activeCats.length) {
          selectedCat = activeCats[choiceNum - 1];
        } else {
          // Tenta classificar o texto livre informado pelo usuário
          selectedCat = classifyCategoryFromText(userText, activeCats);
          if (userText.length > 5) {
            sessionData.descricao = userText;
          }
        }

        if (selectedCat) {
          sessionData.categoria_id = selectedCat.id;
          sessionData.categoria_nome = selectedCat.nome;

          if (sessionData.descricao) {
            // Já temos a descrição, vai direto para data
            await supabase
              .from('whatsapp_chats')
              .update({ bot_step: 'aguardando_data', bot_data: sessionData })
              .eq('id', chat.id);

            await sendZApiMessage(cleanPhone, 
              `Ótimo! Categoria definida como *${selectedCat.nome}*.\n\n📅 Para qual *dia* você gostaria de agendar o atendimento?\n\n1️⃣ *Hoje*\n2️⃣ *Amanhã*\n3️⃣ *Nesta semana*\n4️⃣ *A combinar / Outra data (digite a data desejada)*`
            );
          } else {
            // Solicita descrição do problema
            await supabase
              .from('whatsapp_chats')
              .update({ bot_step: 'aguardando_descricao', bot_data: sessionData })
              .eq('id', chat.id);

            await sendZApiMessage(cleanPhone, `Excelente (*${selectedCat.nome}*). 🛠️\n\nPor favor, descreva em poucas palavras o que precisa ser feito ou o problema encontrado (se preferir, envie uma foto ou áudio):`);
          }
        } else {
          // Fallback para primeira categoria e salva descrição
          sessionData.categoria_id = activeCats[0]?.id || 1;
          sessionData.categoria_nome = activeCats[0]?.nome || 'Serviços Gerais';
          sessionData.descricao = userText;

          await supabase
            .from('whatsapp_chats')
            .update({ bot_step: 'aguardando_data', bot_data: sessionData })
            .eq('id', chat.id);

          await sendZApiMessage(cleanPhone, 
            `Entendido! Registramos sua solicitação: _\"${userText}\"_\n\n📅 Para qual *dia* você gostaria de agendar o atendimento?\n\n1️⃣ *Hoje*\n2️⃣ *Amanhã*\n3️⃣ *Nesta semana*\n4️⃣ *A combinar / Outra data (digite a data desejada)*`
          );
        }
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      // ----------------------------------------------------
      // ESTADO: AGUARDANDO DESCRIÇÃO
      // ----------------------------------------------------
      if (currentStep === 'aguardando_descricao') {
        sessionData.descricao = userText;

        await supabase
          .from('whatsapp_chats')
          .update({ bot_step: 'aguardando_data', bot_data: sessionData })
          .eq('id', chat.id);

        await sendZApiMessage(cleanPhone, 
          `Perfeito! Anotado. 📝\n\n📅 Para qual *dia* você gostaria de agendar a realização do serviço?\n\n1️⃣ *Hoje*\n2️⃣ *Amanhã*\n3️⃣ *Nesta semana*\n4️⃣ *A combinar / Outra data (digite a data desejada)*`
        );
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      // ----------------------------------------------------
      // ESTADO: AGUARDANDO DATA PREFERIDA
      // ----------------------------------------------------
      if (currentStep === 'aguardando_data') {
        const { dataStr, estimatedIso } = parseServiceDate(userText);
        sessionData.data_preferida = dataStr;
        sessionData.data_estimada_iso = estimatedIso;

        await supabase
          .from('whatsapp_chats')
          .update({ bot_step: 'aguardando_turno', bot_data: sessionData })
          .eq('id', chat.id);

        await sendZApiMessage(cleanPhone, 
          `Data anotada: *${dataStr}* 📅\n\nQual a sua preferência de *horário / turno* para o atendimento?\n\n1️⃣ *Urgente (o quanto antes)*\n2️⃣ *Manhã (08h às 12h)*\n3️⃣ *Tarde (13h às 18h)*\n4️⃣ *A combinar com o profissional*`
        );
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      // ----------------------------------------------------
      // ESTADO: AGUARDANDO TURNO / PREFERÊNCIA DE HORÁRIO
      // ----------------------------------------------------
      if (currentStep === 'aguardando_turno') {
        let turnoDesc = "A combinar";
        if (userText === '1' || lowerText.includes('urgente')) turnoDesc = "Urgente (o quanto antes)";
        else if (userText === '2' || lowerText.includes('manhã') || lowerText.includes('manha')) turnoDesc = "Manhã (08h às 12h)";
        else if (userText === '3' || lowerText.includes('tarde')) turnoDesc = "Tarde (13h às 18h)";
        else if (userText.length > 2) turnoDesc = userText;

        sessionData.turno = turnoDesc;

        await supabase
          .from('whatsapp_chats')
          .update({ bot_step: 'resumo_confirmacao', bot_data: sessionData })
          .eq('id', chat.id);

        const resumo = 
          `📋 *Confirmação do Agendamento:*\n\n` +
          `👤 *Cliente:* ${sessionData.nome}\n` +
          `📄 *CPF:* ${sessionData.formattedCpf || formatCpf(sessionData.cpf)}\n` +
          `📍 *Local:* ${sessionData.endereco_completo || sessionData.rua}\n` +
          `🛠️ *Serviço:* ${sessionData.categoria_nome}\n` +
          `📝 *Detalhes:* ${sessionData.descricao || 'Conforme alinhado'}\n` +
          `📅 *Data Desejada:* ${sessionData.data_preferida || 'A combinar'}\n` +
          `⏰ *Horário / Turno:* ${sessionData.turno}\n\n` +
          `Podemos confirmar seu pedido?\n` +
          `1️⃣ *Sim, confirmar agendamento*\n` +
          `2️⃣ *Cancelar e recomeçar*`;

        await sendZApiMessage(cleanPhone, resumo);
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      }

      // ----------------------------------------------------
      // ESTADO: RESUMO E GRAVAÇÃO NO BANCO
      // ----------------------------------------------------
      if (currentStep === 'resumo_confirmacao') {
        if (userText === '1' || lowerText.includes('sim') || lowerText.includes('confirmar')) {
          let clientUuid = sessionData.user_uuid;

          // 1. Cria ou atualiza o usuário em 'users'
          if (!clientUuid) {
            const { data: newUser, error: userErr } = await supabase
              .from('users')
              .insert({
                nome: sessionData.nome || chat.name || "Cliente WhatsApp",
                tipo: 'Consumidor',
                origem: 'whatsapp',
                whatsapp: cleanPhone,
                cpf: sessionData.cpf,
                cidade: sessionData.cidade_id || 1,
                rua: sessionData.rua || '',
                numero: sessionData.numero || '',
                bairro: sessionData.bairro || '',
                sexo: 'Outro',
                ativo: true
              })
              .select('uuid')
              .single();

            if (!userErr && newUser?.uuid) {
              clientUuid = newUser.uuid;
            }
          }

          // 2. Upsert em 'whatsapp_leads'
          if (sessionData.cpf) {
            await supabase.from('whatsapp_leads').upsert({
              cpf: sessionData.cpf,
              nome: sessionData.nome,
              telefone: cleanPhone,
              chat_id: chat.id,
              user_uuid: clientUuid,
              vinculado: true,
              updated_at: new Date().toISOString()
            }, { onConflict: 'cpf' });
          }

          // 3. Gerar código único e inserir em 'chaves'
          const uniqueOsCode = `OS-WA-${Date.now().toString().slice(-6)}`;
          const { data: newChave, error: chaveErr } = await supabase
            .from('chaves')
            .insert({
              cliente: clientUuid,
              chaveunica: uniqueOsCode,
              status: 'pendente',
              atividade: sessionData.categoria_id || 1,
              cidade: sessionData.cidade_id || 1,
              origem: 'whatsapp',
              relato_problema: sessionData.descricao || `Solicitação via WhatsApp - ${sessionData.categoria_nome}`,
              whatsapp_chat_id: chat.id,
              whatsapp_lead_cpf: sessionData.cpf
            })
            .select()
            .single();

          if (chaveErr) {
            console.error("Erro ao registrar OS em chaves:", chaveErr);
            throw chaveErr;
          }

          // 4. Inserir planejamento preliminar
          if (newChave?.id) {
            const fullAddressMetadata = 
              `[ENDEREÇO DO SERVIÇO]: ${sessionData.rua || ''}${sessionData.numero ? `, ${sessionData.numero}` : ''}${sessionData.bairro ? ` - ${sessionData.bairro}` : ''} (${sessionData.cidade_nome || ''})\n` +
              `[RUA]: ${sessionData.rua || ''}\n` +
              `[NUMERO]: ${sessionData.numero || ''}\n` +
              `[BAIRRO]: ${sessionData.bairro || ''}\n` +
              `[CIDADE]: ${sessionData.cidade_nome || ''}\n` +
              (sessionData.cep ? `[CEP]: ${sessionData.cep}\n` : '') +
              `\n[DATA PREFERIDA]: ${sessionData.data_preferida || 'A combinar'}\n` +
              `[PREFERÊNCIA DE TURNO]: ${sessionData.turno || 'A combinar'}\n` +
              `[RELATO]: ${sessionData.descricao || ''}`;

            const execIso = sessionData.data_estimada_iso || new Date().toISOString();
            const { error: planErr } = await supabase.from('planejamento').insert({
              chave: newChave.id,
              descricao: fullAddressMetadata,
              pagamento: 'Dinheiro',
              ativo: true,
              tempoprevisto: 1,
              execucao: execIso,
              visita: execIso
            });

            if (planErr) console.error("Erro ao registrar planejamento:", planErr);

            if (clientUuid && sessionData.rua) {
              await supabase.from('users').update({
                cidade: sessionData.cidade_id || 1,
                rua: sessionData.rua,
                numero: sessionData.numero || '',
                bairro: sessionData.bairro || ''
              }).eq('uuid', clientUuid);
            }
          }

          // 5. Enviar confirmação com protocolo ao cliente
          const confirmacaoCliente = 
            `🎉 *Agendamento Confirmado com Sucesso!*\n\n` +
            `Seu chamado foi registrado em nosso sistema:\n` +
            `📌 *Código da OS:* ${uniqueOsCode}\n` +
            `🛠️ *Serviço:* ${sessionData.categoria_nome}\n` +
            `📍 *Local:* ${sessionData.cidade_nome || 'Local informado'}\n` +
            `📅 *Data Desejada:* ${sessionData.data_preferida || 'A combinar'}\n` +
            `⏰ *Preferência:* ${sessionData.turno}\n\n` +
            `Nossa equipe gestora já está alocando o melhor profissional para atender você. Em breve enviaremos atualizações por aqui!\n\n` +
            `_Se precisar de qualquer informação adicional, basta nos mandar uma mensagem._`;

          await sendZApiMessage(cleanPhone, confirmacaoCliente);

          // 6. Notificar Gestor UAI-Fix
          const alertaGestor = 
            `🔔 *NOVO CHAMADO VIA WHATSAPP!* 🛠️\n\n` +
            `📌 *OS:* ${uniqueOsCode}\n` +
            `👤 *Cliente:* ${sessionData.nome}\n` +
            `📱 *WhatsApp:* ${cleanPhone}\n` +
            `📄 *CPF:* ${sessionData.formattedCpf || formatCpf(sessionData.cpf)}\n` +
            `📍 *Endereço:* ${sessionData.endereco_completo || sessionData.rua}\n` +
            `🛠️ *Serviço:* ${sessionData.categoria_nome}\n` +
            `📝 *Relato:* ${sessionData.descricao || 'Sem descrição'}\n` +
            `📅 *Data Desejada:* ${sessionData.data_preferida || 'A combinar'}\n` +
            `⏰ *Turno:* ${sessionData.turno}\n\n` +
            `Acesse o painel da UAI-Fix para aprovar e direcionar ao profissional.`;

          await notifyManager(alertaGestor);

          // 7. Resetar sessão para futuros chamados
          await supabase
            .from('whatsapp_chats')
            .update({ bot_step: 'menu_principal', bot_data: {} })
            .eq('id', chat.id);

          return new Response(JSON.stringify({ success: true, os: uniqueOsCode }), { headers: corsHeaders });
        } else {
          // Cancelou no resumo
          await supabase
            .from('whatsapp_chats')
            .update({ bot_step: 'menu_principal', bot_data: {} })
            .eq('id', chat.id);

          await sendZApiMessage(cleanPhone, "Solicitação cancelada. 👍\n\nSempre que precisar de serviços rápidos e confiáveis, estamos à disposição na *UAI-Fix*!");
          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }
      }
    }

    // --- ATUALIZAÇÃO DE STATUS DE LEITURA/ENTREGA ---
    if (isStatusUpdate) {
      const statusMap: Record<string, string> = {
        'RECEIVED': 'received',
        'SENDING': 'sending',
        'SENT': 'sent',
        'DELIVERED': 'delivered',
        'READ': 'read'
      };

      const updatePayload: any = { status: statusMap[body.status] || body.status };
      if (body.status === 'READ') updatePayload.read_at = new Date().toISOString();

      await supabase.from('whatsapp_messages').update(updatePayload).eq('message_id', body.messageId);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error("Erro no Webhook:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
})
