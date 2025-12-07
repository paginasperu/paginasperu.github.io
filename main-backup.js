        const cards = document.querySelectorAll('.reward-card');
        const welcomeMessage = document.getElementById('welcomeMessage');

        // Función Principal de Filtrado (MODIFICADA PARA NO DEPENDER DE VARIABLES GLOBALES)
        function filterRewards() {
            // Intentamos buscar los inputs en el documento
            const searchInput = document.getElementById('searchInput');
            const categoryFilter = document.getElementById('categoryFilter');
            const vendorFilter = document.getElementById('vendorFilter');

            // Si los filtros no existen (porque borraste el shortcode), mostramos todo y salimos.
            if (!searchInput || !categoryFilter || !vendorFilter) {
                cards.forEach(card => card.style.display = 'flex');
                return;
            }

            const searchText = searchInput.value.toLowerCase();
            const category = categoryFilter.value;
            const vendor = vendorFilter.value;

            cards.forEach(card => {
                const title = card.querySelector('.reward-title').textContent.toLowerCase();
                const desc = card.querySelector('.reward-desc').textContent.toLowerCase();
                const vendorText = card.querySelector('.reward-vendor').textContent.toLowerCase();
                const cardCategory = card.getAttribute('data-category');
                const cardVendor = card.getAttribute('data-vendor');

                const matchesText = title.includes(searchText) || desc.includes(searchText) || vendorText.includes(searchText);
                const matchesCategory = category === 'all' || cardCategory === category;
                const matchesVendor = vendor === 'all' || cardVendor === vendor;

                card.style.display = (matchesText && matchesCategory && matchesVendor) ? 'flex' : 'none';
            });
            
            if(vendor !== 'all') {
                const vendorName = vendorFilter.options[vendorFilter.selectedIndex].text;
                welcomeMessage.textContent = `Viendo premios de: ${vendorName}`;
                welcomeMessage.style.display = 'block';
            } else {
                welcomeMessage.style.display = 'none';
            }
        }

        // LÓGICA DE HASH (#/)
        function checkHash() {
            let hash = window.location.hash;
            // Solo intentamos filtrar si el filtro de Negocios existe
            const vendorFilter = document.getElementById('vendorFilter');
            if (!vendorFilter) return;

            if (hash) {
                let vendorSlug = hash.replace('#/', '').replace('#', '').toLowerCase();
                const options = vendorFilter.options;
                for (let i = 0; i < options.length; i++) {
                    if (options[i].value.toLowerCase() === vendorSlug) {
                        vendorFilter.selectedIndex = i; 
                        filterRewards();
                        break;
                    }
                }
            }
        }

        // INICIALIZACIÓN SEGURA
        document.addEventListener("DOMContentLoaded", () => {
            // 1. Cargamos los filtros si existe la función (que viene de filtros.js)
            if (typeof cargarFiltros === "function") {
                cargarFiltros(); 
            }

            // 2. Revisamos URL y filtramos
            checkHash();
        });

        window.addEventListener("hashchange", checkHash);

        // --- Modal (Sin cambios) ---
        const modal = document.getElementById('rewardModal');
        const mImg = document.getElementById('modalImg');
        const mVendor = document.getElementById('modalVendor');
        const mCategory = document.getElementById('modalCategory');
        const mTitle = document.getElementById('modalTitle');
        const mPoints = document.getElementById('modalPoints');
        const mDesc = document.getElementById('modalDesc');

        cards.forEach(card => {
            card.addEventListener('click', () => {
                const imgSrc = card.querySelector('img').src;
                const title = card.querySelector('.reward-title').textContent;
                const points = card.querySelector('.reward-points').textContent;
                const vendorName = card.querySelector('.reward-vendor').textContent;
                const category = card.getAttribute('data-category');
                const longDesc = card.getAttribute('data-long-desc');

                mImg.src = imgSrc;
                mTitle.textContent = title;
                mPoints.textContent = points;
                mVendor.textContent = vendorName;
                mCategory.textContent = category.toUpperCase();
                mDesc.textContent = longDesc;
                
                modal.style.display = 'flex';
                setTimeout(() => { modal.classList.add('show'); }, 10);
            });
        });

        function closeModal() {
            modal.classList.remove('show');
            setTimeout(() => { modal.style.display = 'none'; }, 300);
        }
        window.onclick = function(event) { if (event.target == modal) closeModal(); }
