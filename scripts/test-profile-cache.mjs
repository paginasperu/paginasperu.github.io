import assert from "node:assert/strict";
import {
  PUBLIC_PROFILE_CACHE_KEY,
  PUBLIC_PROFILE_CACHE_TTL_MS,
  invalidatePublicProfileCache,
  readPublicProfileCache,
  writePublicProfileCache,
} from "./profile-cache.js";

const data = new Map();
const storage = {
  getItem(key) { return data.get(key) ?? null; },
  setItem(key, value) { data.set(key, value); },
  removeItem(key) { data.delete(key); },
};
const profiles = [{ id: 1, nombres: "Perfil público" }];

assert.equal(writePublicProfileCache(profiles, 1000, storage), true);
assert.deepEqual(readPublicProfileCache(1000, storage), { profiles, savedAt: 1000 });
assert.ok(readPublicProfileCache(1000 + PUBLIC_PROFILE_CACHE_TTL_MS - 1, storage));
assert.equal(readPublicProfileCache(1000 + PUBLIC_PROFILE_CACHE_TTL_MS, storage), null);
assert.equal(readPublicProfileCache(999, storage), null, "una fecha futura no debe considerarse una caché válida");
invalidatePublicProfileCache(storage);
assert.equal(storage.getItem(PUBLIC_PROFILE_CACHE_KEY), null, "la actualización manual invalida la caché compartida del mismo navegador");
console.log("Caché pública local: TTL de 5 minutos, expiración e invalidación manual comprobados.");
