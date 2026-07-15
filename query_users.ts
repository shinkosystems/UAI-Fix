import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || '');
async function run() {
  const { data } = await supabase.from('users').select('uuid, telefone, whatsapp').limit(5);
  console.log('users', JSON.stringify(data));
}
run();
