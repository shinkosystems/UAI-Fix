import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://uehyjyyvkrlggwmfdhgh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVlaHlqeXl2a3JsZ2d3bWZkaGdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI0MDEzNzUsImV4cCI6MjA1Nzk3NzM3NX0.3CKTTryjia-5nXQYk1jJxPYryDmF1hTKpHrJkVKqRJY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
