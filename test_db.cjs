const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from('chaves').select('foto_problema').limit(1);
  console.log(error ? error.message : "Success. Data: " + JSON.stringify(data));
}
check();
