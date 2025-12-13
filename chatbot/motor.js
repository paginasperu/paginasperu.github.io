// MOTOR.JS - Sistema Modular de Carga Única (Reglas + Personalidad)
// Implementa la Búsqueda Avanzada ($OR) y Sugerencias Inteligentes (Did You Mean).

// === VARIABLES GLOBALES ===
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const sugerenciasContainer = document.getElementById('sugerencias-container');
const chatContainer = document.getElementById('chat-container'); 

let fuseEngine; // Motor de búsqueda Fuse.js
let personalidadData = { saludo: [], cierre: [], sin_entender: [] }; 

// === INICIO DEL SISTEMA ===
async function iniciarSistema() {
    const config = window.CHAT_CONFIG || {};
    
    // 1. Aplicar Textos Estáticos
    document.getElementById('header-title').innerText = config.titulo || "Asistente";
    userInput.placeholder = config.placeholder || "Escribe aquí...";
    document.getElementById('status-text').innerText = "Cargando datos...";
    
    try {
        // 2. Cargar Base de Datos Única
        const resDatos = await fetch(config.data_source_url);
        if (!resDatos.ok) throw new Error("Error al cargar la URL del Sheet (Código: " + resDatos.status + ").");
        const textoBase = await resDatos.text();
        
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
        agregarBurbuja("⚠️ Error crítico: No pude cargar la base de conocimiento. Revise la URL pública y el formato de las cabeceras.", 'bot');
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
        threshold: 0.6, // Elevamos el threshold para permitir búsquedas más amplias
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

// === ALGORITMO DE BÚSQUEDA AVANZADA CON SUGERENCIAS ===
function generarRespuesta(texto) {
    const config = window.CHAT_CONFIG;
    let respuestaBase = null;
    
    // 1. Preprocesar y preparar la búsqueda por Expresión $or (Busca si CUALQUIER palabra coincide)
    const palabrasUsuario = texto.toLowerCase()
        .split(/[\s,]+/) 
        .filter(w => w.length > 2); // Elimina ruido menor a 3 letras

    const orExpression = palabrasUsuario.map(word => ({ palabras_clave: word }));

    let resultados = [];
    if (orExpression.length > 0) {
        // Obtenemos los 5 mejores resultados (el motor está configurado con threshold 0.6)
        resultados = fuseEngine.search({ $or: orExpression }, { limit: 5 });
    }

    // --- ANÁLISIS DE RESULTADOS EN 3 NIVELES ---
    if (resultados.length > 0) {
        const mejorResultado = resultados[0]; 
        
        // NIVEL 1: MATCH DIRECTO Y CONFIABLE (Hemos subido el umbral a 0.4 para más tolerancia)
        if (mejorResultado.score < 0.4) { 
            respuestaBase = mejorResultado.item.respuesta_texto;
        } 
        
        // NIVEL 2: SUGERENCIAS INTELIGENTES (Match aceptable pero ambiguo)
        else if (mejorResultado.score < 0.6) { // Umbral intermedio para sugerencias
            const sugerenciasUtiles = resultados
                .slice(0, 3) // Tomamos las 3 mejores
                .filter(r => r.score < 0.65) // Filtramos resultados demasiado malos
                .map(r => r.item.id_regla);
            
            if (sugerenciasUtiles.length > 0) {
                respuestaBase = construirSugerencias(sugerenciasUtiles, texto, config.sugerencias_rapidas);
            }
        }
    }
    
    // B) CONSTRUCCIÓN DE LA RESPUESTA FINAL
    if (respuestaBase) {
        const saludo = obtenerAleatorio(personalidadData.saludo);
        const cierre = obtenerAleatorio(personalidadData.cierre);
        
        const cierreFinal = Math.random() > 0.3 ? `\n\n${cierre}` : '';

        // Si la respuesta fue una sugerencia, no le ponemos saludo/cierre para que sea directo.
        if (respuestaBase.includes("Temas Relacionados")) {
             return respuestaBase; 
        }

        return `${saludo} ${respuestaBase} ${cierreFinal}`;
    }

    // C) NIVEL 3: FALLBACK (NO ENTIENDE NADA)
    const fraseFail = obtenerAleatorio(personalidadData.sin_entender);
    const linkWsp = `https://wa.me/${config.whatsapp}?text=${encodeURIComponent("Hola, tengo una consulta sobre: " + texto)}`;
    
    return `${fraseFail}\n<a href="${linkWsp}" class="chat-btn">Chatear por WhatsApp 🟢</a>`;
}

// Función auxiliar para construir el mensaje de sugerencias
function construirSugerencias(idsRelevantes, textoOriginal, sugerenciasIniciales) {
    const titulos = idsRelevantes.map(id => {
        // Buscamos el texto del botón inicial para obtener el título legible
        const sugerencia = sugerenciasIniciales.find(sug => sug.accion === id);
        return sugerencia ? sugerencia.texto : id; 
    });

    let mensaje = `No estoy 100% seguro de a qué te refieres con: *"${textoOriginal}"*. 🧐\n\n`;
    mensaje += `Pero encontré estos **Temas Relacionados** que podrían ayudarte:`;
    
    titulos.forEach(titulo => {
        // Agregamos el título como un botón funcional (simulando la escritura)
        mensaje += `\n- **${titulo}**`;
    });

    mensaje += "\n\nIntenta escribir solo una de las palabras clave (ej: 'precios' o 'delivery').";
    return mensaje;
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
