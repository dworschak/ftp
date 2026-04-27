import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn('[Supabase] VITE_SUPABASE_URL oder VITE_SUPABASE_PUBLISHABLE_KEY fehlt – remote sync deaktiviert.');
}

export const supabase = createClient(SUPABASE_URL ?? '', SUPABASE_KEY ?? '');
export const supabaseAvailable = !!(SUPABASE_URL && SUPABASE_KEY);
