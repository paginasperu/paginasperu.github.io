import SITE_CONFIG from "./config.js?v=20261010-4";

const PROFILES_PER_PAGE = 6;
const LOAD_DELAY = 350;
const PROFILE_REFRESH_INTERVAL = 5 * 60 * 1000;
const FAVORITES_STORAGE_KEY = "directorio-creativo:favorites:v1";
const PROFILE_PLACEHOLDER = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 1200"><rect width="900" height="1200" fill="#eeeae4"/><circle cx="450" cy="380" r="145" fill="#c8beb2"/><path fill="#b2a69a" d="M185 1200c18-282 112-446 265-446s247 164 265 446Z"/></svg>');
const SOCIAL_HOSTS = {
  behance: new Set(["behance.net", "www.behance.net"]),
  instagram: new Set(["instagram.com", "www.instagram.com"]),
  linkedin: new Set(["linkedin.com", "www.linkedin.com"]),
  canva: new Set(["canva.com", "www.canva.com"]),
};

let profiles = [];
let profilesCsvSnapshot = "";
let refreshingProfiles = false;

const elements = {
  title: document.querySelector("#directory-title"),
  description: document.querySelector('meta[name="description"]'),
  subscribe: document.querySelector(".subscribe-link"),
  gallery: document.querySelector("#gallery"),
  search: document.querySelector("#search-input"),
  empty: document.querySelector("#empty-state"),
  loader: document.querySelector("#loader"),
  categories: document.querySelector("#categories"),
  filterToggle: document.querySelector("#filter-toggle"),
  favoritesFilter: document.querySelector("#favorites-filter"),
  favoritesCount: document.querySelector("#favorites-count"),
  filterPanel: document.querySelector("#filter-panel"),
  filterCount: document.querySelector("#filter-count"),
  clearFilters: document.querySelector("#clear-filters"),
  resultsCount: document.querySelector("#results-count"),
  activeFilters: document.querySelector("#active-filters"),
  sort: document.querySelector("#sort-select"),
  reshuffle: document.querySelector("#reshuffle-button"),
  department: document.querySelector("#department-filter"),
  province: document.querySelector("#province-filter"),
  district: document.querySelector("#district-filter"),
  experience: document.querySelector("#experience-filter"),
  price: document.querySelector("#price-filter"),
  verified: document.querySelector("#verified-filter"),
  featured: document.querySelector("#featured-filter"),
  modal: document.querySelector("#profile-modal"),
  modalClose: document.querySelector("#modal-close"),
  modalPrev: document.querySelector("#modal-prev"),
  modalNext: document.querySelector("#modal-next"),
  modalImage: document.querySelector("#modal-image"),
  modalAvatar: document.querySelector("#modal-avatar"),
  modalName: document.querySelector("#modal-name"),
  modalVerified: document.querySelector("#modal-verified"),
  modalCategory: document.querySelector("#modal-category"),
  modalBadges: document.querySelector("#modal-badges"),
  modalFavorite: document.querySelector("#modal-favorite"),
  modalShare: document.querySelector("#modal-share"),
  modalShort: document.querySelector("#modal-short-description"),
  modalExperience: document.querySelector("#modal-experience"),
  modalPrice: document.querySelector("#modal-price"),
  modalLocation: document.querySelector("#modal-location"),
  modalContactSection: document.querySelector("#modal-contact-section"),
  modalWhatsapp: document.querySelector("#modal-whatsapp"),
  modalPhone: document.querySelector("#modal-phone"),
  modalSocialSection: document.querySelector("#modal-social-section"),
  modalBehance: document.querySelector("#modal-behance"),
  modalInstagram: document.querySelector("#modal-instagram"),
  modalLinkedin: document.querySelector("#modal-linkedin"),
  modalCanva: document.querySelector("#modal-canva"),
  modalDescriptionSection: document.querySelector("#modal-description-section"),
  modalLong: document.querySelector("#modal-long-description"),
  modalServicesSection: document.querySelector("#modal-services-section"),
  modalServices: document.querySelector("#modal-services"),
  backToTop: document.querySelector("#back-to-top"),
};

let activeCategory = "Todos";
let filteredProfiles = [];
let renderedCount = 0;
let loading = false;
let searchTimer;
let loadTimer;
let activeProfileId = null;
let lastFocusedElement = null;
let shareFeedbackTimer;
let skipCloseUrlSync = false;
let favoriteOnly = false;
let favoriteIds = loadFavorites();
let randomProfileOrder = new Map();

function loadFavorites() {
  try {
    const storedIds = JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) || "[]");
    if (!Array.isArray(storedIds)) return new Set();
    return new Set(storedIds.map(Number).filter(Number.isInteger));
  } catch {
    return new Set();
  }
}

function saveFavorites() {
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([...favoriteIds]));
  } catch {
    // La vista sigue funcionando si el navegador bloquea el almacenamiento local.
  }
}

function isFavorite(profileId) {
  return favoriteIds.has(Number(profileId));
}

function updateFavoritesSummary() {
  elements.favoritesCount.textContent = favoriteIds.size;
  elements.favoritesFilter.classList.toggle("is-active", favoriteOnly);
  elements.favoritesFilter.setAttribute("aria-pressed", favoriteOnly);
}

function updateModalFavorite(profileId) {
  const selected = isFavorite(profileId);
  elements.modalFavorite.classList.toggle("is-active", selected);
  elements.modalFavorite.setAttribute("aria-pressed", selected);
  elements.modalFavorite.querySelector("span").textContent = selected
    ? "Guardado en favoritos"
    : "Guardar favorito";
}

function toggleFavorite(profileId) {
  const id = Number(profileId);
  if (isFavorite(id)) favoriteIds.delete(id);
  else favoriteIds.add(id);
  saveFavorites();
  updateFavoritesSummary();

  if (favoriteOnly) {
    applyFilters();
  } else {
    document
      .querySelectorAll(`.profile-favorite[data-profile-id="${id}"]`)
      .forEach((button) => setFavoriteButtonState(button, id));
  }

  if (activeProfileId === id) updateModalFavorite(id);
}

function setFavoriteButtonState(button, profileId) {
  const selected = isFavorite(profileId);
  const profile = profiles.find((item) => item.id === Number(profileId));
  button.classList.toggle("is-active", selected);
  button.setAttribute("aria-pressed", selected);
  button.setAttribute(
    "aria-label",
    `${selected ? "Quitar de" : "Guardar en"} favoritos a ${profile.nombres} ${profile.apellidos}`,
  );
}

function profileSlug(profile) {
  return normalizeText(`${profile.nombres}-${profile.apellidos}`).replace(/\s+/g, "-");
}

function profilePath(profile) {
  return `${window.location.pathname}${window.location.search}#/perfil/${profileSlug(profile)}`;
}

function resolveImageUrl(source, imageType = "cover") {
  if (!source) return PROFILE_PLACEHOLDER;
  if (/^https:\/\//i.test(source)) {
    try {
      const imageUrl = new URL(source);
      if (imageUrl.hostname === "res.cloudinary.com") {
        const transform = imageType === "avatar"
          ? "c_fill,g_face,w_300,h_300,f_auto,q_auto"
          : "c_fill,w_720,h_960,f_auto,q_auto";
        return imageUrl.href.replace("/image/upload/", `/image/upload/${transform}/`);
      }
    } catch {
      // Un valor no válido se sustituye por el marcador visual.
    }
    return PROFILE_PLACEHOLDER;
  }

  return PROFILE_PLACEHOLDER;
}

function setImageSource(element, source, alt = "", imageType = "cover") {
  element.alt = alt;
  element.onerror = () => {
    element.onerror = null;
    element.src = PROFILE_PLACEHOLDER;
  };
  element.src = resolveImageUrl(source, imageType);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted && char === '"' && source[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  if (quoted) throw new Error("El CSV contiene un campo entre comillas sin cerrar.");
  if (value !== "" || row.length > 0) {
    row.push(value);
    rows.push(row);
  }
  if (rows.length === 0) throw new Error("El CSV está vacío.");

  const headers = rows.shift().map((header) => header.trim());
  const required = [
    "id", "nombres", "apellidos", "departamento", "provincia", "distrito",
    "whatsapp_publico", "behance_usuario", "instagram_usuario", "linkedin_usuario", "canva_url",
    "categoria", "descripcion_corta", "descripcion_larga", "productos_servicios",
    "nivel_experiencia", "nivel_precio", "foto_perfil", "imagen_portada",
    "es_verificado", "es_destacado", "posicion",
  ];
  const missing = required.filter((header) => !headers.includes(header));
  if (missing.length) throw new Error(`Faltan columnas: ${missing.join(", ")}.`);
  if (rows.length === 0) return [];

  const seenIds = new Set();
  const toBoolean = (value) => /^(true|1|si|sí|yes)$/i.test(value.trim());
  return rows.map((cells, csvOrder) => {
    const record = Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
    const id = Number(record.id);
    if (!Number.isInteger(id) || id <= 0 || seenIds.has(id)) {
      throw new Error("Cada perfil debe tener un id numérico, positivo y único.");
    }
    seenIds.add(id);
    return {
      id,
      nombres: record.nombres.trim(),
      apellidos: record.apellidos.trim(),
      departamento: record.departamento.trim(),
      provincia: record.provincia.trim(),
      distrito: record.distrito.trim(),
      whatsapp: record.whatsapp_publico.trim(),
      usuario_behance: record.behance_usuario.trim(),
      usuario_instagram: record.instagram_usuario.trim(),
      usuario_linkedin: record.linkedin_usuario.trim(),
      canva_url: record.canva_url.trim(),
      categoria: record.categoria.trim(),
      descripcion_corta: record.descripcion_corta.trim(),
      descripcion_larga: record.descripcion_larga.trim(),
      productos_servicios: record.productos_servicios.trim(),
      experiencia: record.nivel_experiencia.trim(),
      nivel_precio: record.nivel_precio.trim(),
      foto_perfil: record.foto_perfil.trim(),
      imagen_portada: record.imagen_portada.trim(),
      verificado: toBoolean(record.es_verificado),
      destacado: toBoolean(record.es_destacado),
      posicion: record.posicion.trim() === "" ? null : Number(record.posicion),
      csvOrder,
      searchText: normalizeText([
        record.nombres,
        record.apellidos,
        record.categoria,
        record.descripcion_corta,
        record.descripcion_larga,
        record.productos_servicios,
        record.nivel_experiencia,
        record.nivel_precio,
        record.departamento,
        record.provincia,
        record.distrito,
        record.whatsapp_publico,
      ].join(" ")),
    };
  });
}

function profileSlugFromLocation() {
  return window.location.hash.match(/^#\/perfil\/([^/?#]+)\/?$/)?.[1]
    ?? window.location.pathname.match(/^\/perfil\/([^/]+)\/?$/)?.[1]
    ?? null;
}

async function initializeDirectory() {
  document.title = SITE_CONFIG.title;
  elements.title.textContent = SITE_CONFIG.brandLabel;
  elements.description.content = SITE_CONFIG.description;
  const subscriptionNumber = SITE_CONFIG.subscriptionWhatsapp.replace(/\D/g, "");
  elements.subscribe.href = `https://wa.me/${subscriptionNumber}?text=${encodeURIComponent(
    "Hola, deseo suscribirme al directorio oficial para recibir promociones y novedades.",
  )}`;

  try {
    profilesCsvSnapshot = await fetchProfilesCsv();
    profiles = parseCsv(profilesCsvSnapshot);
  } catch (error) {
    elements.resultsCount.textContent = "No se pudo cargar el directorio";
    elements.empty.textContent = "Abre esta web desde GitHub Pages o mediante un servidor local para cargar el CSV.";
    elements.empty.hidden = false;
    elements.loader.hidden = true;
    console.error("Error al cargar el directorio:", error);
    return;
  }

  fillSelect(elements.department, profiles.map((profile) => profile.departamento), "Todos");
  fillSelect(elements.province, profiles.map((profile) => profile.provincia), "Todas");
  fillSelect(elements.district, profiles.map((profile) => profile.distrito), "Todos");
  updateFavoritesSummary();
  applyFilters();

  const initialSlug = profileSlugFromLocation();
  const initialProfile = initialSlug && profiles.find((profile) => profileSlug(profile) === initialSlug);
  if (initialProfile) {
    openProfile(initialProfile.id, { historyMode: "none", captureFocus: false });
  }

  window.setInterval(refreshProfiles, PROFILE_REFRESH_INTERVAL);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshProfiles();
  });
}

async function fetchProfilesCsv() {
  const csvUrl = new URL(SITE_CONFIG.profilesCsv, import.meta.url);
  csvUrl.searchParams.set("v", String(Date.now()));
  const response = await fetch(csvUrl, { cache: "no-store" });
  if (!response.ok) throw new Error(`No se pudo leer el CSV (HTTP ${response.status}).`);
  return response.text();
}

async function refreshProfiles() {
  if (document.hidden || refreshingProfiles) return;
  refreshingProfiles = true;

  try {
    const nextSnapshot = await fetchProfilesCsv();
    if (nextSnapshot === profilesCsvSnapshot) return;

    const nextProfiles = parseCsv(nextSnapshot);
    const previousRenderedCount = renderedCount;
    profilesCsvSnapshot = nextSnapshot;
    profiles = nextProfiles;

    const currentIds = new Set(profiles.map((profile) => profile.id));
    favoriteIds = new Set([...favoriteIds].filter((id) => currentIds.has(id)));
    saveFavorites();
    updateFavoritesSummary();

    fillSelect(elements.department, profiles.map((profile) => profile.departamento), "Todos");
    updateLocationOptions("department");
    updateLocationOptions("province");
    if (elements.sort.value === "random") shuffleProfiles();

    const openProfileId = elements.modal.open ? activeProfileId : null;
    applyFilters();

    const targetCount = Math.min(previousRenderedCount, filteredProfiles.length);
    while (renderedCount < targetCount) renderNextBatch({ immediate: true });

    if (openProfileId !== null) {
      if (currentIds.has(openProfileId)) {
        openProfile(openProfileId, { historyMode: "none", captureFocus: false });
      } else {
        closeProfile();
      }
    }
  } catch (error) {
    console.error("No se pudo actualizar el directorio:", error);
  } finally {
    refreshingProfiles = false;
  }
}

function normalizeText(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function editDistance(a, b) {
  if (Math.abs(a.length - b.length) > 1) return 2;
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        previous + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      previous = current;
    }
  }

  return row[b.length];
}

function fuzzyMatches(profile, rawQuery) {
  const query = normalizeText(rawQuery);
  if (!query) return true;

  const words = profile.searchText.split(" ");
  return query.split(" ").every((token) =>
    words.some((word) =>
      word === token ||
      (token.length >= 2 && word.startsWith(token)) ||
      (token.length >= 6 && word.length >= 6 && editDistance(token, word) <= 1),
    ),
  );
}

function fillSelect(select, values, firstLabel) {
  const currentValue = select.value;
  select.replaceChildren(new Option(firstLabel, ""));
  [...new Set(values)].sort((a, b) => a.localeCompare(b, "es")).forEach((value) => {
    select.add(new Option(value, value));
  });
  select.value = [...select.options].some((option) => option.value === currentValue)
    ? currentValue
    : "";
}

function updateLocationOptions(changedFilter) {
  if (changedFilter === "department") {
    const candidates = elements.department.value
      ? profiles.filter((profile) => profile.departamento === elements.department.value)
      : profiles;
    fillSelect(elements.province, candidates.map((profile) => profile.provincia), "Todas");
    fillSelect(elements.district, candidates.map((profile) => profile.distrito), "Todos");
  }

  if (changedFilter === "province") {
    const candidates = profiles.filter(
      (profile) =>
        (!elements.department.value ||
          profile.departamento === elements.department.value) &&
        (!elements.province.value || profile.provincia === elements.province.value),
    );
    fillSelect(elements.district, candidates.map((profile) => profile.distrito), "Todos");
  }
}

function countActiveFilters() {
  return [
    favoriteOnly,
    elements.department.value,
    elements.province.value,
    elements.district.value,
    elements.experience.value,
    elements.price.value,
    elements.verified.checked,
    elements.featured.checked,
  ].filter(Boolean).length;
}

function updateFilterCount() {
  const count = countActiveFilters();
  elements.filterCount.hidden = count === 0;
  elements.filterCount.textContent = count;
}

function updateActiveFilters() {
  const filters = [
    favoriteOnly && ["favorites", "Favoritos"],
    activeCategory !== "Todos" && ["category", activeCategory],
    elements.department.value && ["department", elements.department.value],
    elements.province.value && ["province", elements.province.value],
    elements.district.value && ["district", elements.district.value],
    elements.experience.value && ["experience", elements.experience.value],
    elements.price.value && ["price", elements.price.value],
    elements.verified.checked && ["verified", "Verificados"],
    elements.featured.checked && ["featured", "Destacados"],
  ].filter(Boolean);

  elements.activeFilters.replaceChildren();
  filters.forEach(([key, label]) => {
    const chip = document.createElement("button");
    chip.className = "active-filter";
    chip.type = "button";
    chip.dataset.filter = key;
    chip.setAttribute("aria-label", `Quitar filtro ${label}`);
    chip.textContent = label;
    elements.activeFilters.append(chip);
  });
  elements.activeFilters.hidden = filters.length === 0;
}

function removeActiveFilter(filter) {
  if (filter === "favorites") {
    favoriteOnly = false;
    updateFavoritesSummary();
  } else if (filter === "category") {
    activeCategory = "Todos";
    elements.categories.querySelectorAll(".category").forEach((category) => {
      const selected = category.dataset.category === "Todos";
      category.classList.toggle("is-active", selected);
      category.setAttribute("aria-pressed", String(selected));
    });
  } else if (filter === "department") {
    elements.department.value = "";
    updateLocationOptions("department");
  } else if (filter === "province") {
    elements.province.value = "";
    updateLocationOptions("province");
  } else if (filter === "district") {
    elements.district.value = "";
  } else if (filter === "experience") {
    elements.experience.value = "";
  } else if (filter === "price") {
    elements.price.value = "";
  } else if (filter === "verified") {
    elements.verified.checked = false;
  } else if (filter === "featured") {
    elements.featured.checked = false;
  }
  applyFilters();
}

function sortProfiles(list) {
  return list.sort((a, b) => {
    if (elements.sort.value === "random") {
      return randomProfileOrder.get(a.id) - randomProfileOrder.get(b.id);
    }
    const aHasPosition = Number.isFinite(a.posicion);
    const bHasPosition = Number.isFinite(b.posicion);
    if (aHasPosition && bHasPosition && a.posicion !== b.posicion) {
      return a.posicion - b.posicion;
    }
    if (aHasPosition !== bHasPosition) return aHasPosition ? -1 : 1;
    return a.csvOrder - b.csvOrder;
  });
}

function shuffleProfiles() {
  const shuffled = [...profiles];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  randomProfileOrder = new Map(shuffled.map((profile, index) => [profile.id, index]));
}

function updateSortControls() {
  const randomActive = elements.sort.value === "random";
  elements.reshuffle.hidden = !randomActive;
  elements.reshuffle.setAttribute("aria-hidden", String(!randomActive));
}

function applyFilters() {
  window.clearTimeout(loadTimer);
  const query = elements.search.value;

  filteredProfiles = sortProfiles(
    profiles.filter(
      (profile) =>
        (activeCategory === "Todos" || profile.categoria === activeCategory) &&
        fuzzyMatches(profile, query) &&
        (!elements.department.value ||
          profile.departamento === elements.department.value) &&
        (!elements.province.value || profile.provincia === elements.province.value) &&
        (!elements.district.value || profile.distrito === elements.district.value) &&
        (!elements.experience.value ||
          profile.experiencia === elements.experience.value) &&
        (!elements.price.value || profile.nivel_precio === elements.price.value) &&
        (!elements.verified.checked || profile.verificado) &&
        (!elements.featured.checked || profile.destacado) &&
        (!favoriteOnly || isFavorite(profile.id)),
    ),
  );

  renderedCount = 0;
  loading = false;
  elements.gallery.replaceChildren();
  elements.resultsCount.textContent = `${filteredProfiles.length} ${
    filteredProfiles.length === 1 ? "perfil" : "perfiles"
  }`;
  elements.empty.hidden = filteredProfiles.length > 0;
  elements.empty.textContent = profiles.length === 0
    ? "Aún no hay perfiles publicados."
    : favoriteOnly
      ? "Aún no tienes perfiles favoritos con esos criterios."
      : "No encontramos perfiles con esos criterios.";
  updateFilterCount();
  updateActiveFilters();
  renderNextBatch({ immediate: true });
}

function createProfileCard(profile, index) {
  const card = document.createElement("article");
  card.className = `profile-card${profile.destacado ? " is-featured" : ""}`;
  card.dataset.profileId = profile.id;

  const openButton = document.createElement("button");
  openButton.className = "profile-card__open";
  openButton.type = "button";
  openButton.setAttribute(
    "aria-label",
    `Ver perfil de ${profile.nombres} ${profile.apellidos}`,
  );

  const profileImage = document.createElement("img");
  profileImage.decoding = "async";
  profileImage.loading = index < 2 ? "eager" : "lazy";
  profileImage.fetchPriority = index === 0 ? "high" : "auto";
  setImageSource(profileImage, profile.imagen_portada, `${profile.nombres} ${profile.apellidos}`, "cover");

  const info = document.createElement("span");
  info.className = "profile-card__info";
  const name = document.createElement("span");
  name.className = "profile-card__name";
  name.textContent = `${profile.nombres} ${profile.apellidos}`;
  const meta = document.createElement("span");
  meta.className = "profile-card__meta";
  meta.textContent =
    `${profile.categoria} · ${profile.distrito}, ${profile.departamento}`;
  info.append(name, meta);

  openButton.append(profileImage, info);
  card.append(openButton);
  if (profile.destacado) {
    const featured = document.createElement("span");
    featured.className = "profile-card__featured";
    featured.textContent = "Destacado";
    card.append(featured);
  }

  const favoriteButton = document.createElement("button");
  favoriteButton.className = "profile-favorite";
  favoriteButton.type = "button";
  favoriteButton.dataset.profileId = profile.id;
  favoriteButton.innerHTML = `
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M12 20.2S4.5 16 4.5 9.8A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.5 2.6C19.5 16 12 20.2 12 20.2Z" stroke="currentColor" stroke-linejoin="round" stroke-width="1.8" />
    </svg>`;
  setFavoriteButtonState(favoriteButton, profile.id);
  favoriteButton.addEventListener("click", () => toggleFavorite(profile.id));
  card.append(favoriteButton);

  openButton.addEventListener("click", () => openProfile(profile.id));
  return card;
}

function updateLoader() {
  elements.loader.hidden = renderedCount >= filteredProfiles.length;
}

function renderNextBatch({ immediate = false } = {}) {
  if (loading || renderedCount >= filteredProfiles.length) {
    updateLoader();
    return;
  }

  loading = true;
  elements.gallery.setAttribute("aria-busy", "true");
  elements.loader.hidden = false;

  const appendBatch = () => {
    const nextProfiles = filteredProfiles.slice(
      renderedCount,
      renderedCount + PROFILES_PER_PAGE,
    );
    const fragment = document.createDocumentFragment();

    nextProfiles.forEach((profile, index) => {
      fragment.append(createProfileCard(profile, renderedCount + index));
    });

    elements.gallery.append(fragment);
    renderedCount += nextProfiles.length;
    loading = false;
    elements.gallery.setAttribute("aria-busy", "false");
    updateLoader();
  };

  if (immediate) appendBatch();
  else loadTimer = window.setTimeout(appendBatch, LOAD_DELAY);
}

function profileLink(network, username) {
  if (!SOCIAL_HOSTS[network]) return "#";
  let handle = String(username).trim();
  if (/^https?:\/\//i.test(handle)) {
    try {
      const suppliedUrl = new URL(handle);
      if (suppliedUrl.protocol !== "https:" || !SOCIAL_HOSTS[network].has(suppliedUrl.hostname)) return "#";
      if (network === "canva") return suppliedUrl.href;
      const pathParts = suppliedUrl.pathname.split("/").filter(Boolean);
      if (network === "linkedin") {
        handle = pathParts[0]?.toLowerCase() === "in" ? pathParts[1] || "" : "";
      } else {
        handle = pathParts[0] || "";
      }
    } catch {
      return "#";
    }
  }
  handle = handle.replace(/^@/, "");
  if (!/^[\p{L}\p{N}._-]{1,100}$/u.test(handle)) return "#";
  const destinations = {
    behance: { host: "www.behance.net", path: handle },
    instagram: { host: "www.instagram.com", path: handle },
    linkedin: { host: "www.linkedin.com", path: `in/${handle}` },
  };
  return `https://${destinations[network].host}/${destinations[network].path}`;
}

function openProfile(
  profileId,
  { historyMode = "push", captureFocus = true } = {},
) {
  const profile = profiles.find((item) => item.id === Number(profileId));
  if (!profile) return;
  if (captureFocus && !elements.modal.open) {
    lastFocusedElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  activeProfileId = profile.id;

  const fullName = `${profile.nombres} ${profile.apellidos}`;
  setImageSource(elements.modalImage, profile.imagen_portada, fullName, "cover");
  setImageSource(elements.modalAvatar, profile.foto_perfil, fullName, "avatar");
  elements.modalName.textContent = fullName;
  elements.modalVerified.hidden = !profile.verificado;
  const categoryLabels = {
    "Diseñadores gráficos": "Diseñador gráfico",
    Anfitrionas: "Anfitriona",
    Volanteras: "Volantera",
  };
  elements.modalCategory.textContent = categoryLabels[profile.categoria];
  elements.modalBadges.replaceChildren();
  updateModalFavorite(profile.id);

  if (profile.destacado) {
    const badge = document.createElement("span");
    badge.textContent = "Perfil destacado";
    elements.modalBadges.append(badge);
  }

  elements.modalShort.textContent = profile.descripcion_corta || "";
  elements.modalShort.hidden = !profile.descripcion_corta;
  elements.modalExperience.textContent = profile.experiencia;
  elements.modalPrice.textContent = profile.nivel_precio;
  elements.modalLocation.textContent =
    `${profile.distrito}, ${profile.provincia} · ${profile.departamento}`;

  elements.modalContactSection.hidden = !profile.whatsapp;
  if (profile.whatsapp) {
    const phone = profile.whatsapp.replace(/\D/g, "").slice(-9);
    elements.modalPhone.textContent = phone.replace(/(\d{3})(?=\d)/g, "$1 ");
    elements.modalWhatsapp.href =
      `https://wa.me/${profile.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(
        `Hola ${profile.nombres}, vi tu perfil y quisiera más información.`,
      )}`;
  }

  const socialProfiles = [
    [elements.modalBehance, "behance", profile.usuario_behance],
    [elements.modalInstagram, "instagram", profile.usuario_instagram],
    [elements.modalLinkedin, "linkedin", profile.usuario_linkedin],
    [elements.modalCanva, "canva", profile.canva_url],
  ];
  socialProfiles.forEach(([element, network, username]) => {
    const url = username ? profileLink(network, username) : "#";
    element.hidden = !username || url === "#";
    if (!element.hidden) element.href = url;
  });
  elements.modalSocialSection.hidden = socialProfiles.every(([element]) => element.hidden);

  elements.modalDescriptionSection.hidden = !profile.descripcion_larga;
  elements.modalLong.textContent = profile.descripcion_larga || "";
  elements.modalServicesSection.hidden = !profile.productos_servicios;
  elements.modalServices.textContent = profile.productos_servicios || "";
  elements.modalPrev.hidden = filteredProfiles.length < 2;
  elements.modalNext.hidden = filteredProfiles.length < 2;
  window.clearTimeout(shareFeedbackTimer);
  elements.modalShare.querySelector("span").textContent = "Compartir perfil";

  if (historyMode === "push") {
    window.history.pushState({ profileId: profile.id }, "", profilePath(profile));
  } else if (historyMode === "replace") {
    window.history.replaceState({ profileId: profile.id }, "", profilePath(profile));
  }

  if (!elements.modal.open) {
    elements.modal.showModal();
    window.requestAnimationFrame(() => elements.modalClose.focus());
  }
  document.querySelector(".profile-details").scrollTop = 0;
}

function navigateProfile(direction) {
  const currentIndex = filteredProfiles.findIndex(
    (profile) => profile.id === activeProfileId,
  );
  if (currentIndex < 0 || filteredProfiles.length < 2) return;
  const nextIndex =
    (currentIndex + direction + filteredProfiles.length) % filteredProfiles.length;
  openProfile(filteredProfiles[nextIndex].id, {
    historyMode: "replace",
    captureFocus: false,
  });
}

function closeProfile({ updateUrl = true } = {}) {
  skipCloseUrlSync = !updateUrl;
  if (elements.modal.open) elements.modal.close();
}

async function shareActiveProfile() {
  const profile = profiles.find((item) => item.id === activeProfileId);
  if (!profile) return;
  const url = new URL(profilePath(profile), window.location.href).href;
  const shareData = {
    title: `${profile.nombres} ${profile.apellidos} · Directorio oficial`,
    text: `Conoce el perfil de ${profile.nombres} ${profile.apellidos}.`,
    url,
  };
  let message = "Enlace copiado";

  try {
    if (navigator.share) {
      await navigator.share(shareData);
      message = "Perfil compartido";
    } else {
      await navigator.clipboard.writeText(url);
    }
  } catch (error) {
    if (error?.name === "AbortError") return;
    const temporary = document.createElement("textarea");
    temporary.value = url;
    temporary.setAttribute("readonly", "");
    temporary.style.position = "fixed";
    temporary.style.opacity = "0";
    document.body.append(temporary);
    temporary.select();
    document.execCommand("copy");
    temporary.remove();
  }

  const label = elements.modalShare.querySelector("span");
  label.textContent = message;
  window.clearTimeout(shareFeedbackTimer);
  shareFeedbackTimer = window.setTimeout(() => {
    label.textContent = "Compartir perfil";
  }, 1800);
}

function clearFilters() {
  elements.department.value = "";
  updateLocationOptions("department");
  elements.province.value = "";
  elements.district.value = "";
  elements.experience.value = "";
  elements.price.value = "";
  elements.verified.checked = false;
  elements.featured.checked = false;
  favoriteOnly = false;
  updateFavoritesSummary();
  applyFilters();
}

elements.search.addEventListener("input", () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(applyFilters, 180);
});

elements.sort.addEventListener("change", () => {
  if (elements.sort.value === "random") shuffleProfiles();
  updateSortControls();
  applyFilters();
});
elements.reshuffle.addEventListener("click", () => {
  shuffleProfiles();
  applyFilters();
});

elements.categories.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  activeCategory = button.dataset.category;
  elements.categories.querySelectorAll(".category").forEach((category) => {
    const selected = category === button;
    category.classList.toggle("is-active", selected);
    category.setAttribute("aria-pressed", String(selected));
  });
  applyFilters();
});

elements.activeFilters.addEventListener("click", (event) => {
  const chip = event.target.closest("[data-filter]");
  if (chip) removeActiveFilter(chip.dataset.filter);
});

elements.filterToggle.addEventListener("click", () => {
  const willOpen = elements.filterPanel.hidden;
  elements.filterPanel.hidden = !willOpen;
  elements.filterToggle.setAttribute("aria-expanded", willOpen);
});
elements.favoritesFilter.addEventListener("click", () => {
  favoriteOnly = !favoriteOnly;
  updateFavoritesSummary();
  applyFilters();
});

elements.department.addEventListener("change", () => {
  updateLocationOptions("department");
  applyFilters();
});
elements.province.addEventListener("change", () => {
  updateLocationOptions("province");
  applyFilters();
});
[
  elements.district,
  elements.experience,
  elements.price,
  elements.verified,
  elements.featured,
].forEach((control) => control.addEventListener("change", applyFilters));

elements.clearFilters.addEventListener("click", clearFilters);
elements.modalClose.addEventListener("click", () => closeProfile());
elements.modalPrev.addEventListener("click", () => navigateProfile(-1));
elements.modalNext.addEventListener("click", () => navigateProfile(1));
elements.modalShare.addEventListener("click", shareActiveProfile);
elements.modalFavorite.addEventListener("click", () => {
  if (activeProfileId !== null) toggleFavorite(activeProfileId);
});
elements.modal.addEventListener("click", (event) => {
  if (event.target === elements.modal) closeProfile();
});
elements.modal.addEventListener("close", () => {
  if (
    !skipCloseUrlSync &&
    (window.location.hash.startsWith("#/perfil/") ||
      window.location.pathname.startsWith("/perfil/"))
  ) {
    window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}`);
  }
  skipCloseUrlSync = false;
  activeProfileId = null;
  if (lastFocusedElement?.isConnected) lastFocusedElement.focus();
  lastFocusedElement = null;
});

document.addEventListener("keydown", (event) => {
  if (!elements.modal.open) return;
  if (event.key === "ArrowLeft") navigateProfile(-1);
  if (event.key === "ArrowRight") navigateProfile(1);
});

window.addEventListener("popstate", () => {
  const slug = profileSlugFromLocation();
  const profile = slug && profiles.find((item) => profileSlug(item) === slug);
  if (profile) {
    openProfile(profile.id, { historyMode: "none", captureFocus: false });
  } else {
    closeProfile({ updateUrl: false });
  }
});

window.addEventListener(
  "scroll",
  () => {
    elements.backToTop.hidden = window.scrollY < 600;
  },
  { passive: true },
);
elements.backToTop.addEventListener("click", () => {
  window.scrollTo({
    top: 0,
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
  });
});

const loadObserver = new IntersectionObserver(
  ([entry]) => {
    if (entry.isIntersecting) renderNextBatch();
  },
  { rootMargin: "240px 0px", threshold: 0.1 },
);

loadObserver.observe(elements.loader);

const siteMenu = document.querySelector(".site-menu");
const siteMenuToggle = siteMenu?.querySelector(".site-menu__toggle");

if (siteMenu && siteMenuToggle) {
  const closeSiteMenu = () => {
    siteMenu.open = false;
  };

  siteMenu.addEventListener("toggle", () => {
    siteMenuToggle.setAttribute(
      "aria-label",
      siteMenu.open ? "Cerrar menú" : "Abrir menú",
    );
  });

  document.addEventListener("click", (event) => {
    if (siteMenu.open && !siteMenu.contains(event.target)) closeSiteMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !siteMenu.open) return;
    closeSiteMenu();
    siteMenuToggle.focus();
  });

  siteMenu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeSiteMenu);
  });
}

initializeDirectory();
