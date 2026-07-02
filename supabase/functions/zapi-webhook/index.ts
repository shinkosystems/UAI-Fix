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

    // 1. Identificar o tipo de evento
    // Z-API envia o tipo no corpo ou podemos inferir pelos campos
    const isMessage = body.text || body.image || body.audio || body.video;
    const isStatusUpdate = body.status && body.messageId;

    // --- LOGICA PARA NOVA MENSAGEM RECEBIDA ---
    if (isMessage) {
      const phone = body.phone;
      const name = body.senderName || "Cliente WhatsApp";
      const content = body.text?.message || "[Arquivo/Mídia]";
      const messageId = body.messageId;

      // Verificar se o chat já existe para saber se é o primeiro contato ou se está inativo
      const { data: existingChat } = await supabase
        .from('whatsapp_chats')
        .select('id, last_message_time')
        .eq('phone', phone)
        .maybeSingle();

      const isNewChat = !existingChat;
      const isInactive = existingChat?.last_message_time 
        ? (new Date().getTime() - new Date(existingChat.last_message_time).getTime()) > 24 * 60 * 60 * 1000 
        : true;
      const shouldSendWelcome = isNewChat || isInactive;

      // A. Garantir que o Chat existe
      const { data: chat, error: chatError } = await supabase
        .from('whatsapp_chats')
        .upsert({ 
          phone: phone,
          name: name,
          last_message: content,
          last_message_time: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'phone' })
        .select()
        .single()

      if (chatError) {
        console.error("Erro ao gerenciar chat:", chatError);
        throw chatError;
      }

      // B. Salvar a Mensagem
      const { error: msgError } = await supabase
        .from('whatsapp_messages')
        .insert({
          chat_id: chat.id,
          message_id: messageId,
          content: content,
          type: body.type || 'text',
          sender: 'client',
          status: 'received',
          metadata: body
        })

      if (msgError) {
        console.error("Erro ao salvar mensagem:", msgError);
        throw msgError;
      }

      // C. Enviar mensagem de boas-vindas se necessário
      if (shouldSendWelcome) {
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
