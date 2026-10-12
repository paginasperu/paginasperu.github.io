import { normalizeText } from "./search.js";

export function mapPublicProfile(record, sortOrder = 0) {
  const id = Number(record.id);
  const name = [record.nombres, record.apellidos].filter(Boolean).join(" ");
  const searchable = [name, record.categoria, record.descripcion_corta, record.descripcion_larga,
    record.productos_servicios, record.nivel_experiencia, record.nivel_precio, record.departamento,
    record.provincia, record.distrito, record.whatsapp_publico].filter(Boolean).join(" ");
  return {
    id,
    demo: Boolean(record.es_demo),
    nombres: record.nombres || "",
    apellidos: record.apellidos || "",
    departamento: record.departamento || "",
    provincia: record.provincia || "",
    distrito: record.distrito || "",
    whatsapp: record.whatsapp_publico || "",
    portafolio_url: record.portafolio_url || "",
    instagram_usuario: record.instagram_usuario || "",
    linkedin_usuario: record.linkedin_usuario || "",
    behance_usuario: record.behance_usuario || "",
    categoria: record.categoria || "",
    descripcion_corta: record.descripcion_corta || "",
    descripcion_larga: record.descripcion_larga || "",
    productos_servicios: record.productos_servicios || "",
    nivel_experiencia: record.nivel_experiencia || "",
    nivel_precio: record.nivel_precio || "",
    foto_perfil: record.foto_perfil || "",
    imagen_portada: record.imagen_portada || "",
    verificado: Boolean(record.es_verificado),
    destacado: Boolean(record.es_destacado),
    posicion: record.posicion == null ? null : Number(record.posicion),
    csvOrder: sortOrder,
    nameSearchText: normalizeText(name),
    searchText: normalizeText(searchable),
  };
}
