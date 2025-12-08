// filtros.js - MODO GOOGLE

function cargarFiltros() {
    const contenedor = document.getElementById('shortcode-filtros');
    if (!contenedor) return;

    // Solo el título y el input grande
    const html = `
    <div class="filters-container">
        <h1 class="brand-title">Premios<span style="color:#4f46e5">.pe</span></h1>
        
        <input type="text" id="searchInput" 
               class="search-box" 
               placeholder="Busca un negocio..." 
               autocomplete="off" 
               autofocus>
               
        <select id="categoryFilter" style="display:none;"><option value="all"></option></select>
    </div>`;

    contenedor.innerHTML = html;

    // Conectamos el buscador
    const searchInput = document.getElementById('searchInput');
    if (typeof filtrarNegocios === 'function') {
        searchInput.addEventListener('input', filtrarNegocios);
    }
}
