// @sos-edit: false
import { supabase } from '../supabaseClient';

export async function getWhatsappConfig() {
  const { data, error } = await supabase
    .from('whatsapp_config')
    .select('*')
    .limit(1)
    .maybeSingle();
  if (error || !data) {
    console.error('WhatsApp config not found or error:', error);
    return null;
  }
  return data;
}

export async function saveOutgoingWhatsappMessage(phone: string, text: string, type: string = 'text', zapiData?: any) {
  try {
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length === 10 || cleanPhone.length === 11) {
      cleanPhone = `55${cleanPhone}`;
    }
    if (!cleanPhone) return;

    // Busca nome real do contato na tabela users se existir (cliente, gestor ou profissional)
    let contactName = `WhatsApp (${cleanPhone})`;
    const rawSearch = cleanPhone.slice(-8);
    const { data: foundUser } = await supabase
      .from('users')
      .select('nome')
      .ilike('whatsapp', `%${rawSearch}%`)
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
      const msgId = zapiData?.messageId || zapiData?.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      
      // Verifica duplicação antes de inserir
      const { data: existingMsg } = await supabase
        .from('whatsapp_messages')
        .select('id')
        .eq('message_id', msgId)
        .maybeSingle();

      if (!existingMsg) {
        await supabase.from('whatsapp_messages').insert({
          chat_id: chat.id,
          message_id: msgId,
          content: text,
          type: type,
          sender: 'manager',
          status: 'sent',
          metadata: zapiData || {}
        });
      }
    }
  } catch (err) {
    console.error('Erro ao salvar mensagem enviada no WhatsApp chat:', err);
  }
}

export async function sendWhatsappText(phone: string, text: string) {
  try {
    const config = await getWhatsappConfig();
    if (!config || !config.instance_id || !config.token) {
      console.warn('WhatsApp not configured. Cannot send text.');
      return null;
    }

    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length === 10 || cleanPhone.length === 11) {
      cleanPhone = `55${cleanPhone}`;
    }

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
        phone: cleanPhone,
        message: text
      })
    });

    if (!response.ok) {
      throw new Error(`Z-API returned status ${response.status}`);
    }

    const data = await response.json();
    await saveOutgoingWhatsappMessage(cleanPhone, text, 'text', data);
    return data;
  } catch (error) {
    console.error('Error in sendWhatsappText:', error);
    return null;
  }
}

export async function sendWhatsappButtons(phone: string, text: string, title: string, footer: string, buttons: any[]) {
  try {
    const config = await getWhatsappConfig();
    if (!config || !config.instance_id || !config.token) {
      console.warn('WhatsApp not configured. Cannot send buttons.');
      return null;
    }

    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length === 10 || cleanPhone.length === 11) {
      cleanPhone = `55${cleanPhone}`;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (config.client_token) {
      headers['client-token'] = config.client_token;
    }

    const response = await fetch(`https://api.z-api.io/instances/${config.instance_id}/token/${config.token}/send-button-list`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        phone: cleanPhone,
        message: text,
        title: title,
        footer: footer,
        buttonList: {
          buttons: buttons
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Z-API returned status ${response.status}`);
    }

    const data = await response.json();
    await saveOutgoingWhatsappMessage(cleanPhone, `${title ? title + '\n\n' : ''}${text}`, 'button', data);
    return data;
  } catch (error) {
    console.error('Error in sendWhatsappButtons:', error);
    return null;
  }
}

export async function sendWhatsappOptionList(phone: string, title: string, text: string, buttonText: string, sections: any[]) {
  try {
    const config = await getWhatsappConfig();
    if (!config || !config.instance_id || !config.token) {
      console.warn('WhatsApp not configured. Cannot send option list.');
      return null;
    }

    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length === 10 || cleanPhone.length === 11) {
      cleanPhone = `55${cleanPhone}`;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (config.client_token) {
      headers['client-token'] = config.client_token;
    }

    const response = await fetch(`https://api.z-api.io/instances/${config.instance_id}/token/${config.token}/send-option-list`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        phone: cleanPhone,
        title: title,
        message: text,
        buttonText: buttonText,
        sections: sections
      })
    });

    if (!response.ok) {
      throw new Error(`Z-API returned status ${response.status}`);
    }

    const data = await response.json();
    await saveOutgoingWhatsappMessage(cleanPhone, `${title ? title + '\n\n' : ''}${text}`, 'list', data);
    return data;
  } catch (error) {
    console.error('Error in sendWhatsappOptionList:', error);
    return null;
  }
}
