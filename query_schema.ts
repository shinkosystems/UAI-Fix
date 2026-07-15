import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || '');

async function run() {
  const { data } = await supabase
    .from('chaves')
    .select('id, cliente, status, motivo_recusa')
    .limit(1);
    
  const { data: users } = await supabase
    .from('users')
    .select('uuid, telefone')
    .limit(1);

  console.log('chaves', JSON.stringify(data));
  console.log('users', JSON.stringify(users));
}

run();
