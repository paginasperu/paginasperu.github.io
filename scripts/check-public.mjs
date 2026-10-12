import assert from "node:assert/strict";
import fs from "node:fs";
import { mapPublicProfile } from "./profile-mapper.js";

const schema = fs.readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const sample = mapPublicProfile({
  id: 42, nombres: "Ana", apellidos: "Prueba", departamento: "LIMA", provincia: "LIMA",
  distrito: "MIRAFLORES", categoria: "Diseñadores gráficos", whatsapp_publico: "51900000000",
  correo: "privado@example.test", whatsapp_interno: "51911111111", notas: "nota privada",
  estado: "Activo", es_demo: true, es_verificado: false, es_destacado: true, posicion: 2,
  portafolio_url: "https://www.instagram.com/prueba", foto_perfil: "https://res.cloudinary.com/dahrgg4v5/image/upload/profile.jpg",
}, 0);
assert.equal(sample.id, 42);
assert.equal(sample.demo, true);
assert.equal(sample.searchText.includes("ana prueba"), true);
for (const privateField of ["correo", "whatsapp_interno", "notas", "fecha_nacimiento", "genero", "acepta_privacidad"]) {
  assert.equal(Object.hasOwn(sample, privateField), false, `${privateField} no debe formar parte del perfil público`);
}
assert.match(schema, /where estado\s*=\s*'Activo'/i, "la vista pública filtra solicitudes no aprobadas");
assert.match(schema, /es_demo/, "la marca de demostración reside en Supabase");
assert.match(schema, /create or replace view public\.directory_public_profiles/i, "la publicación usa una vista explícita de columnas públicas");
console.log("Perfil público: campos, marca demo y filtros de publicación comprobados sin depender del CSV antiguo.");
