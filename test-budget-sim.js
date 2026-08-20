import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

async function simulateBudgetTest() {
  const { data: config } = await supabase.from('whatsapp_config').select('*').limit(1).maybeSingle();
  if (!config) {
    console.error('WhatsApp config not found in DB');
    return;
  }

  const headers = { 'Content-Type': 'application/json' };
  if (config.client_token) headers['client-token'] = config.client_token;

  let phone = '31982480790';
  if (phone.length === 10 || phone.length === 11) phone = '55' + phone;

  console.log('Enviando mensagem de simulação de orçamento para:', phone);

  const message = "Olá! Seu orçamento na UaiFix está pronto (Simulação).\n\nOnde você prefere avaliá-lo?";
  
  const res = await fetch(`https://api.z-api.io/instances/${config.instance_id}/token/${config.token}/send-text`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ 
      phone, 
      message: `${message}\n\n1️⃣ Aprovar pelo WhatsApp\n2️⃣ Acessar pelo App` 
    })
  });

  const resultText = await res.text();
  console.log('Z-API Response status:', res.status);
  console.log('Z-API Response body:', resultText);
}

simulateBudgetTest();
