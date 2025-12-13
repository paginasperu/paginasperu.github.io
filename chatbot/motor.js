// MOTOR.JS - Lógica Central + Sistema Multi-IA + Multi-Proxy
// Código optimizado, limpio y con lógica de failover robusta.

// === VARIABLES GLOBALES ===
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const statusText = document.getElementById('status-text');

let pageLoadedAt = Date.now(); // Captura el tiempo de inicio de la carga de la página.
let isProcessing = false; // Bandera para prevenir llamadas duplicadas (Recomendación: MANTENER)
// ==========================

// ==========================================================
// === UTILIDAD TEMPORAL: LISTAR MODELOS (PARA DIAGNÓSTICO) ===
// BORRAR TODO ESTE BLOQUE DE listAvailableGeminiModels DESPUÉS DE LA PRUEBA.
// ==========================================================
/**
 * Función para obtener y listar todos los modelos Gemini disponibles
 * para una clave API específica.
 * * Esto ayuda a diagnosticar errores 404 causados por nombres de modelo incorrectos.
 */
async function listAvailableGeminiModels(apiKey) {
    if (!apiKey || apiKey === "AIzaSyDSv_H9HytUFYDPmCQX8JJflZ7405HczAE") {
        console.error("❌ ERROR: Por favor, proporciona tu clave API real.");
        return;
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    
    console.log("Cargando lista de modelos. Esto puede tardar unos segundos...");

    try {
        const response = await fetch(apiUrl);
        const data = await response.json();

        if (!response.ok) {
            console.error(`❌ ERROR ${response.status}: Fallo al obtener la lista.`);
            console.error("Detalles del error:", data);
            
            if (response.status === 400 || response.status === 403) {
                console.error("Sugerencia: El error 400/403 puede indicar que la 'Generative Language API' no está habilitada o que la clave no tiene las restricciones correctas.");
            }
            return;
        }

        if (!data.models || data.models.length === 0) {
            console.log("No se encontraron modelos disponibles con esta clave.");
            return;
        }

        const chatModels = data.models
            // Filtramos solo los modelos que pueden generar contenido (chat/texto)
            .filter(model => model.supportedGenerationMethods.includes("GENERATE_CONTENT"))
            // Extraemos los datos clave
            .map(model => ({
                Nombre: model.displayName,
                Alias: model.name.split('/')[1] // Quitamos "models/"
            }));
        
        console.log("=========================================");
        console.log("✅ MODELOS GEMINI DISPONIBLES PARA TU CLAVE");
        console.log("=========================================");
        
        chatModels.forEach(model => {
            console.log(`[${model.Nombre}] -> Alias a usar en config.js: "${model.Alias}"`);
        });

        console.log("=========================================");

    } catch (error) {
        console.error("❌ ERROR DE RED: No se pudo conectar a la API.", error);
    }
}
// ==========================================================
// === FIN DE UTILIDAD TEMPORAL ===
// ==========================================================


// === INICIO DEL SISTEMA ===
async function iniciarSistema() {
    const config = window.CHAT_CONFIG || {};
    
    // 1. Aplicar Diseño
    const color = config.colorPrincipal || "#2563eb";
    document.documentElement.style.setProperty('--chat-color', color);
    document.getElementById('header-title').innerText = config.titulo || "Asistente";
    document.getElementById('bot-welcome-text').innerText = config.saludoInicial || "Hola";
    userInput.placeholder = config.placeholder || "Escribe aquí...";

    try {
        // 2. Cargar Archivos de Texto (Contexto)
        const [resDatos, resInstrucciones] = await Promise.all([
            fetch('datos.txt'),
            fetch('instrucciones.txt')
        ]);

        if (!resDatos.ok || !resInstrucciones.ok) throw new Error("Faltan archivos txt");

        window.CTX_DATOS = await resDatos.text();
        window.CTX_INSTRUCCIONES = await resInstrucciones.text();

        // 3. LLAMADA TEMPORAL A LA UTILIDAD: Reemplaza "TU_CLAVE_REAL_AQUI"
        //    Esto se ejecuta solo al cargar la página.
        const geminiApiKey = config.proveedores?.[0]?.apiKey;
        if (geminiApiKey) {
            listAvailableGeminiModels(geminiApiKey);
        }
        // ==============================================================

        // 4. Activar Chat
        userInput.disabled = false;
        sendBtn.disabled = false;
        statusText.innerText = "En línea";
        statusText.classList.remove('animate-pulse');
        console.log("Sistema cargado correctamente.");

        // 5. Detectar tecla ENTER
        userInput.addEventListener('keydown', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault(); 
                enviarMensaje();
            }
        });

    } catch (error) {
        console.error(error);
        statusText.innerText = "Error Config";
        agregarBurbuja("⚠️ Error: No pude cargar la información del negocio.", 'bot');
    }
}

// === FUNCIÓN AUXILIAR: FETCH CON TIMEOUT ===
async function fetchWithTimeout(resource, options = {}) {
    const { timeout = 10000 } = options; 
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    const response = await fetch(resource, {
        ...options,
        signal: controller.signal  
    });
    clearTimeout(id);
    return response;
}

// === LÓGICA DE REINTENTO (FAILOVER + MULTI-PROXY) ===
async function llamarIA(prompt) {
    const proveedores = window.CHAT_CONFIG?.proveedores; 
    if (!proveedores || proveedores.length === 0) {
        throw new Error("No hay proveedores configurados.");
    }

    let ultimoError = null;

    // BUCLE 1: Recorre los proveedores (Gemini -> DeepSeek -> etc.)
    for (let i = 0; i < proveedores.length; i++) {
        const prov = proveedores[i];
        console.log(`🤖 Intentando con Proveedor: ${prov.nombre}...`);

        try {
            let respuesta = "";

            if (prov.tipo === "google") {
                // --- LÓGICA GEMINI ---
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${prov.modelo}:generateContent?key=${prov.apiKey}`;
                const res = await fetchWithTimeout(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
                    timeout: 10000 // 10s timeout
                });
                
                if (!res.ok) throw new Error(`Gemini Error: ${res.status}`);
                const data = await res.json();
                respuesta = data.candidates?.[0]?.content?.parts?.[0]?.text;

            } else if (prov.tipo === "openai-compatible") {
                // --- LÓGICA OPENAI/DEEPSEEK CON PROXIES ---
                const listaProxies = prov.proxies?.length ? prov.proxies : (prov.url ? [prov.url] : []);
                
                if (listaProxies.length === 0) throw new Error(`El proveedor ${prov.nombre} no tiene URLs configuradas.`);

                let errorProxy = null;

                // BUCLE 2: Recorre los Proxies de este proveedor
                for (let p = 0; p < listaProxies.length; p++) {
                    const currentUrl = listaProxies[p];
                    console.log(`   ↳ 🌐 Probando Proxy ${p + 1}: ${currentUrl}`);

                    try {
                        const res = await fetchWithTimeout(currentUrl, {
                            method: 'POST',
                            headers: { 
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${prov.apiKey}`
                            },
                            body: JSON.stringify({
                                model: prov.modelo,
                                messages: [
                                    { role: "system", content: "Eres un asistente útil." },
                                    { role: "user", content: prompt }
                                ]
                            }),
                            timeout: 12000 // 12s timeout para proxies (suelen ser más lentos)
                        });

                        if (!res.ok) throw new Error(`Status ${res.status}`);

                        const data = await res.json();
                        respuesta = data.choices?.[0]?.message?.content;
                        
                        if (respuesta) {
                            console.log(`   ✅ Éxito con Proxy ${p + 1}`);
                            break; // ¡Funciona! Rompemos el bucle de proxies
                        }
                    } catch (e) {
                        console.warn(`   ❌ Falló Proxy ${p + 1} (${currentUrl}):`, e.name === 'AbortError' ? 'Tiempo de espera agotado' : e.message);
                        errorProxy = e;
                        // Continúa al siguiente proxy...
                    }
                }

                if (!respuesta) throw errorProxy || new Error("Todos los proxies fallaron.");
            }

            if (respuesta) return respuesta; // Si tenemos respuesta, retornamos y termina todo.

        } catch (e) {
            console.warn(`⚠️ Falló Proveedor ${prov.nombre}. Saltando al siguiente...`);
            ultimoError = e;
            // Continúa al siguiente proveedor...
        }
    }

    throw ultimoError || new Error("Todos los sistemas fallaron.");
}

// === FUNCIÓN PRINCIPAL ===
async function enviarMensaje() {
    
    // --- FIX: EVITAR RE-ENTRADA (Bloqueo de seguridad) ---
    if (isProcessing) {
        return; 
    }
    isProcessing = true; // Bloquear nuevas llamadas

    const trampa = document.getElementById('honeypot');
    
    // 1. HONEYPOT CHECK
    if (trampa && trampa.value !== "") {
        isProcessing = false; 
        return; 
    } 

    // 2. TIEMPO MÍNIMO DESDE LA CARGA
    const MIN_DELAY_MS = 2000; // 2 segundos
    if (Date.now() - pageLoadedAt < MIN_DELAY_MS) {
        isProcessing = false; 
        return; 
    }

    const pregunta = userInput.value.trim();
    if (!pregunta) {
        isProcessing = false; 
        return;
    }

    // 3. LÍMITE DE SPAM POR SESIÓN
    if (!checkSpam()) {
        agregarBurbuja("⏳ Has enviado demasiados mensajes. Por favor espera un poco.", 'bot');
        isProcessing = false; 
        return;
    }

    agregarBurbuja(pregunta, 'user');
    userInput.value = '';
    userInput.disabled = true;
    sendBtn.disabled = true; 
    const loadingId = mostrarLoading();

    try {
        const promptFinal = `
            ${window.CTX_INSTRUCCIONES}
            INFORMACIÓN DEL NEGOCIO:
            ${window.CTX_DATOS}
            PREGUNTA DEL USUARIO:
            ${pregunta}
        `;

        const respuestaIA = await llamarIA(promptFinal);
        
        document.getElementById(loadingId)?.remove();
        const contenido = (typeof marked !== 'undefined') ? marked.parse(respuestaIA) : respuestaIA;
        agregarBurbuja(contenido, 'bot');

    } catch (error) {
        document.getElementById(loadingId)?.remove();
        console.error(error);
        agregarBurbuja("😔 Lo siento, tengo problemas de conexión en este momento.", 'bot');
    } finally {
        userInput.disabled = false;
        sendBtn.disabled = false; 
        isProcessing = false; // DESBLOQUEAR la bandera al finalizar
        userInput.focus();
    }
}

// === ANTI-SPAM (LocalStorage Seguro y Configurable) ===
function checkSpam() {
    const config = window.CHAT_CONFIG || {};
    // Usamos los valores de config.js, o un default
    const LIMITE = config.spamLimit || 30; 
    const DURACION_MINUTOS = config.spamDurationMinutes || 60;
    const TIEMPO = DURACION_MINUTOS * 60 * 1000; // Convertir minutos a milisegundos

    const ahora = Date.now();
    let log = [];

    // Intentamos leer localStorage con seguridad (filtro de cortesía)
    try {
        const stored = localStorage.getItem('chat_logs');
        if (stored) log = JSON.parse(stored);
    } catch (e) {
        // Fallback a memoria si localStorage falla (ej. modo privado)
        if (!window.tempSpamLog) window.tempSpamLog = [];
        log = window.tempSpamLog;
    }

    // Filtrar antiguos
    log = log.filter(t => ahora - t < TIEMPO);

    if (log.length >= LIMITE) return false;

    // Guardar nuevo
    log.push(ahora);

    try {
        localStorage.setItem('chat_logs', JSON.stringify(log));
    } catch (e) {
        window.tempSpamLog = log; // Fallback a memoria
    }
    
    return true;
}

// === INTERFAZ GRÁFICA ===
function agregarBurbuja(html, tipo) {
    const container = document.getElementById('chat-container');
    const div = document.createElement('div');
    const colorCliente = window.CHAT_CONFIG?.colorPrincipal || "#2563eb";
    
    if (tipo === 'user') {
        div.className = "p-3 max-w-[85%] shadow-sm text-sm text-white rounded-2xl rounded-tr-none self-end ml-auto";
        div.style.backgroundColor = colorCliente;
        div.textContent = html;
    } else {
        div.className = "p-3 max-w-[85%] shadow-sm text-sm bg-white text-gray-800 border border-gray-200 rounded-2xl rounded-tl-none self-start mr-auto";
        div.innerHTML = html;
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
    return id;
}

window.onload = iniciarSistema;
