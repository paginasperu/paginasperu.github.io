// La URL y la clave publishable de Supabase pueden estar en el frontend.
// Nunca agregues aquí una secret key ni una service_role key.
export const SUPABASE_URL = "https://vhsocvvjquikjtmqbkwx.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoc29jdnZqcXVpa2p0bXFia3d4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyNTQ4MTcsImV4cCI6MjEwNjgzMDgxN30.Qy43V4MYEbjJyXgys-mztQqeM6bZ8og2t4ymcrvSi64";

export const supabaseReady = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
