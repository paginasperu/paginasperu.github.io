import { CONFIG } from './config.js';
import { marked } from 'https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js';

let systemInstruction = "";
let conversationHistory = [];
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const chatContainer = document.getElementById('chat-container');
const chatInterface = document.getElementById('chat-interface');
const accessGate = document.getElementById('access-gate');
const keyInput = document.getElementById('keyInput');
const keySubmit = document.getElementById('keySubmit');
const keyError = document.getElementById('keyError');


const WA_LINK = `https://wa.me/${CONFIG.WHATSAPP_NUMERO}`;
const requestTimestamps = [];
let messageCount = 0;


function aplicarConfiguracionGlobal() {
    document.title = CONFIG.NOMBRE_EMPRESA || "Chatbot";
    
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) { }

    const linkIcon = document.querySelector("link[rel*='icon']");
    if (linkIcon) {
        linkIcon.href = `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>${CONFIG.FAVICON_EMOJI}</text></svg>`;
    }

    document.documentElement.style.setProperty('--chat-color', CONFIG.COLOR_PRIMARIO);
    
    const headerIconInitials = document.getElementById('header-icon-initials');
    
    if (CONFIG.LOGO_URL && headerIconInitials) {
        const img = document.createElement('img');
        img.src = CONFIG.LOGO_URL;
        img.alt = CONFIG.NOMBRE_EMPRESA;
        img.className = 'w-full h-full object-contain rounded-full';
        headerIconInitials.innerHTML = '';
        headerIconInitials.appendChild(img);
    } else if (headerIconInitials) {
        headerIconInitials.innerText = CONFIG.ICONO_HEADER;
    }
    
    const headerTitle = document.getElementById('header-title');
    if (headerTitle.innerText === "Cargando...") headerTitle.innerText = CONFIG.NOMBRE_EMPRESA;
}


async function cargarYAnalizarContexto() {
    try {
        document.getElementById('status-text').innerText = "Cargando sistema...";

        const resContexto = await fetch('./prompt.txt');

        if (!resContexto.ok) throw new Error("Error cargando archivo de contexto (prompt.txt)");

        let systemInstruction = await resContexto.text();
        
        systemInstruction = systemInstruction
            .replace(/\[nombre_empresa\]/g, CONFIG.NOMBRE_EMPRESA || 'Empresa');
            
        return systemInstruction;

    } catch (error) {
        console.error("Error crítico en carga de contexto:", error);
        return "Error de sistema. Contacte a soporte.";
    }
}


function checkRateLimit() {
    const now = Date.now();
    const windowMs = CONFIG.RATE_LIMIT_WINDOW_SECONDS * 1000;
    
    while (requestTimestamps.length > 0 && requestTimestamps[0] < now - windowMs) {
        requestTimestamps.shift();
    }

    if (requestTimestamps.length >= CONFIG.RATE_LIMIT_MAX_REQUESTS) {
        return {
            limitReached: true,
            retryAfter: Math.ceil((requestTimestamps[0] + windowMs - now) / 1000)
        };
    }
    
    requestTimestamps.push(now);
    return { limitReached: false };
}


function getExportUrl(sheetId) {
    if (!sheetId || typeof sheetId !== 'string') {
        console.error("ID de Google Sheets inválido.");
        return null;
    }
    return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json`;
}


function setupAccessGate() {
    keySubmit.style.backgroundColor = CONFIG.COLOR_PRIMARIO;
    
    let sheetAccessKey = "";
    let sheetExpirationDate = "";

    const fetchSheetConfig = async () => {
        try {
            keyError.innerText = "Cargando configuración de seguridad...";
            keyError.classList.remove('hidden');

            const exportUrl = getExportUrl(CONFIG.SHEET_ID);
            if (!exportUrl) throw new Error("ID de configuración inválida.");

            const res = await fetch(exportUrl);
            if (!res.ok) throw new Error("No se pudo cargar la configuración.");

            const text = await res.text();
            
            const jsonText = text.replace(/.*google.visualization.Query.setResponse\((.*)\);/s, '$1');
            const data = JSON.parse(jsonText);

            const row = data.table.rows[0].c;
            
            sheetAccessKey = row[0] && row[0].v !== null ? String(row[0].v).toLowerCase() : ""; 
            sheetExpirationDate = row[1] && row[1].v !== null ? row[1].v : ""; 
            
            keyError.classList.add('hidden');
            keyError.innerText = "";
            return true;

        } catch (error) {
            console.error("Error al cargar configuración de Sheet:", error);
            keyError.innerText = "Error: No se pudo obtener la clave del servidor.";
            keyError.classList.remove('hidden');
            return false;
        }
    };

    const isKeyExpired = () => {
        if (!sheetExpirationDate) return false;
        
        let dateString = sheetExpirationDate;
        
        // Lógica de corrección para formato DD-MM-YYYY HH:mm:ss (Formato peruano local)
        const match = dateString.match(/^(\d{2})-(\d{2})-(\d{4}) (\d{2}:\d{2}:\d{2})$/);
        
        if (match) {
            // Reorganiza a YYYY-MM-DDTHH:mm:ss SIN OFFSET (utiliza la hora local de la PC)
            const [full, day, month, year, time] = match;
            dateString = `${year}-${month}-${day}T${time}`; 
        } else if (dateString.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
            // Maneja el formato YYYY-MM-DD HH:mm:ss
            dateString = dateString.replace(' ', 'T'); 
        }

        const expirationDate = new Date(dateString); 
        const now = new Date(); 
        
        if (isNaN(expirationDate)) {
             console.error("Fecha de expiración inválida en Sheet:", sheetExpirationDate);
             return false;
        }
        
        // CORRECCIÓN CRÍTICA: Usa >= para incluir el momento exacto de la expiración
        return now.getTime() >= expirationDate.getTime();
    };

    const checkKey = async () => {
        const loaded = await fetchSheetConfig(); 
        if (!loaded) return; 

        const realKey = sheetAccessKey; 
        const input = keyInput.value.trim().toLowerCase();
        
        const hasExpired = isKeyExpired();

        // 1. Clave expirada (y hay clave definida)
        if (realKey !== "" && hasExpired) {
            keyError.classList.remove('hidden');
            keyError.innerText = "La clave de acceso ha caducado. Contacta al administrador.";
            return; 
        }
        
        // 2. Clave vacía en el Sheet (Permite acceso inmediato sin necesidad de ingresar nada)
        if (realKey === "") {
            keyError.classList.add('hidden');
            accessGate.classList.add('hidden');
            chatInterface.classList.remove('hidden');
            cargarIA();
            return;
        }

        // 3. Validación ESTRICTA (Si hay clave y no ha expirado)
        if (input === realKey) {
            keyError.classList.add('hidden');
            accessGate.classList.add('hidden');
            chatInterface.classList.remove('hidden');
            cargarIA();
        } else {
            keyError.innerText = "Clave incorrecta. Intenta de nuevo.";
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
    
    fetchSheetConfig(); 
}

async function cargarIA() {
    systemInstruction = await cargarYAnalizarContexto();
    
    document.getElementById('header-title').innerText = CONFIG.NOMBRE_EMPRESA || "Chat";
    document.getElementById('bot-welcome-text').innerText = CONFIG.SALUDO_INICIAL || "Hola.";
    document.getElementById('status-text').innerText = "En línea 🟢";
    
    userInput.setAttribute('maxlength', CONFIG.MAX_LENGTH_INPUT);
    userInput.setAttribute('placeholder', CONFIG.PLACEHOLDER_INPUT);
    
    toggleInput(true);

    sendBtn.addEventListener('click', procesarMensaje);
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); procesarMensaje(); }
    });
}

async function iniciarSistema() {
    aplicarConfiguracionGlobal();
    
    if (CONFIG.SHEET_ID) {
        setupAccessGate();
    } else {
        accessGate.classList.add('hidden');
        chatInterface.classList.remove('hidden');
        cargarIA();
    }
}

async function procesarMensaje() {
    const textoUsuario = userInput.value.trim();
    
    if (messageCount >= CONFIG.MAX_DEMO_MESSAGES) {
        const demoEndMsg = `🛑 ¡Demo finalizado! Has alcanzado el límite de ${CONFIG.MAX_DEMO_MESSAGES} mensajes. Por favor, contáctanos para continuar.`;
        if (messageCount === CONFIG.MAX_DEMO_MESSAGES) {
             agregarBurbuja(demoEndMsg, 'bot');
             messageCount++;
        }
        userInput.value = '';
        toggleInput(false);
        return;
    }
    
    if (CONFIG.SHOW_REMAINING_MESSAGES &&
        messageCount >= CONFIG.MAX_DEMO_MESSAGES - CONFIG.WARNING_THRESHOLD &&
        messageCount < CONFIG.MAX_DEMO_MESSAGES) {
        
        const remaining = CONFIG.MAX_DEMO_MESSAGES - messageCount;
        agregarBurbuja(`⚠️ Atención: Te quedan ${remaining} mensaje(s) de demostración.`, 'bot');
    }

    if (!textoUsuario) return;
    if (textoUsuario.length < CONFIG.MIN_LENGTH_INPUT || textoUsuario.length > CONFIG.MAX_LENGTH_INPUT) {
        userInput.value = '';
        return;
    }

    const limit = checkRateLimit();
    if (limit.limitReached) {
        agregarBurbuja(`⚠️ Demasiadas consultas. Espera ${limit.retryAfter}s.`, 'bot');
        userInput.value = '';
        return;
    }

    agregarBurbuja(textoUsuario, 'user');
    
    conversationHistory.push({ role: "user", content: textoUsuario });
    
    userInput.value = '';
    toggleInput(false);
    const loadingId = mostrarLoading();
    
    try {
        const respuesta = await llamarIA();
        document.getElementById(loadingId)?.remove();
        
        conversationHistory.push({ role: "assistant", content: respuesta });

        const whatsappCheck = `[whatsapp_link]`;
        let htmlFinal = "";

        if (respuesta.includes(whatsappCheck)) {
            const cleanText = respuesta.replace(whatsappCheck, 'Para más detalles, comunícate por WhatsApp.');
            const btnLink = `<a href="${WA_LINK}?text=${encodeURIComponent('Necesito ayuda con la consulta: ' + textoUsuario)}" target="_blank" class="chat-btn">Contáctanos aquí</a>`;
            htmlFinal = marked.parse(cleanText) + btnLink;
        } else {
            htmlFinal = marked.parse(respuesta);
        }
        
        agregarBurbuja(htmlFinal, 'bot');
        messageCount++;

    } catch (e) {
        document.getElementById(loadingId)?.remove();
        console.error("Error en llamada IA:", e);
        agregarBurbuja(`Error de conexión o timeout. <a href="${WA_LINK}" class="chat-btn">WhatsApp</a>`, 'bot');
    } finally {
        if (messageCount >= CONFIG.MAX_DEMO_MESSAGES) {
            toggleInput(false);
        } else {
            toggleInput(true);
            userInput.focus();
        }
    }
}

async function llamarIA() {
    const { MODELO, TEMPERATURA, RETRY_LIMIT, RETRY_DELAY_MS, URL_PROXY, TIMEOUT_MS, MAX_TOKENS_RESPONSE, MAX_HISTORIAL_MESSAGES } = CONFIG;
    let delay = RETRY_DELAY_MS;
    
    let messages = [
        { role: "system", content: systemInstruction }
    ];

    const contextStart = Math.max(0, conversationHistory.length - MAX_HISTORIAL_MESSAGES);
    messages = messages.concat(conversationHistory.slice(contextStart));


    for (let i = 0; i < RETRY_LIMIT; i++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

            const res = await fetch(URL_PROXY, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: MODELO,
                    messages: messages,
                    temperature: TEMPERATURA,
                    max_tokens: MAX_TOKENS_RESPONSE,
                    stream: false
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!res.ok) throw new Error(`API Error: ${res.status}`);
            const data = await res.json();
            
            return data.choices?.[0]?.message?.content || "No entendí, ¿puedes repetir?";

        } catch (err) {
            if (err.name === 'AbortError') {
                throw new Error("API Timeout");
            }
            if (i === RETRY_LIMIT - 1) throw err;
            await new Promise(r => setTimeout(r, delay));
            delay *= 2;
        }
    }
}

function toggleInput(state) {
    userInput.disabled = !state;
    sendBtn.disabled = !state;
}

function agregarBurbuja(html, tipo) {
    const div = document.createElement('div');
    if (tipo === 'user') {
        div.className = "p-3 max-w-[85%] shadow-sm text-sm text-white rounded-2xl rounded-tr-none self-end ml-auto";
        div.style.backgroundColor = CONFIG.COLOR_PRIMARIO;
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
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return id;
}

window.onload = iniciarSistema;
