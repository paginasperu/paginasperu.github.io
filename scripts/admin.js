import { getSupabaseClient, isSupabaseConfigured } from "./supabase-client.js";

const $ = (selector) => document.querySelector(selector);
const loginView = $("#login-view");
const appView = $("#app-view");
const loginForm = $("#login-form");
const loginMessage = $("#login-message");
const list = $("#record-list");
const detail = $("#detail-pane");
const state = { client: null, profiles: [], selectedId: null, status: "Todos", category: "Todas", district: "", verified: false, featured: false, search: "", busy: false };
let toastTimer;

function setMessage(text, isError = true) {
  loginMessage.textContent = text;
  loginMessage.classList.toggle("is-error", isError);
}

function showToast(text) {
  const toast = $("#toast");
  toast.textContent = text;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2800);
}

function setBusy(busy) {
  state.busy = busy;
  document.querySelectorAll("button, input, select, textarea").forEach((control) => {
    if (control.id !== "search") control.disabled = busy;
  });
}

function statusClass(value) {
  return String(value || "inactivo").toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function fullName(record) {
  return [record.nombres, record.apellidos].filter(Boolean).join(" ");
}

function safeImageUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && url.hostname === "res.cloudinary.com" && url.pathname.startsWith("/dahrgg4v5/image/upload/")) return url.href;
  } catch { /* La imagen se presenta como texto cuando no es una URL válida. */ }
  return "";
}

function buildPhoto(url, name, large = false) {
  const wrapper = document.createElement("span");
  wrapper.className = large ? "detail-photo" : "record-photo";
  const safeUrl = safeImageUrl(url);
  if (safeUrl) {
    const img = document.createElement("img");
    img.src = safeUrl;
    img.alt = name ? `Foto de ${name}` : "Foto del perfil";
    img.loading = "lazy";
    img.referrerPolicy = "no-referrer";
    wrapper.append(img);
  } else wrapper.textContent = name.split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toLocaleUpperCase("es");
  return wrapper;
}

function filteredProfiles() {
  const terms = state.search.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
  return state.profiles.filter((record) => {
    if (state.status !== "Todos" && record.estado !== state.status) return false;
    if (state.category !== "Todas" && record.categoria !== state.category) return false;
    if (state.district && record.distrito !== state.district) return false;
    if (state.verified && !record.es_verificado) return false;
    if (state.featured && !record.es_destacado) return false;
    if (!terms) return true;
    const searchable = [record.id, record.nombres, record.apellidos, record.distrito, record.provincia, record.departamento, record.categoria, record.whatsapp_interno, record.correo]
      .join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
    return terms.split(/\s+/).every((term) => searchable.includes(term));
  }).sort((a, b) => {
    const order = $("#sort").value;
    if (order === "name") return fullName(a).localeCompare(fullName(b), "es");
    return order === "oldest" ? Number(a.id) - Number(b.id) : Number(b.id) - Number(a.id);
  });
}

function renderCounts() {
  const values = { Todos: state.profiles.length, Pendiente: 0, Activo: 0, Rechazado: 0, Inactivo: 0 };
  state.profiles.forEach((profile) => { if (Object.hasOwn(values, profile.estado)) values[profile.estado] += 1; });
  document.querySelectorAll("[data-count]").forEach((item) => { item.textContent = values[item.dataset.count] ?? 0; });
}

function renderList() {
  const records = filteredProfiles();
  $("#result-count").textContent = `${records.length} ${records.length === 1 ? "perfil" : "perfiles"} · ${state.status === "Todos" ? "Todos los registros" : state.status}`;
  list.replaceChildren();
  if (!records.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const title = document.createElement("strong");
    title.textContent = "No hay perfiles con estos filtros";
    empty.append(title, document.createTextNode("Prueba otra búsqueda o limpia los filtros."));
    list.append(empty);
    if (state.selectedId && !state.profiles.some((record) => String(record.id) === String(state.selectedId))) renderEmptyDetail();
    return;
  }
  records.forEach((record) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `record-card${String(record.id) === String(state.selectedId) ? " is-selected" : ""}`;
    button.setAttribute("aria-pressed", String(String(record.id) === String(state.selectedId)));
    const name = fullName(record);
    button.append(buildPhoto(record.foto_perfil, name));
    const main = document.createElement("span"); main.className = "record-main";
    const title = document.createElement("span"); title.className = "record-name"; title.textContent = name || "Perfil sin nombre";
    const meta = document.createElement("span"); meta.className = "record-meta"; meta.textContent = [record.categoria, record.distrito, record.provincia].filter(Boolean).join(" · ");
    const id = document.createElement("span"); id.className = "record-tag"; id.textContent = `ID #${record.id}${record.es_demo ? " · DEMO" : ""}`;
    main.append(title, meta, id);
    const status = document.createElement("span"); status.className = `status-pill status-${statusClass(record.estado)}`; status.textContent = record.estado || "Inactivo";
    button.append(main, status);
    button.addEventListener("click", () => selectRecord(record.id));
    list.append(button);
  });
}

function renderEmptyDetail() {
  detail.innerHTML = '<div class="detail-empty"><span>▤</span><strong>Selecciona un perfil</strong><p>Su información y las acciones de revisión aparecerán aquí</p></div>';
}

function addField(container, label, value, wide = false) {
  const wrapper = document.createElement("div"); wrapper.className = `field${wide ? " full" : ""}`;
  const heading = document.createElement("span"); heading.className = "field-label"; heading.textContent = label;
  const content = document.createElement("div"); content.className = "field-value";
  const safeUrl = typeof value === "string" ? safeImageUrl(value) : "";
  if ((label === "Foto de perfil" || label === "Imagen de portada") && safeUrl) {
    const anchor = document.createElement("a"); anchor.href = safeUrl; anchor.target = "_blank"; anchor.rel = "noopener noreferrer"; anchor.textContent = "Abrir imagen ↗";
    const image = document.createElement("img"); image.src = safeUrl; image.alt = label; image.loading = "lazy"; image.referrerPolicy = "no-referrer";
    content.append(anchor, image);
  } else if (label === "Portafolio" && value) {
    try { const url = new URL(value); if (url.protocol === "https:" && !url.username && !url.password) { const anchor = document.createElement("a"); anchor.href = url.href; anchor.target = "_blank"; anchor.rel = "noopener noreferrer"; anchor.textContent = "Abrir portafolio ↗"; content.append(anchor); } else content.textContent = String(value); }
    catch { content.textContent = String(value); }
  } else content.textContent = value === null || value === undefined || value === "" ? "—" : String(value);
  wrapper.append(heading, content); container.append(wrapper);
}

function renderDetail(record) {
  if (!record) { renderEmptyDetail(); return; }
  const heading = document.createElement("header"); heading.className = "detail-head";
  const name = fullName(record);
  heading.append(buildPhoto(record.foto_perfil, name, true));
  const title = document.createElement("div"); title.className = "detail-heading";
  const h2 = document.createElement("h2"); h2.textContent = name || "Perfil sin nombre";
  const subtitle = document.createElement("p"); subtitle.textContent = [record.categoria, record.distrito, record.provincia].filter(Boolean).join(" · ");
  const id = document.createElement("span"); id.className = "detail-id"; id.textContent = `Perfil #${record.id}${record.es_demo ? " · Demostración" : ""}`;
  title.append(h2, subtitle, id);
  const pill = document.createElement("span"); pill.className = `status-pill status-${statusClass(record.estado)}`; pill.textContent = record.estado || "Inactivo";
  heading.append(title, pill);
  const fields = document.createElement("div"); fields.className = "detail-fields";
  [
    ["Categoría", record.categoria], ["Distrito", record.distrito], ["Provincia", record.provincia], ["Departamento", record.departamento],
    ["WhatsApp público", record.whatsapp_publico], ["WhatsApp privado", record.whatsapp_interno], ["Correo de gestión", record.correo], ["Portafolio", record.portafolio_url],
    ["Instagram", record.instagram_usuario], ["LinkedIn", record.linkedin_usuario], ["Behance", record.behance_usuario], ["Descripción corta", record.descripcion_corta, true],
    ["Descripción larga", record.descripcion_larga, true], ["Productos y servicios", record.productos_servicios, true], ["Experiencia", record.nivel_experiencia], ["Nivel de precios", record.nivel_precio],
    ["Fecha de registro", record.fecha_registro ? new Date(record.fecha_registro).toLocaleString("es-PE") : "—"], ["Aceptó privacidad", record.acepta_privacidad ? "Sí" : "No"],
    ["Foto de perfil", record.foto_perfil, true], ["Imagen de portada", record.imagen_portada, true],
  ].forEach(([label, value, wide]) => addField(fields, label, value, wide));

  const management = document.createElement("section"); management.className = "manage-section";
  management.innerHTML = '<h3 class="manage-title">REVISIÓN Y PUBLICACIÓN</h3><div class="manage-controls"><label class="manage-control">Estado<select id="edit-status"><option>Pendiente</option><option>Activo</option><option>Rechazado</option><option>Inactivo</option></select></label><label class="manage-control">Posición en el directorio<input id="edit-position" type="number" min="1" step="1" inputmode="numeric" placeholder="Opcional"></label><label class="manage-control notes">Notas internas<textarea id="edit-notes" maxlength="2000" placeholder="Solo para administración"></textarea></label></div><div class="manage-checks"><label><input id="edit-verified" type="checkbox"> Verificado</label><label><input id="edit-featured" type="checkbox"> Destacado</label></div>';
  const actions = document.createElement("div"); actions.className = "detail-actions";
  actions.innerHTML = '<button class="button reject" type="button" id="reject">Rechazar</button><button class="button secondary" type="button" id="save">Guardar</button><button class="button approve" type="button" id="approve">Aprobar y siguiente</button>';
  detail.replaceChildren(heading, fields, management, actions);
  $("#edit-status").value = record.estado || "Pendiente";
  $("#edit-position").value = record.posicion ?? "";
  $("#edit-notes").value = record.notas || "";
  $("#edit-verified").checked = Boolean(record.es_verificado);
  $("#edit-featured").checked = Boolean(record.es_destacado);
  $("#save").addEventListener("click", () => saveRecord());
  $("#approve").addEventListener("click", () => saveRecord("Activo", true));
  $("#reject").addEventListener("click", () => saveRecord("Rechazado", true));
}

function selectRecord(id) {
  state.selectedId = String(id);
  const record = state.profiles.find((item) => String(item.id) === state.selectedId);
  renderList();
  renderDetail(record);
}

async function saveRecord(forceStatus = "", advance = false) {
  if (state.busy || !state.selectedId) return;
  const positionValue = $("#edit-position").value.trim();
  if (positionValue && (!/^\d+$/.test(positionValue) || Number(positionValue) < 1)) { showToast("La posición debe ser un entero positivo"); $("#edit-position").focus(); return; }
  const update = {
    estado: forceStatus || $("#edit-status").value,
    es_verificado: $("#edit-verified").checked,
    es_destacado: $("#edit-featured").checked,
    posicion: positionValue ? Number(positionValue) : null,
    notas: $("#edit-notes").value.trim(),
  };
  if (update.notas.length > 2000) { showToast("Las notas superan el máximo permitido"); return; }
  const index = filteredProfiles().findIndex((record) => String(record.id) === state.selectedId);
  setBusy(true);
  try {
    const { data, error } = await state.client.from("profiles").update(update).eq("id", Number(state.selectedId)).select("*").single();
    if (error) throw error;
    const at = state.profiles.findIndex((record) => String(record.id) === state.selectedId);
    if (at >= 0) state.profiles[at] = data;
    const nextRecords = filteredProfiles();
    state.selectedId = advance && nextRecords.length ? String(nextRecords[Math.min(Math.max(index, 0), nextRecords.length - 1)].id) : state.selectedId;
    renderCounts(); renderList();
    renderDetail(state.profiles.find((record) => String(record.id) === state.selectedId));
    showToast(`Perfil #${data.id} guardado`);
  } catch (error) {
    showToast(`No se guardó: ${error.message || "revisa tu conexión y permisos"}`);
  } finally { setBusy(false); }
}

function applyFilters() {
  renderList();
  if (state.selectedId) renderDetail(state.profiles.find((record) => String(record.id) === state.selectedId));
}

async function loadProfiles() {
  setBusy(true);
  list.innerHTML = '<div class="loading">Cargando perfiles…</div>';
  try {
    const { data, error } = await state.client.from("profiles").select("*").order("id", { ascending: true }).limit(1000);
    if (error) throw error;
    state.profiles = data || [];
    const districts = [...new Set(state.profiles.map((profile) => profile.distrito).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
    $("#district").replaceChildren(new Option("Todos los distritos", ""), ...districts.map((district) => new Option(district, district)));
    renderCounts();
    if (state.selectedId && state.profiles.some((record) => String(record.id) === state.selectedId)) applyFilters();
    else { state.selectedId = state.profiles[0] ? String(state.profiles[0].id) : null; renderList(); renderDetail(state.profiles[0]); }
    $("#connection-status").textContent = "Conectado a Supabase";
  } catch (error) {
    list.innerHTML = `<div class="error-state">No se pudo consultar el directorio. Comprueba la configuración y las políticas de acceso de Supabase.<br>${escapeHtml(error.message || "Error de conexión")}</div>`;
    $("#connection-status").textContent = "Sin conexión";
    renderEmptyDetail();
  } finally { setBusy(false); }
}

function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]); }

function toCsv(records) {
  const columns = ["id", "nombres", "apellidos", "departamento", "provincia", "distrito", "whatsapp_publico", "portafolio_url", "instagram_usuario", "linkedin_usuario", "behance_usuario", "categoria", "descripcion_corta", "descripcion_larga", "productos_servicios", "nivel_experiencia", "nivel_precio", "foto_perfil", "imagen_portada", "es_verificado", "es_destacado", "posicion"];
  return "\uFEFF" + [columns, ...records.map((record) => columns.map((column) => record[column] ?? ""))]
    .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\r\n");
}

async function exportPublicCsv() {
  setBusy(true);
  try {
    const { data, error } = await state.client.from("directory_public_profiles").select("*").order("id", { ascending: true });
    if (error) throw error;
    const url = URL.createObjectURL(new Blob([toCsv(data || [])], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "perfiles.csv"; link.click(); URL.revokeObjectURL(url);
    showToast("CSV de perfiles activos descargado");
  } catch (error) { showToast(`No se pudo exportar: ${error.message || "error de conexión"}`); }
  finally { setBusy(false); }
}

async function enterApplication(session) {
  if (!session?.user) { loginView.hidden = false; appView.hidden = true; return; }
  const { data: membership, error } = await state.client.from("admin_users").select("user_id").eq("user_id", session.user.id).maybeSingle();
  if (error || !membership) {
    await state.client.auth.signOut();
    loginView.hidden = false; appView.hidden = true;
    setMessage("Esta cuenta no tiene permiso para administrar el directorio.");
    return;
  }
  loginView.hidden = true; appView.hidden = false;
  $("#account-email").textContent = session.user.email || "Administrador";
  $("#account-initial").textContent = (session.user.email || "A").slice(0, 1).toLocaleUpperCase("es");
  $("#connection-status").textContent = "Conectado a Supabase";
  await loadProfiles();
}

async function initialize() {
  if (!isSupabaseConfigured()) {
    setMessage("El panel ya está preparado, pero falta enlazarlo al proyecto Supabase correcto.");
    loginForm.querySelectorAll("input,button").forEach((control) => { control.disabled = true; });
    return;
  }
  try { state.client = getSupabaseClient(); }
  catch (error) { setMessage(error.message); return; }
  const { data: { session }, error } = await state.client.auth.getSession();
  if (error) setMessage(error.message);
  await enterApplication(session);
  state.client.auth.onAuthStateChange((_event, nextSession) => { void enterApplication(nextSession); });
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.client) return;
  setMessage("Validando acceso…", false);
  const values = new FormData(loginForm);
  const { data, error } = await state.client.auth.signInWithPassword({ email: String(values.get("email")).trim(), password: String(values.get("password")) });
  if (error) { setMessage("No se pudo iniciar sesión. Revisa el correo y la contraseña."); return; }
  setMessage("");
  await enterApplication(data.session);
});

$("#sign-out").addEventListener("click", async () => { await state.client?.auth.signOut(); loginView.hidden = false; appView.hidden = true; loginForm.reset(); });
$("#search").addEventListener("input", (event) => { state.search = event.target.value.trim(); applyFilters(); });
$("#district").addEventListener("change", (event) => { state.district = event.target.value; applyFilters(); });
$("#verified").addEventListener("change", (event) => { state.verified = event.target.checked; applyFilters(); });
$("#featured").addEventListener("change", (event) => { state.featured = event.target.checked; applyFilters(); });
$("#sort").addEventListener("change", applyFilters);
document.querySelectorAll("[data-status]").forEach((button) => button.addEventListener("click", () => { state.status = button.dataset.status; document.querySelectorAll("[data-status]").forEach((item) => item.classList.toggle("is-active", item === button)); applyFilters(); }));
document.querySelectorAll("[data-category]").forEach((button) => button.addEventListener("click", () => { state.category = button.dataset.category; document.querySelectorAll("[data-category]").forEach((item) => item.classList.toggle("is-active", item === button)); applyFilters(); }));
$("#clear-filters").addEventListener("click", () => { state.status = "Todos"; state.category = "Todas"; state.district = ""; state.verified = false; state.featured = false; state.search = ""; $("#search").value = ""; $("#district").value = ""; $("#verified").checked = false; $("#featured").checked = false; document.querySelectorAll("[data-status]").forEach((item) => item.classList.toggle("is-active", item.dataset.status === "Todos")); document.querySelectorAll("[data-category]").forEach((item) => item.classList.toggle("is-active", item.dataset.category === "Todas")); applyFilters(); });
$("#refresh").addEventListener("click", () => { void loadProfiles(); });
$("#export-csv").addEventListener("click", () => { void exportPublicCsv(); });
$("#mobile-nav").addEventListener("click", () => $("#sidebar").classList.toggle("is-open"));
document.addEventListener("click", (event) => { if (event.target.closest("[data-status]")) $("#sidebar").classList.remove("is-open"); });
document.addEventListener("keydown", (event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "k") { event.preventDefault(); $("#search").focus(); } if (event.key === "Escape") $("#sidebar").classList.remove("is-open"); });

void initialize();
