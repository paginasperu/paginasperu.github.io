import { CONFIG } from './config.js';
import { marked } from 'https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js';

// --- Estado Global del Sistema ---
let systemInstruction = "";
let conversationHistory = [];
let messageCount = 0;
let requestTimestamps = [];
let longWaitTimeoutId; 

const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const chatContainer = document.getElementById('chat-container');
const chatInterface = document.getElementById('chat-interface');
const feedbackDemoText = document.getElementById('feedback-demo-text');
const WA_LINK = `https://wa.me/${CONFIG.WHATSAPP_NUMERO}`;

// --- UX y Scroll ---
function handleScroll() {
    const observer = new MutationObserver(() => {
        observer.disconnect();
        chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
    });
    observer.observe(chatContainer, { childList: true });
}

function updateDemoFeedback(count) {
    if (!CONFIG.SHOW_REMAINING_MESSAGES) return;
    const remaining = CONFIG.MAX_DEMO_MESSAGES - count;
    if (remaining <= 0) {
        feedbackDemoText.innerText = `🛑 Límite de ${CONFIG.MAX_DEMO_MESSAGES} mensajes alcanzado.`;
        feedbackDemoText.style.color = 'red';
    } else if (remaining <= CONFIG.WARNING_THRESHOLD) {
        feedbackDemoText.innerText = `⚠️ Te quedan ${remaining} mensaje(s).`;
        feedbackDemoText.style.color = CONFIG.COLOR_PRIMARIO;
    }
}

// --- Configuración e Identidad ---
function aplicarConfiguracionGlobal() {
    document.title = CONFIG.NOMBRE_EMPRESA;
    document.documentElement.style.setProperty('--chat-color', CONFIG.COLOR_PRIMARIO);
    const headerIcon = document.getElementById('header-icon-initials');
    if (CONFIG.LOGO_URL && headerIcon) {
        headerIcon.innerHTML = `<img src="${CONFIG.LOGO_URL}" alt="${CONFIG.NOMBRE_EMPRESA}" class="w-full h-full object-contain rounded-full">`;
    } else if (headerIcon) {
        headerIcon.innerText = CONFIG.ICONO_HEADER;
    }
    document.getElementById('header-title').innerText = CONFIG.NOMBRE_EMPRESA;
    
    const linkIcon = document.querySelector("link[rel*='icon']");
    if (linkIcon) {
        linkIcon.href = `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>${CONFIG.FAVICON_EMOJI}</text></svg>`;
    }
}

// --- Seguridad y Acceso (Lógica Blindada) ---
function setupAccessGate() {
    const keySubmit = document.getElementById('keySubmit');
    const keyInput = document.getElementById('keyInput');
    const keyError = document.getElementById('keyError');
    keySubmit.style.backgroundColor = CONFIG.COLOR_PRIMARIO;

    keySubmit.onclick = async () => {
        const inputKey = keyInput.value.trim(); 
        
        if (!inputKey) {
            keyError.innerText = "Por favor, ingresa una clave.";
            keyError.classList.remove('hidden');
            return;
        }

        try {
            const res = await fetch(`https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:json`);
            const text = await res.text();
            const json = JSON.parse(text.replace(/.*google.visualization.Query.setResponse\((.*)\);/s, '$1'));
            const row = json.table.rows[1]?.c || json.table.rows[0]?.c || [];
            
            const realKey = String(row[0]?.v || "").trim();
            const expirationRaw = row[1]?.f || row[1]?.v || "";

            // Validación de Expiración DD-MM-YYYY HH:mm:ss
            if (expirationRaw) {
                const p = expirationRaw.match(/(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2}):(\d{2})/);
                if (p) {
                    const dateLimit = new Date(p[3], p[2] - 1, p[1], p[4], p[5], p[6]);
                    if (new Date() > dateLimit) {
                        keyError.innerText = "La clave ha caducado. Contacta a soporte.";
                        keyError.classList.remove('hidden');
                        return;
                    }
                }
            }

            // Validación Exacta (Case Sensitive)
            if (inputKey === realKey) {
                document.getElementById('access-gate').classList.add('hidden');
                chatInterface.classList.remove('hidden');
                cargarIA();
            } else {
                keyError.innerText = "Clave incorrecta. Intenta de nuevo.";
                keyError.classList.remove('hidden');
            }
        } catch (e) {
            keyError.innerText = "Error de conexión con el servidor.";
            keyError.classList.remove('hidden');
        }
    };
}

// --- Inicialización y Flujo del Chat ---
async function cargarIA() {
    try {
        const res = await fetch('./prompt.txt');
        systemInstruction = res.ok ? await res.text() : "";
        document.getElementById('bot-welcome-text').innerText = CONFIG.SALUDO_INICIAL;
        userInput.placeholder = CONFIG.PLACEHOLDER_INPUT;
        userInput.maxLength = CONFIG.MAX_LENGTH_INPUT;
        toggleInput(true);
        updateDemoFeedback(0);
        sendBtn.onclick = procesarMensaje;
        userInput.onkeydown = (e) => { if (e.key === 'Enter') procesarMensaje(); };
    } catch (e) { console.error("Error inicializando IA"); }
}

async function procesarMensaje() {
    const text = userInput.value.trim();
    if (messageCount >= CONFIG.MAX_DEMO_MESSAGES || text.length < CONFIG.MIN_LENGTH_INPUT) return;

    // Rate Limit (Límite de ráfaga)
    const now = Date.now(), windowMs = CONFIG.RATE_LIMIT_WINDOW_SECONDS * 1000;
    requestTimestamps = requestTimestamps.filter(t => t > now - windowMs);
    if (requestTimestamps.length >= CONFIG.RATE_LIMIT_MAX_REQUESTS) {
        agregarBurbuja(`⚠️ Espera ${Math.ceil((requestTimestamps[0] + windowMs - now) / 1000)}s antes de seguir.`, 'bot');
        return;
    }
    requestTimestamps.push(now);

    agregarBurbuja(text, 'user');
    conversationHistory.push({ role: "user", content: text });
    userInput.value = ''; toggleInput(false);
    const loadingId = mostrarLoading();

    try {
        const respuesta = await llamarIA(loadingId);
        clearTimeout(longWaitTimeoutId);
        document.getElementById(loadingId)?.remove();
        
        conversationHistory.push({ role: "assistant", content: respuesta });
        
        const cleanText = respuesta.replace('[whatsapp]', 'Escríbenos por WhatsApp para ayudarte mejor.');
        const btnLink = respuesta.includes('[whatsapp]') ? `<a href="${WA_LINK}?text=Ayuda con: ${encodeURIComponent(text)}" target="_blank" class="chat-btn">WhatsApp</a>` : "";
        
        agregarBurbuja(marked.parse(cleanText) + btnLink, 'bot');
        messageCount++;
        updateDemoFeedback(messageCount);
    } catch (e) {
        clearTimeout(longWaitTimeoutId);
        document.getElementById(loadingId)?.remove();
        agregarBurbuja(marked.parse("¡Ups! Tuve un problema de conexión. ¿Reintentamos?"), 'bot');
    } finally {
        const active = messageCount < CONFIG.MAX_DEMO_MESSAGES;
        toggleInput(active);
        if (active) userInput.focus();
    }
}

// --- Función de Red Profesional (Estándar AWS/Google) ---
async function llamarIA(loadingId) {
    let delay = CONFIG.RETRY_DELAY_MS;
    const messages = [{ role: "system", content: systemInstruction }, ...conversationHistory.slice(-CONFIG.MAX_HISTORIAL_MESSAGES)];

    // i <= RETRY_LIMIT -> Intento Inicial + N Reintentos Reales
    for (let i = 0; i <= CONFIG.RETRY_LIMIT; i++) {
        try {
            const ctrl = new AbortController();
            const tId = setTimeout(() => ctrl.abort(), CONFIG.TIMEOUT_MS);
            const res = await fetch(CONFIG.URL_PROXY, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: CONFIG.MODELO,
                    messages: messages,
                    temperature: CONFIG.TEMPERATURA,
                    top_p: CONFIG.TOP_P,
                    frequency_penalty: CONFIG.FREQUENCY_PENALTY,
                    presence_penalty: CONFIG.PRESENCE_PENALTY,
                    max_tokens: CONFIG.MAX_TOKENS_RESPONSE
                }),
                signal: ctrl.signal
            });
            clearTimeout(tId);
            if (!res.ok) throw new Error();
            const data = await res.json();
            return data.choices[0].message.content;
        } catch (err) {
            if (i === CONFIG.RETRY_LIMIT) throw err;
            if (i >= 0) {
                const el = document.getElementById(loadingId);
                if (i > 0 && el) { // Feedback visible desde el segundo intento (primer reintento)
                    el.innerHTML = `<span style="color:#d97706; font-weight: 500;">Reintentando... ${Math.round(delay/1000)}s</span>`;
                    await new Promise(r => setTimeout(r, delay));
                    delay *= 2;
                    if (el) el.innerHTML = `<div class="w-2 h-2 rounded-full typing-dot"></div><div class="w-2 h-2 rounded-full typing-dot" style="animation-delay:0.2s"></div>`;
                }
            }
        }
    }
}

// --- Utilidades de UI ---
function toggleInput(s) { userInput.disabled = !s; sendBtn.disabled = !s; }

function agregarBurbuja(html, tipo) {
    const div = document.createElement('div');
    if (tipo === 'user') {
        div.className = "p-3 max-w-[85%] text-sm text-white rounded-2xl rounded-tr-none self-end ml-auto shadow-sm";
        div.style.backgroundColor = CONFIG.COLOR_PRIMARIO;
        div.textContent = html;
    } else {
        div.className = "p-3 max-w-[85%] text-sm bg-white border border-gray-200 rounded-2xl rounded-tl-none self-start bot-bubble shadow-sm";
        div.innerHTML = html;
    }
    chatContainer.appendChild(div);
    handleScroll();
}

function mostrarLoading() {
    const id = 'load-' + Date.now(), div = document.createElement('div');
    div.id = id;
    div.className = "p-3 max-w-[85%] bg-white border border-gray-200 rounded-2xl rounded-tl-none self-start flex gap-1 shadow-sm";
    div.innerHTML = `<div class="w-2 h-2 rounded-full typing-dot"></div><div class="w-2 h-2 rounded-full typing-dot" style="animation-delay:0.2s"></div><div class="w-2 h-2 rounded-full typing-dot" style="animation-delay:0.4s"></div>`;
    chatContainer.appendChild(div);
    handleScroll();
    
    // Alerta de espera prolongada (10s)
    longWaitTimeoutId = setTimeout(() => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = `<span style="color:#d97706; font-weight: 500;">⚠️ Alta demanda, estamos procesando tu respuesta...</span>`;
    }, 10000);
    return id;
}

window.onload = () => {
    aplicarConfiguracionGlobal();
    if (CONFIG.SHEET_ID) setupAccessGate();
    else { document.getElementById('access-gate').classList.add('hidden'); chatInterface.classList.remove('hidden'); cargarIA(); }
};
