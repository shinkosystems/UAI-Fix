import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from('chaves').update({ relato_problema: "test", status: 'erro' }).eq('id', 0).select();
  console.log("Error:", error ? error.message : "None");
}
check();
