import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

async function testWa() {
  const { data: config } = await supabase.from('whatsapp_config').select('*').limit(1).maybeSingle()
  console.log('Config:', config)
  
  if (!config) return
  
  const headers = { 'Content-Type': 'application/json' }
  if (config.client_token) headers['client-token'] = config.client_token
  
  let phone = '3185858264'
  if (phone.length === 10 || phone.length === 11) phone = '55' + phone
  
  console.log('Sending to:', phone)
  
  const res = await fetch(`https://api.z-api.io/instances/${config.instance_id}/token/${config.token}/send-text`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ phone, message: 'Teste via UaiFix DB' })
  })
  
  console.log('Response:', res.status, await res.text())
}

testWa()
