import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || '');
async function run() {
  const { data, error } = await supabase
    .from('chaves')
    .select('id, orcamentos(*), planejamento(*)')
    .eq('id', 98)
    .maybeSingle();
  console.log('error', error);
  console.log('data', JSON.stringify(data, null, 2));
}
run();
