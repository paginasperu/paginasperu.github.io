// MOTOR.JS - Sistema Modular de Carga Única (Reglas + Personalidad)
// Implementa caching local para eliminar la latencia de red.

// === VARIABLES GLOBALES ===
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const sugerenciasContainer = document.getElementById('sugerencias-container');
const chatContainer = document.getElementById('chat-container'); 

let fuseEngine; 
let personalidadData = { saludo: [], cierre: [], sin_entender: [] }; 

// === FUNCIÓN CRÍTICA: FETCH CON CACHÉ ===
async function fetchWithCache(url, ttlHours) {
    const CACHE_KEY = 'chat_kb_cache';
    const CACHE_TIMESTAMP_KEY = 'chat_kb_ts';
    const TTL_MS = ttlHours * 60 * 60 * 1000; // Convertir horas a milisegundos
    
    // 1. Intentar cargar desde la caché local
    const cachedData = localStorage.getItem(CACHE_KEY);
    const cachedTime = localStorage.getItem(CACHE_TIMESTAMP_KEY);
    const now = Date.now();

    if (cachedData && cachedTime && (now - parseInt(cachedTime) < TTL_MS)) {
        console.log("✅ Datos cargados desde la caché local (rápido).");
        return cachedData;
    }

    // 2. Si no hay caché o está expirada, cargar desde la red
    console.log("⏳ Cargando datos frescos desde Google Sheets...");
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Error de red al obtener la base de datos.");
        
        const data = await response.text();
        
        // 3. Guardar en caché antes de devolver
        localStorage.setItem(CACHE_KEY, data);
        localStorage.setItem(CACHE_TIMESTAMP_KEY, now.toString());
        
        console.log("💾 Base de datos actualizada y guardada en caché.");
        return data;
    } catch (error) {
        console.error("❌ Fallo en la red, intentando usar caché caducada si existe...", error);
        
        // 4. Fallback: Si la red falla, usar caché caducada como último recurso
        if (cachedData) {
            console.warn("⚠️ Usando datos de caché caducada debido a fallo de red.");
            return cachedData;
        }
        throw error; // Si no hay caché y la red falla, el sistema no puede iniciar.
    }
}

// === INICIO DEL SISTEMA ===
async function iniciarSistema() {
    const config = window.CHAT_CONFIG || {};
    
    document.getElementById('header-title').innerText = config.titulo || "Asistente";
    userInput.placeholder = config.placeholder || "Escribe aquí...";
    document.getElementById('status-text').innerText = "Cargando datos...";
    
    try {
        // 2. Cargar Base de Datos usando el mecanismo de caché
        const textoBase = await fetchWithCache(config.data_source_url, config.cache_ttl_hours);
        
        // 3. Parsear el texto plano y separar en Reglas y Personalidad
        const conocimiento = parseTotalData(textoBase); 

        // 4. Construir el motor Fuse.js con las reglas
        buildFuseEngine(conocimiento);

        // 5. Habilitar Chat
        toggleInput(true);
        document.getElementById('status-text').innerText = "Conectado. Sin costo ⚡";
        document.getElementById('bot-welcome-text').innerText = config.saludoInicial;
        mostrarBotonesSugeridos(config.sugerencias_rapidas);
        
    } catch (error) {
        console.error("Error FATAL al iniciar el sistema:", error);
        document.getElementById('status-text').innerText = "ERROR DE CONEXIÓN";
        agregarBurbuja("⚠️ Error crítico: No pude cargar la base de conocimiento. El chat no puede operar.", 'bot');
        return;
    }


    // 6. Eventos
    sendBtn.addEventListener('click', procesarMensaje);
    userInput.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault(); 
            procesarMensaje();
        }
    });
}


// === PARSER ÚNICO: Analiza la tabla y separa Reglas de Personalidad ===
function parseTotalData(rawData) {
    const lineas = rawData.trim().split('\n');
    if (lineas.length < 2) return [];

    const encabezado = lineas[0];
    let separador = ',';
    if (encabezado.includes('|')) separador = '|';
    else if (encabezado.includes('\t')) separador = '\t';
    
    const headers = encabezado.split(separador).map(h => h.trim().toLowerCase());
    const rulesData = [];
    const personalidadTipos = ['saludo', 'cierre', 'sin_entender'];

    const idReglaIndex = headers.indexOf('id_regla');
    const palabrasClaveIndex = headers.indexOf('palabras_clave');
    const respuestaTextoIndex = headers.indexOf('respuesta_texto');

    if (idReglaIndex === -1 || palabrasClaveIndex === -1 || respuestaTextoIndex === -1) {
        console.error("Error de formato: Faltan cabeceras obligatorias (id_regla, palabras_clave, respuesta_texto).");
        // Si hay error en la cabecera, limpiamos personalidadData para evitar errores posteriores
        personalidadData = { saludo: ["Hola."], cierre: ["Adiós."], sin_entender: ["Error."] }; 
        return [];
    }

    for (let i = 1; i < lineas.length; i++) {
        const valores = lineas[i].match(/(".*?"|[^"|,\t\n\r]+)(?=\s*[,|\t|\n\r]|\s*$)/g) || lineas[i].split(separador);
        
        if (valores.length < headers.length) continue; 

        const id = valores[idReglaIndex] ? valores[idReglaIndex].trim().toLowerCase() : '';
        let respuesta = valores[respuestaTextoIndex] ? valores[respuestaTextoIndex].trim().replace(/^"|"$/g, '') : '';
        
        respuesta = respuesta.replace(/\\n/g, '\n'); 

        // 1. CLASIFICAR COMO PERSONALIDAD
        if (personalidadTipos.includes(id)) {
            if (respuesta) {
                personalidadData[id].push(respuesta); 
            }
            continue; 
        }
        
        // 2. CLASIFICAR COMO REGLA Q&A (para Fuse.js)
        const palabrasClave = valores[palabrasClaveIndex] ? valores[palabrasClaveIndex].trim() : '';
        
        if (id && palabrasClave && respuesta) {
            rulesData.push({
                id_regla: id,
                palabras_clave: palabrasClave,
                respuesta_texto: respuesta
            });
        }
    }
    
    console.log(`Cargado: ${rulesData.length} Reglas Q&A y ${personalidadData.saludo.length + personalidadData.cierre.length + personalidadData.sin_entender.length} Frases de Personalidad.`);

    return rulesData;
}


// === LÓGICA DE INDEXACIÓN (Construcción del Motor de Similitud) ===
function buildFuseEngine(data) {
    const options = {
        keys: ['palabras_clave'],
        includeScore: true,
        threshold: 0.4, 
        ignoreLocation: true      
    };
    
    fuseEngine = new Fuse(data, options);
}


// === CEREBRO PRINCIPAL (Lógica Q&A) ===
async function procesarMensaje() {
    const textoUsuario = userInput.value.trim();
    if (!textoUsuario) return;

    agregarBurbuja(textoUsuario, 'user');
    userInput.value = '';
    toggleInput(false);
    
    const loadingId = mostrarLoading();
    await new Promise(r => setTimeout(r, 600)); 

    const respuestaFinal = generarRespuesta(textoUsuario);

    document.getElementById(loadingId)?.remove();
    
    const contenidoHTML = (typeof marked !== 'undefined') 
        ? marked.parse(respuestaFinal) 
        : respuestaFinal.replace(/\n/g, '<br>');
        
    agregarBurbuja(contenidoHTML, 'bot');
    toggleInput(true);
    userInput.focus();
}

// === ALGORITMO DE BÚSQUEDA Y PERSONALIDAD ===
function generarRespuesta(texto) {
    const config = window.CHAT_CONFIG;
    let respuestaBase = null;
    
    // 1. Búsqueda por Similitud (Fuzzy Matching)
    const resultados = fuseEngine.search(texto, { limit: 1 }); 

    if (resultados.length > 0) {
        const mejorResultado = resultados[0]; 
        
        // Solo aceptamos la respuesta si es muy relevante (< 0.35 de error)
        if (mejorResultado.score < 0.35) {
            respuestaBase = mejorResultado.item.respuesta_texto;
        }
    }
    
    // B) CONSTRUCCIÓN DE LA RESPUESTA (Personalidad)
    if (respuestaBase) {
        // Usamos la data de personalidadData (cargada dinámicamente)
        const saludo = obtenerAleatorio(personalidadData.saludo);
        const cierre = obtenerAleatorio(personalidadData.cierre);
        
        // Usamos Math.random() para decidir si incluimos el cierre
        const cierreFinal = Math.random() > 0.3 ? `\n\n${cierre}` : '';

        // El bot siempre da un saludo antes de la respuesta de la regla
        return `${saludo} ${respuestaBase} ${cierreFinal}`;
    }

    // C) FALLBACK (No entendió) -> Botón de WhatsApp
    const fraseFail = obtenerAleatorio(personalidadData.sin_entender);
    const linkWsp = `https://wa.me/${config.whatsapp}?text=${encodeURIComponent("Hola, tengo una consulta sobre: " + texto)}`;
    
    return `${fraseFail}\n<a href="${linkWsp}" class="chat-btn">Chatear por WhatsApp 🟢</a>`;
}

// === LÓGICA DE BOTONES (Simulan entrada de usuario) ===
function mostrarBotonesSugeridos(sugerencias) {
    sugerenciasContainer.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = "flex flex-wrap gap-2 pt-2 pb-4"; 

    sugerencias.forEach(sug => {
        const button = document.createElement('button');
        button.textContent = sug.texto;
        button.className = "px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded-full hover:bg-gray-300 transition shadow-sm active:scale-95";
        
        button.onclick = function() {
            userInput.value = sug.accion; 
            procesarMensaje();          
        };
        wrapper.appendChild(button);
    });
    sugerenciasContainer.appendChild(wrapper);
    chatContainer.scrollTop = chatContainer.scrollHeight; 
}

// === UTILIDADES ===
function obtenerAleatorio(array) {
    if (!array || array.length === 0) return "";
    return array[Math.floor(Math.random() * array.length)];
}

function toggleInput(estado) {
    userInput.disabled = !estado;
    sendBtn.disabled = !estado;
    if (estado) setTimeout(() => userInput.focus(), 10);
}

function agregarBurbuja(html, tipo) {
    const container = chatContainer; 
    const div = document.createElement('div');
    const colorCliente = window.CHAT_CONFIG.colorPrincipal;
    
    if (tipo === 'user') {
        div.className = "p-3 max-w-[85%] shadow-sm text-sm text-white rounded-2xl rounded-tr-none self-end ml-auto";
        div.style.backgroundColor = colorCliente;
        div.textContent = html;
    } else {
        div.className = "p-3 max-w-[85%] shadow-sm text-sm bg-white text-gray-800 border border-gray-200 rounded-2xl rounded-tl-none self-start mr-auto";
        div.innerHTML = html;
        const links = div.getElementsByTagName('a');
        for(let link of links) link.target = "_blank";
    }
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function mostrarLoading() {
    const container = chatContainer;
    const id = 'load-' + Date.now();
    const div = document.createElement('div');
    div.id = id;
    div.className = "p-3 max-w-[85%] shadow-sm bg-white border border-gray-200 rounded-2xl rounded-tl-none self-start flex gap-1";
    div.innerHTML = `
        <div class="w-2 h-2 bg-gray-400 rounded-full typing-dot"></div>
        <div class="w-2 h-2 bg-gray-400 rounded-full typing-dot" style="animation-delay:0.2s"></div>
        <div class="w-2 h-2 bg-gray-400 rounded-full typing-dot" style="animation-delay:0.4s"></div>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return id;
}

window.onload = iniciarSistema;
