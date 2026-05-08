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
