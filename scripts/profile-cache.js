export const PUBLIC_PROFILE_CACHE_KEY = "oficial:public-profiles:v1";
export const PUBLIC_PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;

function getStorage(storage) {
  if (storage) return storage;
  try { return globalThis.localStorage; }
  catch { return null; }
}

export function readPublicProfileCache(now = Date.now(), storage) {
  try {
    const source = getStorage(storage);
    if (!source) return null;
    const cached = JSON.parse(source.getItem(PUBLIC_PROFILE_CACHE_KEY) || "null");
    if (!Array.isArray(cached?.profiles) || !Number.isFinite(cached.savedAt)) return null;
    const age = now - cached.savedAt;
    if (age < 0 || age >= PUBLIC_PROFILE_CACHE_TTL_MS) return null;
    return { profiles: cached.profiles, savedAt: cached.savedAt };
  } catch {
    return null;
  }
}

export function writePublicProfileCache(profiles, savedAt = Date.now(), storage) {
  try {
    const source = getStorage(storage);
    if (!source || !Array.isArray(profiles)) return false;
    source.setItem(PUBLIC_PROFILE_CACHE_KEY, JSON.stringify({ savedAt, profiles }));
    return true;
  } catch {
    return false;
  }
}

export function invalidatePublicProfileCache(storage) {
  try {
    getStorage(storage)?.removeItem(PUBLIC_PROFILE_CACHE_KEY);
  } catch {
    // La consulta directa a Supabase sigue funcionando si el almacenamiento local falla.
  }
}
