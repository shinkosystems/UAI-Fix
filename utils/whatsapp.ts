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

export async function sendWhatsappText(phone: string, text: string) {
  try {
    const config = await getWhatsappConfig();
    if (!config || !config.instance_id || !config.token) {
      console.warn('WhatsApp not configured. Cannot send text.');
      return null;
    }

    // Clean phone number
    const cleanPhone = phone.replace(/\D/g, '');

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
    return data;
  } catch (error) {
    console.error('Error in sendWhatsappText:', error);
    return null;
  }
}

export async function sendWhatsappButtons(phone: string, text: string, buttons: any[]) {
  try {
    const config = await getWhatsappConfig();
    if (!config || !config.instance_id || !config.token) {
      console.warn('WhatsApp not configured. Cannot send buttons.');
      return null;
    }

    const cleanPhone = phone.replace(/\D/g, '');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (config.client_token) {
      headers['client-token'] = config.client_token;
    }

    const response = await fetch(`https://api.z-api.io/instances/${config.instance_id}/token/${config.token}/send-button`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        phone: cleanPhone,
        message: text,
        buttons: buttons
      })
    });

    if (!response.ok) {
      throw new Error(`Z-API returned status ${response.status}`);
    }

    const data = await response.json();
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

    const cleanPhone = phone.replace(/\D/g, '');

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
    return data;
  } catch (error) {
    console.error('Error in sendWhatsappOptionList:', error);
    return null;
  }
}
