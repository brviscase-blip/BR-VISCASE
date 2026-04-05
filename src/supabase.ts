/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórios. Por favor, configure-os nas configurações do projeto.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: { schema: 'BR_Gestão_de_Contratos' }
});
