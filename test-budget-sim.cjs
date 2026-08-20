const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

async function simulateBudgetTest() {
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

  const configRes = await fetch(`${supabaseUrl}/rest/v1/whatsapp_config?select=*&limit=1`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });
  const configs = await configRes.json();
  const config = configs && configs[0];

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
