// MOTOR.JS - Sistema Híbrido con Coincidencia Difusa (Fuse.js)
// Lógica pura de Q&A cargando las reglas desde una URL externa (Google Sheets).

// === VARIABLES GLOBALES ===
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const sugerenciasContainer = document.getElementById('sugerencias-container');

let fuseEngine; // Motor de búsqueda Fuse.js

// === INICIO DEL SISTEMA ===
async function iniciarSistema() {
    const config = window.CHAT_CONFIG || {};
    
    // 1. Aplicar Textos
    document.getElementById('header-title').innerText = config.titulo || "Asistente";
    document.getElementById('bot-welcome-text').innerText = config.saludoInicial || "Hola";
    userInput.placeholder = config.placeholder || "Escribe aquí...";
    
    try {
        // 2. Cargar Base de Datos desde la URL externa
        const resDatos = await fetch(config.data_source_url);
        if (!resDatos.ok) throw new Error("Error al cargar la URL del Sheet. Código: " + resDatos.status);
        const textoBase = await resDatos.text();
        
        // 3. Parsear el texto plano (CSV/TSV) a JSON
        const conocimiento = parseData(textoBase);

        // 4. Construir el motor Fuse.js
        buildFuseEngine(conocimiento);

        // 5. Habilitar Chat
        toggleInput(true);
        document.getElementById('status-text').innerText = "Conectado. Sin costo ⚡";

        // 6. Mostrar botones de sugerencia iniciales
        mostrarBotonesSugeridos(config.sugerencias_rapidas);
        
    } catch (error) {
        console.error("Error al iniciar el sistema:", error);
        document.getElementById('status-text').innerText = "ERROR al cargar la Base de Datos";
        agregarBurbuja("⚠️ Error: No pude cargar la base de conocimiento desde la URL. Revise la URL o el formato de su Sheet.", 'bot');
        return;
    }


    // 7. Eventos
    sendBtn.addEventListener('click', procesarMensaje);
    userInput.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault(); 
            procesarMensaje();
        }
    });
    
    console.log("Sistema Q&A modular (Fuse.js) cargado.");
}

// === PARSER: Convierte CSV/TSV (Texto Plano) a Array de objetos ===
function parseData(rawData) {
    const lineas = rawData.trim().split('\n');
    if (lineas.length < 2) return [];

    // Detectar separador (pipe, tab o coma)
    const encabezado = lineas[0];
    let separador = ',';
    if (encabezado.includes('|')) separador = '|';
    else if (encabezado.includes('\t')) separador = '\t';
    
    const headers = encabezado.split(separador).map(h => h.trim().toLowerCase());
    const data = [];

    // Validar headers mínimos
    if (!headers.includes('id_regla') || !headers.includes('palabras_clave') || !headers.includes('respuesta_texto')) {
        console.error("Error: Headers inválidos. Esperados: ID_REGLA, PALABRAS_CLAVE, RESPUESTA_TEXTO.");
        return [];
    }

    for (let i = 1; i < lineas.length; i++) {
        // Usamos un regex para manejar comas o pipes que estén dentro de comillas (típico de CSV)
        const valores = lineas[i].match(/(".*?"|[^"|,\t\n\r]+)(?=\s*[,|\t|\n\r]|\s*$)/g) || lineas[i].split(separador);
        
        if (valores.length !== headers.length) {
            console.warn(`Saltando línea ${i+1} por datos incompletos.`);
            continue;
        }

        const obj = {};
        headers.forEach((header, index) => {
            let valor = valores[index] ? valores[index].trim().replace(/^"|"$/g, '') : '';
            
            // Reemplazar \\n por \n (para Markdown)
            if (header === 'respuesta_texto') {
                valor = valor.replace(/\\n/g, '\n'); 
            }
            
            obj[header] = valor;
        });
        
        obj.palabras_clave = obj.palabras_clave || '';
        data.push(obj);
    }
    return data;
}


// === LÓGICA DE INDEXACIÓN (Construcción del Motor de Similitud) ===
function buildFuseEngine(data) {
    const options = {
        keys: ['palabras_clave'], // Solo buscamos en el array de palabras clave
        includeScore: true,       // Queremos saber qué tan buena fue la coincidencia
        threshold: 0.4,           // Tolerancia: 0.4 (acepta errores de tipeo y sinónimos)
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
        const saludo = obtenerAleatorio(config.personalidad.saludos);
        const cierre = Math.random() > 0.3 ? obtenerAleatorio(config.personalidad.cierres) : "";
        
        return `${saludo} ${respuestaBase} \n\n${cierre}`;
    }

    // C) FALLBACK (No entendió) -> Botón de WhatsApp
    const fraseFail = obtenerAleatorio(config.personalidad.sin_entender);
    const linkWsp = `https://wa.me/${config.whatsapp}?text=${encodeURIComponent("Hola, tengo una consulta sobre: " + texto)}`;
    
    return `${fraseFail}\n<a href="${linkWsp}" class="chat-btn">Chatear por WhatsApp 🟢</a>`;
}

// === LÓGICA DE BOTONES (Solo para la bienvenida) ===
function mostrarBotonesSugeridos(sugerencias) {
    sugerenciasContainer.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = "flex flex-wrap gap-2 pt-2 pb-4"; 

    sugerencias.forEach(sug => {
        const button = document.createElement('button');
        button.textContent = sug.texto;
        button.className = "px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded-full hover:bg-gray-300 transition shadow-sm active:scale-95";
        
        // Simula la entrada del usuario al hacer clic
        button.onclick = function() {
            userInput.value = sug.accion; 
            procesarMensaje();          
        };
        wrapper.appendChild(button);
    });
    sugerenciasContainer.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;
}

// === UTILIDADES ===
function obtenerAleatorio(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function toggleInput(estado) {
    userInput.disabled = !estado;
    sendBtn.disabled = !estado;
    if (estado) setTimeout(() => userInput.focus(), 10);
}

function agregarBurbuja(html, tipo) {
    const container = document.getElementById('chat-container');
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
    const container = document.getElementById('chat-container');
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
}

window.onload = iniciarSistema;
