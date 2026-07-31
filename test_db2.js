const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from('chaves').select('id, status, relato_problema').order('id', { ascending: false }).limit(5);
  console.log("Data:", data);
  console.log("Error:", error);
}
check();
