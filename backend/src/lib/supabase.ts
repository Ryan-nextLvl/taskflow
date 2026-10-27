import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types.js';

export type TaskflowDatabase = SupabaseClient<Database>;

/**
 * Cliente do Supabase usado SOMENTE no servidor. A chave secreta ignora RLS,
 * por isso nunca é enviada ao navegador nem registrada em logs.
 */
export function createSupabaseClient(url: string, secretKey: string): TaskflowDatabase {
  return createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { 'x-application-name': 'taskflow-api' } },
  });
}
