const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

async function testWa() {
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

  const resConfig = await fetch(`${supabaseUrl}/rest/v1/whatsapp_config?select=*`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  });
  const configList = await resConfig.json();
  console.log('Config List:', configList);

  const config = configList && configList[0];
  if (!config) {
    console.error('No whatsapp config found');
    return;
  }

  const headers = { 'Content-Type': 'application/json' };
  if (config.client_token) headers['client-token'] = config.client_token;
  
  let phone = '31982480790';
  if (phone.length === 10 || phone.length === 11) phone = '55' + phone;
  
  console.log('Sending simulation to:', phone);
  
  const res = await fetch(`https://api.z-api.io/instances/${config.instance_id}/token/${config.token}/send-text`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ 
      phone, 
      message: '🧪 *Simulação UaiFix - Orçamento Pronto*\n\nOlá! Seu orçamento foi gerado com sucesso.\n\nComo deseja prosseguir?\n1️⃣ Aprovar pelo WhatsApp\n2️⃣ Acessar pelo App' 
    })
  });
  
  console.log('Response:', res.status, await res.text());
}

testWa();
