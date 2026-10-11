import assert from "node:assert/strict";
import { resolveProfileContact } from "./profile-contact.js";

const profile = { nombres: "Ana", apellidos: "Pérez", whatsapp: "51987654321" };
assert.deepEqual(resolveProfileContact(profile, "51950141414"), {
  number: "51987654321",
  note: "",
  message: "Hola Ana, vi tu perfil y quisiera más información.",
});

assert.deepEqual(resolveProfileContact({ ...profile, whatsapp: "" }, "950 141 414"), {
  number: "950141414",
  note: "Contacto a través de nuestra agencia",
  message: "Hola, quisiera información sobre Ana Pérez que vi en el directorio.",
});

assert.equal(resolveProfileContact({ ...profile, whatsapp: "", demo: true }, "51950141414"), null);
assert.equal(resolveProfileContact({ ...profile, whatsapp: "" }, ""), null);
console.log("Contacto: respeta el WhatsApp público, usa agencia como respaldo y oculta perfiles demo.");
