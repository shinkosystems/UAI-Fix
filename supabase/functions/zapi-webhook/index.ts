// @sos-edit: false
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Lidar com requisições OPTIONS (CORS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json()
    console.log("Recebido da Z-API:", body)

    const sendZApiMessage = async (phone: string, text: string) => {
      try {
        const { data: config } = await supabase
          .from('whatsapp_config')
          .select('instance_id, token, client_token')
          .limit(1)
          .maybeSingle();

        if (config?.instance_id && config?.token) {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (config.client_token) headers['client-token'] = config.client_token;
          
          const response = await fetch(`https://api.z-api.io/instances/${config.instance_id}/token/${config.token}/send-text`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ phone, message: text })
          });

          if (response.ok) {
            const zapiData = await response.json();
            const messageId = zapiData.messageId || `msg_${Date.now()}`;

            let cleanPhone = phone.replace(/\D/g, '');
            if (cleanPhone.length === 10 || cleanPhone.length === 11) {
              cleanPhone = `55${cleanPhone}`;
            }

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
              const { data: existingMsg } = await supabase
                .from('whatsapp_messages')
                .select('id')
                .eq('message_id', messageId)
                .maybeSingle();

              if (!existingMsg) {
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
            }
          }
        }
      } catch (err) {
        console.error("Erro ao enviar msg Z-API:", err);
      }
    };


    // 1. Identificar o tipo de evento
    // Z-API envia o tipo no corpo ou podemos inferir pelos campos
    const isMessage = body.text || body.image || body.audio || body.video || body.buttonResponseMessage || body.buttonsResponseMessage || body.listResponseMessage || body.buttonReply || body.listResponse || body.type === 'button_reply' || body.type === 'BUTTONS_RESPONSE';
    const isStatusUpdate = body.status && body.messageId;

    // --- LOGICA PARA NOVA MENSAGEM RECEBIDA ---
    if (isMessage) {
      let phone = String(body.phone || '');
      // Limpar o telefone se vier com sufixos
      if (phone.includes('@')) {
        phone = phone.split('@')[0];
      }
      const name = body.senderName || body.chatName || "Cliente WhatsApp";
      
      // Extrair conteúdo de forma mais segura (Z-API envia as vezes em body.text.message ou só como string)
      let content = "[Arquivo/Mídia]";
      if (body.text) {
        content = typeof body.text === 'object' ? body.text.message : body.text;
      } else if (body.image) {
        content = "[Imagem] " + (body.image.caption || "");
      } else if (body.audio) {
        content = "[Áudio]";
      } else if (body.video) {
        content = "[Vídeo] " + (body.video.caption || "");
      } else if (body.document) {
        content = "[Documento] " + (body.document.fileName || "");
      } else if (body.buttonResponseMessage) {
        content = "[Botão] " + (body.buttonResponseMessage.selectedDisplayText || body.buttonResponseMessage.message || "");
      } else if (body.buttonsResponseMessage) {
        content = "[Botão] " + (body.buttonsResponseMessage.selectedDisplayText || body.buttonsResponseMessage.message || "");
      } else if (body.listResponseMessage) {
        content = "[Opção] " + (body.listResponseMessage.title || "");
      } else if (body.message) {
         content = body.message; // fallback
      }

      const messageId = body.messageId || `msg_${Date.now()}`;
      const isFromMe = body.fromMe === true || body.fromMe === 'true';

      // Verificar se o chat já existe
      const { data: existingChat } = await supabase
        .from('whatsapp_chats')
        .select('id, last_message_time, unread_count')
        .eq('phone', phone)
        .maybeSingle();

      const isNewChat = !existingChat;
      const isInactive = existingChat?.last_message_time 
        ? (new Date().getTime() - new Date(existingChat.last_message_time).getTime()) > 24 * 60 * 60 * 1000 
        : true;
      const shouldSendWelcome = isNewChat || isInactive;

      // Incrementar contador apenas se a mensagem for recebida (não for fromMe)
      const newUnreadCount = isFromMe ? 0 : ((existingChat?.unread_count || 0) + 1);

      // A. Garantir que o Chat existe
      const { data: chat, error: chatError } = await supabase
        .from('whatsapp_chats')
        .upsert({ 
          phone: phone,
          name: name,
          last_message: content,
          last_message_time: new Date().toISOString(),
          unread_count: newUnreadCount,
          updated_at: new Date().toISOString()
        }, { onConflict: 'phone' })
        .select()
        .single()

      if (chatError) {
        console.error("Erro ao gerenciar chat:", chatError);
        throw chatError;
      }

      // Evitar duplicação de mensagens lendo message_id
      const { data: existingMsg } = await supabase
        .from('whatsapp_messages')
        .select('id')
        .eq('message_id', messageId)
        .maybeSingle();

      if (!existingMsg) {
        // B. Salvar a Mensagem
        const { error: msgError } = await supabase
          .from('whatsapp_messages')
          .insert({
            chat_id: chat.id,
            message_id: messageId,
            content: content,
            type: body.type || 'text',
            sender: isFromMe ? 'manager' : 'client',
            status: isFromMe ? 'sent' : 'received',
            metadata: body
          })

        if (msgError) {
          console.error("Erro ao salvar mensagem:", msgError);
          throw msgError;
        }
      }

      // C. Enviar mensagem de boas-vindas se necessário e se a msg NÃO for fromMe
      if (shouldSendWelcome && !isFromMe) {
        const { data: config } = await supabase
          .from('whatsapp_config')
          .select('instance_id, token, client_token, welcome_active, welcome_message')
          .limit(1)
          .maybeSingle();

        if (config?.welcome_active && config.instance_id && config.token) {
          const welcomeText = config.welcome_message || "Olá! Obrigado por entrar em contato. Em breve responderemos.";
          
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
                phone,
                message: welcomeText
              })
            });

            if (response.ok) {
              const zapiData = await response.json();
              
              // Salva a mensagem de boas-vindas enviada no banco
              await supabase
                .from('whatsapp_messages')
                .insert({
                  chat_id: chat.id,
                  message_id: zapiData.messageId,
                  content: welcomeText,
                  type: 'text',
                  sender: 'manager',
                  status: 'sent',
                  metadata: zapiData
                });

              // Atualiza o último status do chat com a mensagem de boas-vindas
              await supabase
                .from('whatsapp_chats')
                .update({
                  last_message: welcomeText,
                  last_message_time: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                })
                .eq('id', chat.id);
            } else {
              console.error("Erro ao enviar boas-vindas via Z-API:", await response.text());
            }
          } catch (zapiErr) {
            console.error("Erro na comunicação Z-API para boas-vindas:", zapiErr);
          }
        }
      }
      // D. Lógica de Atualização de Status via Botões (Orçamento / Avaliação)
      const btnId = body.buttonResponseMessage?.selectedButtonId || 
                    body.buttonResponseMessage?.buttonId ||
                    body.buttonsResponseMessage?.selectedButtonId ||
                    body.buttonsResponseMessage?.buttonId ||
                    body.listResponseMessage?.selectedRowId ||
                    body.listResponseMessage?.listItemId ||
                    body.buttonReply?.id ||
                    body.listResponse?.id ||
                    body.button?.id;
      
      if (btnId) {
        if (btnId.startsWith('ACEITAR_SUG_') || btnId.startsWith('ACEITAR_ORIG_')) {
          const isSuggested = btnId.startsWith('ACEITAR_SUG_');
          const ticketId = btnId.replace('ACEITAR_SUG_', '').replace('ACEITAR_ORIG_', '');
          
          try {
            const { data: ticketInfo } = await supabase
              .from('chaves')
              .select(`
                  cliente,
                  profissional,
                  orcamentos (*),
                  planejamento (*)
              `)
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
            console.error("Erro ao atualizar orcamento/agenda via botão:", err);
          }

          const { error: chavesError } = await supabase
            .from('chaves')
            .update({ status: 'aprovado' })
            .eq('id', ticketId);
            
          if (chavesError) {
            console.error("Erro ao aprovar chave via botão:", chavesError);
          } else {
            let phoneStr = String(body.phone || '');
            if (phoneStr.includes('@')) phoneStr = phoneStr.split('@')[0];
            await sendZApiMessage(phoneStr, "✅ Orçamento aceito com sucesso! Em breve o profissional iniciará a execução do serviço.");
          }
        } else if (btnId.startsWith('RECUSAR_')) {
          const ticketId = btnId.replace('RECUSAR_', '');
          const { error: chavesError } = await supabase
            .from('chaves')
            .update({ 
                status: 'recusado',
                whatsapp_chat_id: chat.id 
            })
            .eq('id', ticketId);
            
          if (chavesError) {
            console.error("Erro ao recusar chave via botão:", chavesError);
          } else {
            let phoneStr = String(body.phone || '');
            if (phoneStr.includes('@')) phoneStr = phoneStr.split('@')[0];
            await sendZApiMessage(phoneStr, "❌ O orçamento foi recusado.\n\nPor favor, digite o motivo da recusa para que nosso gestor possa avaliar uma renegociação:");
          }
          // Lógica de avaliação pode ser implementada aqui se necessário
        }
      } else if (!isFromMe) {
        // E. Lógica para salvar motivo de recusa (texto livre)
        let msgText = "";
        if (body.text) msgText = typeof body.text === 'object' ? body.text.message : body.text;
        else if (body.message) msgText = body.message;

        if (msgText && chat.id) {
            const { data: rejectedTickets } = await supabase
              .from('chaves')
              .select('id, motivo_recusa')
              .eq('status', 'recusado')
              .eq('whatsapp_chat_id', chat.id)
              .is('motivo_recusa', null)
              .order('created_at', { ascending: false })
              .limit(1);

            if (rejectedTickets && rejectedTickets.length > 0) {
               const tk = rejectedTickets[0];
               await supabase.from('chaves').update({ motivo_recusa: msgText }).eq('id', tk.id);
               
               let phoneStr = String(body.phone || '');
               if (phoneStr.includes('@')) phoneStr = phoneStr.split('@')[0];
               await sendZApiMessage(phoneStr, "✅ Obrigado! Sua justificativa foi salva e enviada ao nosso gestor para reavaliação.");
            }
        }
      }
    }

    // --- LOGICA PARA ATUALIZAÇÃO DE STATUS (LIDA/ENTREGUE) ---
    if (isStatusUpdate) {
      const statusMap: Record<string, string> = {
        'RECEIVED': 'received',
        'SENDING': 'sending',
        'SENT': 'sent',
        'DELIVERED': 'delivered',
        'READ': 'read'
      }

      const updatePayload: any = { status: statusMap[body.status] || body.status }
      
      if (body.status === 'READ') {
        updatePayload.read_at = new Date().toISOString()
      }

      const { error: updateError } = await supabase
        .from('whatsapp_messages')
        .update(updatePayload)
        .eq('message_id', body.messageId)
        
      if (updateError) {
        console.error("Erro ao atualizar status:", updateError);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error("Erro no Webhook:", error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
