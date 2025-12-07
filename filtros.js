// filtros.js (Simplificado para Directorio)

function cargarFiltros() {
    const contenedor = document.getElementById('shortcode-filtros');
    if (!contenedor) return;

    const html = `
    <div class="filters-container">
        <input type="text" id="searchInput" class="search-box" placeholder="Buscar negocio o distrito...">
        
        <select id="categoryFilter" class="filter-select">
            <option value="all">Todas las categorías</option>
            <option value="educacion">Educación</option>
            <option value="deporte">Deporte</option>
            <option value="tecnologia">Tecnología</option>
            <option value="moda">Moda</option>
            <option value="salud">Salud</option>
        </select>
    </div>`;

    contenedor.innerHTML = html;
}
