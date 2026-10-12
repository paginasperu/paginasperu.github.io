import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, supabaseReady } from "./supabase-config.js";

let client;

export function getSupabaseClient() {
  if (!supabaseReady) throw new Error("Falta configurar la URL y la clave publishable de Supabase.");
  if (!window.supabase?.createClient) throw new Error("No se pudo cargar el cliente oficial de Supabase.");
  if (!client) {
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storage: window.sessionStorage,
      },
    });
  }
  return client;
}

export function isSupabaseConfigured() {
  return supabaseReady;
}
