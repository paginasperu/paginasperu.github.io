// MOTOR.JS - Lógica de Negocio, Seguridad y Conexión

import { TECH_CONFIG, CONFIG_BOT } from './config.js'; 
import { marked } from 'https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js'; 

// === VARIABLES GLOBALES ===
let systemInstruction = ""; 
// Elementos del Chat
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const chatContainer = document.getElementById('chat-container'); 
const chatInterface = document.getElementById('chat-interface'); 
// Elementos del Acceso
const accessGate = document.getElementById('access-gate'); 
const keyInput = document.getElementById('keyInput');     
const keySubmit = document.getElementById('keySubmit');   
const keyPrompt = document.getElementById('key-prompt');  
const keyError = document.getElementById('keyError');     

const WA_LINK = `https://wa.me/${TECH_CONFIG.whatsapp}`;
const requestTimestamps = []; 
let messageCount = 0;         

// === SISTEMA DE SEGURIDAD: RATE LIMITING (Sliding Window) ===
function checkRateLimit() {
    const now = Date.now();
    const windowMs = TECH_CONFIG.rate_limit_window_seconds * 1000;
    
    // Limpiar timestamps viejos
    while (requestTimestamps.length > 0 && requestTimestamps[0] < now - windowMs) {
        requestTimestamps.shift();
    }

    // Verificar si excede límite
    if (requestTimestamps.length >= TECH_CONFIG.rate_limit_max_requests) {
        return { 
            limitReached: true, 
            retryAfter: Math.ceil((requestTimestamps[0] + windowMs - now) / 1000) 
        };
    }
    
    requestTimestamps.push(now);
    return { limitReached: false };
}

// === CARGA DE CONTEXTO (MOVIMIENTO: AHORA ESTÁ MÁS ARRIBA PARA EVITAR ReferenceError) ===
async function cargarYAnalizarContexto() {
    try {
        document.getElementById('status-text').innerText = "Cargando sistema...";

        const [resInst, resData] = await Promise.all([
            fetch('instrucciones.txt'),
            fetch('datos.txt')
        ]);

        if (!resInst.ok || !resData.ok) throw new Error("Error cargando archivos base");

        const textoInstruccion = await resInst.text();
        const textoData = await resData.text();
        
        // El textoInstruccion ahora es solo el prompt.
        let instruccionPrompt = textoInstruccion;
        
        // Reemplazo de Placeholders (solo los que dependen de CONFIG_BOT y TECH_CONFIG)
        instruccionPrompt = instruccionPrompt
            .replace(/\[whatsapp\]/g, TECH_CONFIG.whatsapp)
            .replace(/\[nombre_empresa\]/g, CONFIG_BOT.nombre_empresa || 'Empresa');

        // Adjuntar Data
        instruccionPrompt += `\n\n--- BASE DE CONOCIMIENTO (USAR SOLO ESTO) ---\n${textoData}`;

        return instruccionPrompt;

    } catch (error) {
        console.error("Error crítico:", error);
        return "Error de sistema. Contacte a soporte.";
    }
}


// === LÓGICA DE ACCESO ===
function setupAccessGate() {
    keyPrompt.innerText = TECH_CONFIG.CLAVE_TEXTO;
    keySubmit.style.backgroundColor = TECH_CONFIG.color_principal;
    
    const checkKey = () => {
        const input = keyInput.value.trim().toLowerCase();
        if (input === TECH_CONFIG.CLAVE_ACCESO.toLowerCase()) {
            keyError.classList.add('hidden');
            accessGate.classList.add('hidden');
            chatInterface.classList.remove('hidden');
            // Continuar con la carga de la IA real después del acceso exitoso
            cargarIA(); 
        } else {
            keyError.classList.remove('hidden');
            keyInput.value = '';
            keyInput.focus();
        }
    };
    
    keySubmit.addEventListener('click', checkKey);
    keyInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { 
            e.preventDefault(); 
            checkKey(); 
        }
    });
}

// === INICIO DEL CHAT (Se llama solo si la clave es correcta) ===
async function cargarIA() {
    systemInstruction = await cargarYAnalizarContexto(); // ESTA LLAMADA AHORA FUNCIONA
    
    // UI Setup (Usando los valores de CONFIG_BOT)
    document.documentElement.style.setProperty('--chat-color', TECH_CONFIG.color_principal);
    document.getElementById('header-title').innerText = CONFIG_BOT.nombre_empresa || "Chat";
    document.getElementById('bot-welcome-text').innerText = CONFIG_BOT.saludo_inicial || "Hola.";
    document.getElementById('status-text').innerText = "En línea 🟢";
    
    // Actualizar el ícono del header
    document.getElementById('header-icon-initials').innerText = CONFIG_BOT.icono_header; 
    
    // Input Security Setup
    userInput.setAttribute('maxlength', TECH_CONFIG.max_length);
    userInput.setAttribute('placeholder', TECH_CONFIG.placeholder);
    
    toggleInput(true);

    sendBtn.addEventListener('click', procesarMensaje);
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); procesarMensaje(); }
    });
}


// === FUNCIÓN PRINCIPAL DE INICIO ===
async function iniciarSistema() {
    // Primero, preparamos la puerta de acceso y el UI
    document.documentElement.style.setProperty('--chat-color', TECH_CONFIG.color_principal);
    
    if (TECH_CONFIG.CLAVE_ACCESO) {
        setupAccessGate();
    } else {
        // Si no hay clave configurada, cargamos la IA directamente (como antes)
        accessGate.classList.add('hidden');
        chatInterface.classList.remove('hidden');
        cargarIA();
    }
}


// === LÓGICA PRINCIPAL (procesarMensaje sin cambios) ===
async function procesarMensaje() {
    const textoUsuario = userInput.value.trim();
    
    // === 1. BLOQUEO DE DEMO (CAPA DE UX) ===
    if (messageCount >= TECH_CONFIG.max_demo_messages) {
        const demoEndMsg = `🛑 ¡Demo finalizado! Has alcanzado el límite de ${TECH_CONFIG.max_demo_messages} mensajes. Por favor, contáctanos para obtener tu propia licencia.`;
        if (messageCount === TECH_CONFIG.max_demo_messages) { // Mostrar el mensaje final solo una vez
             agregarBurbuja(demoEndMsg, 'bot');
             messageCount++; // Para que no vuelva a entrar en esta condición
        }
        userInput.value = '';
        toggleInput(false); // Bloquea la interacción
        return;
    }
    
    // 2. Validación de Input (Seguridad Básica)
    if (!textoUsuario) return;
    if (textoUsuario.length < TECH_CONFIG.min_input_length) {
        userInput.value = ''; 
        return; 
    }

    // 3. Rate Limiting (Protección de Tokens/Costos)
    const limit = checkRateLimit();
    if (limit.limitReached) {
        agregarBurbuja(`⚠️ Demasiadas consultas. Espera ${limit.retryAfter}s.`, 'bot');
        userInput.value = '';
        return;
    }

    agregarBurbuja(textoUsuario, 'user');
    userInput.value = '';
    toggleInput(false);
    const loadingId = mostrarLoading();
    
    try {
        const respuesta = await llamarIA(textoUsuario);
        document.getElementById(loadingId)?.remove();
        
        // Procesar respuesta
        const whatsappCheck = `[whatsapp_link]`;
        let htmlFinal = "";

        if (respuesta.includes(whatsappCheck)) {
            const cleanText = respuesta.replace(whatsappCheck, '');
            const btnLink = `<a href="${WA_LINK}?text=${encodeURIComponent('Ayuda con: ' + textoUsuario)}" target="_blank" class="chat-btn">Hablar con Asesor 🟢</a>`;
            htmlFinal = marked.parse(cleanText) + btnLink;
        } else {
            htmlFinal = marked.parse(respuesta);
        }
        
        agregarBurbuja(htmlFinal, 'bot');
        messageCount++; // Incrementa el contador después de una respuesta exitosa

    } catch (e) {
        document.getElementById(loadingId)?.remove();
        console.error(e);
        agregarBurbuja(`Error de conexión. <a href="${WA_LINK}" class="chat-btn">WhatsApp</a>`, 'bot');
    } finally {
        // Chequea si esta última respuesta alcanzó el límite
        if (messageCount >= TECH_CONFIG.max_demo_messages) {
            toggleInput(false);
        } else {
            toggleInput(true);
            userInput.focus();
        }
    }
}

// === API CALL (llamarIA sin cambios) ===
async function llamarIA(pregunta) {
    const { modelo, temperatura, max_retries, deepSeekUrl } = TECH_CONFIG; 
    let delay = 1000;

    const messages = [
        { role: "system", content: systemInstruction },
        { role: "user", content: pregunta }
    ];

    for (let i = 0; i < max_retries; i++) {
        try {
            const res = await fetch(deepSeekUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: modelo, 
                    messages: messages, 
                    temperature: temperatura,
                    stream: false
                })
            });

            if (!res.ok) throw new Error(`API Error: ${res.status}`);
            const data = await res.json();
            
            return data.choices?.[0]?.message?.content || "No entendí, ¿puedes repetir?";

        } catch (err) {
            if (i === max_retries - 1) throw err;
            await new Promise(r => setTimeout(r, delay));
            delay *= 2;
        }
    }
}

// === UI UTILS (sin cambios) ===
function toggleInput(state) {
    userInput.disabled = !state;
    sendBtn.disabled = !state;
}

function agregarBurbuja(html, tipo) {
    const div = document.createElement('div');
    if (tipo === 'user') {
        div.className = "p-3 max-w-[85%] shadow-sm text-sm text-white rounded-2xl rounded-tr-none self-end ml-auto";
        div.style.backgroundColor = TECH_CONFIG.color_principal;
        div.textContent = html; 
    } else {
        div.className = "p-3 max-w-[85%] shadow-sm text-sm bg-white text-gray-800 border border-gray-200 rounded-2xl rounded-tl-none self-start mr-auto bot-bubble";
        div.innerHTML = html; 
    }
    chatContainer.appendChild(div);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function mostrarLoading() {
    const id = 'load-' + Date.now();
    const div = document.createElement('div');
    div.id = id;
    div.className = "p-3 max-w-[85%] bg-white border border-gray-200 rounded-2xl rounded-tl-none self-start flex gap-1";
    div.innerHTML = `<div class="w-2 h-2 rounded-full typing-dot"></div><div class="w-2 h-2 rounded-full typing-dot" style="animation-delay:0.2s"></div><div class="w-2 h-2 rounded-full typing-dot" style="animation-delay:0.4s"></div>`;
    chatContainer.appendChild(div);
    return id;
}

window.onload = iniciarSistema;
