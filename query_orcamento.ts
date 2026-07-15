import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || '');
async function run() {
  const { data } = await supabase.from('orcamentos').select('*').eq('chave', 98);
  console.log('orcamentos', JSON.stringify(data, null, 2));
}
run();
