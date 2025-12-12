// MOTOR.JS - Lógica Central + Sistema Multi-IA

// === DECLARACIÓN DE VARIABLES GLOBALES ===
// Obtenemos los elementos una sola vez al inicio para que todas las funciones puedan usarlos
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const statusText = document.getElementById('status-text');
// ===========================================

async function iniciarSistema() {
    const config = window.CHAT_CONFIG || {};
    
    // Aplicar Diseño
    const color = config.colorPrincipal || "#2563eb";
    document.documentElement.style.setProperty('--chat-color', color);
    document.getElementById('header-title').innerText = config.titulo || "Asistente";
    document.getElementById('bot-welcome-text').innerText = config.saludoInicial || "Hola";
    userInput.placeholder = config.placeholder || "Escribe aquí..."; // Usa la variable global 'userInput'

    try {
        // Cargar Archivos de Texto
        const [resDatos, resInstrucciones] = await Promise.all([
            fetch('datos.txt'),
            fetch('instrucciones.txt')
        ]);

        if (!resDatos.ok || !resInstrucciones.ok) throw new Error("Faltan archivos txt");

        window.CTX_DATOS = await resDatos.text();
        window.CTX_INSTRUCCIONES = await resInstrucciones.text();

        // Activar Chat
        userInput.disabled = false; // Usa la variable global 'userInput'
        sendBtn.disabled = false;   // Usa la variable global 'sendBtn'
        statusText.innerText = "En línea"; // Usa la variable global 'statusText'
        statusText.classList.remove('animate-pulse');
        console.log("Sistema cargado.");

        // =========================================================
        // === CÓDIGO PARA DETECTAR LA TECLA ENTER (INICIO) ===
        // =========================================================

        userInput.addEventListener('keydown', function(event) {
            // Verificamos si la tecla presionada es 'Enter'
            if (event.key === 'Enter') {
                // Prevenimos un salto de línea si el input fuera un textarea
                event.preventDefault(); 
                // Llamamos a la función principal de envío
                enviarMensaje();
            }
        });

        // =======================================================
        // === CÓDIGO PARA DETECTAR LA TECLA ENTER (FIN) ===
        // =======================================================

    } catch (error) {
        console.error(error);
        statusText.innerText = "Error Config";
        agregarBurbuja("⚠️ Error: No pude cargar la información del negocio.", 'bot');
    }
}

// Lógica de Reintento (Failover)
async function llamarIA(prompt) {
    // Usamos el operador de encadenamiento opcional para evitar errores si config.js no carga
    const proveedores = window.CHAT_CONFIG?.proveedores; 
    if (!proveedores || proveedores.length === 0) {
        throw new Error("No hay proveedores de IA configurados en config.js.");
    }

    let ultimoError = null;

    for (let i = 0; i < proveedores.length; i++) {
        const prov = proveedores[i];
        console.log(`Intentando con: ${prov.nombre}...`);

        try {
            let respuesta = "";

            if (prov.tipo === "google") {
                // GEMINI
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${prov.modelo}:generateContent?key=${prov.apiKey}`;
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                });
                if (!res.ok) throw new Error(`Gemini Error: ${res.status}`);
                const data = await res.json();
                respuesta = data.candidates[0].content.parts[0].text;

            } else if (prov.tipo === "openai-compatible") {
                // DEEPSEEK / OPENAI
                const res = await fetch(prov.url, {
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
                    })
                });
                if (!res.ok) throw new Error(`${prov.nombre} Error: ${res.status}`);
                const data = await res.json();
                respuesta = data.choices[0].message.content;
            }

            return respuesta; // ¡Éxito! Salimos del bucle

        } catch (e) {
            console.warn(`Falló ${prov.nombre}:`, e);
            ultimoError = e;
            // Si falla, el bucle 'for' continúa automáticamente al siguiente proveedor
        }
    }
    throw ultimoError || new Error("Todos los proveedores fallaron.");
}

// Función Principal
async function enviarMensaje() {
    // Usamos las variables globales
    const trampa = document.getElementById('honeypot');
    
    if (trampa && trampa.value !== "") return; // Bot detectado

    const pregunta = userInput.value.trim();
    if (!pregunta) return;

    if (!checkSpam()) {
        agregarBurbuja("⏳ Límite de mensajes alcanzado.", 'bot');
        return;
    }

    agregarBurbuja(pregunta, 'user');
    userInput.value = '';
    userInput.disabled = true;
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
        
        document.getElementById(loadingId).remove();
        const contenido = (typeof marked !== 'undefined') ? marked.parse(respuestaIA) : respuestaIA;
        agregarBurbuja(contenido, 'bot');

    } catch (error) {
        document.getElementById(loadingId)?.remove();
        console.error(error);
        agregarBurbuja("😔 Error de conexión con todos los sistemas.", 'bot');
    } finally {
        userInput.disabled = false;
        userInput.focus();
    }
}

// Anti-Spam (30 mensajes/hora)
function checkSpam() {
    const LIMITE = 30; 
    const TIEMPO = 3600000; // 1 hora
    const ahora = Date.now();
    let log = JSON.parse(localStorage.getItem('chat_logs') || '[]');
    log = log.filter(t => ahora - t < TIEMPO);
    if (log.length >= LIMITE) return false;
    log.push(ahora);
    localStorage.setItem('chat_logs', JSON.stringify(log));
    return true;
}

// UI Auxiliares
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
    div.innerHTML = '<div class="w-2 h-2 bg-gray-400 rounded-full typing-dot"></div><div class="w-2 h-2 bg-gray-400 rounded-full typing-dot" style="animation-delay:0.2s"></div><div class="w-2 h-2 bg-gray-400 rounded-full typing-dot" style="animation-delay:0.4s"></div>';
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return id;
}

window.onload = iniciarSistema;
