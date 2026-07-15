import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://uehyjyyvkrlggwmfdhgh.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVlaHlqeXl2a3JsZ2d3bWZkaGdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI0MDEzNzUsImV4cCI6MjA1Nzk3NzM3NX0.3CKTTryjia-5nXQYk1jJxPYryDmF1hTKpHrJkVKqRJY');

async function run() {
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select('metadata, content')
    .order('created_at', { ascending: false })
    .limit(3);

  if (error) console.error(error);
  else console.log(JSON.stringify(data, null, 2));
}

run();
