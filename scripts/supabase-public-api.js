import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js";
import { mapPublicProfile } from "./profile-mapper.js";

export async function fetchPublicProfiles(fetchImpl = globalThis.fetch) {
  const endpoint = new URL("/rest/v1/directory_public_profiles", SUPABASE_URL);
  endpoint.searchParams.set("select", "*");
  endpoint.searchParams.set("order", "id.asc");

  const response = await fetchImpl(endpoint, {
    cache: "no-store",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      Accept: "application/json",
    },
  });

  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const reason = data?.message || data?.error || `HTTP ${response.status}`;
    throw new Error(`No se pudo cargar el directorio (${reason}).`);
  }
  if (!Array.isArray(data)) throw new Error("Supabase devolvió una respuesta inválida para el directorio.");

  return data.map(mapPublicProfile);
}
