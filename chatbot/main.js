import { CONFIG } from './config.js';
import { marked } from 'https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js';

const MOCK_RESPONSES = [
    "¡Hola! Esta es una respuesta simulada para mostrarte cómo luce el chat. 😊",
    "Entiendo perfectamente tu consulta, pero recuerda que ahora estoy en modo de prueba.",
    "Como asistente virtual en demo, puedo decirte que el diseño se adapta a cualquier dispositivo.",
    "¡Qué buena pregunta! En la versión real, analizaría esto con inteligencia artificial avanzada.",
    "Llegaste al límite de la demostración. ¿Te gustaría activar la IA real ahora?"
];

let systemInstruction = "", conversationHistory = [], messageCount = 0, requestTimestamps = [];
const userInput = document.getElementById('userInput'), sendBtn = document.getElementById('sendBtn'), chatContainer = document.getElementById('chat-container');
const feedbackDemoText = document.getElementById('feedback-demo-text'), WA_LINK = `https://wa.me/${CONFIG.WHATSAPP_NUMERO}`;

window.onload = () => {
    aplicarConfiguracionGlobal();
    cargarIA();
};

function aplicarConfiguracionGlobal() {
    document.title = CONFIG.NOMBRE_EMPRESA;
    document.documentElement.style.setProperty('--chat-color', CONFIG.COLOR_PRIMARIO);
    const headerIcon = document.getElementById('header-icon-initials');
    if (CONFIG.LOGO_URL && headerIcon) {
        headerIcon.innerHTML = `<img src="${CONFIG.LOGO_URL}" alt="${CONFIG.NOMBRE_EMPRESA}" class="w-full h-full object-contain rounded-full">`;
    } else if (headerIcon) { headerIcon.innerText = CONFIG.ICONO_HEADER; }
    document.getElementById('header-title').innerText = CONFIG.NOMBRE_EMPRESA;
    const linkIcon = document.querySelector("link[rel*='icon']");
    if (linkIcon) {
        linkIcon.href = `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>${CONFIG.FAVICON_EMOJI}</text></svg>`;
    }
}

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
    } catch (e) { console.error("Error"); }
}

async function procesarMensaje() {
    const text = userInput.value.trim();
    if (messageCount >= CONFIG.MAX_DEMO_MESSAGES || !text) return;

    if (!CONFIG.DEMO_MODE) {
        const now = Date.now(), windowMs = CONFIG.RATE_LIMIT_WINDOW_SECONDS * 1000;
        requestTimestamps = requestTimestamps.filter(t => t > now - windowMs);
        if (requestTimestamps.length >= CONFIG.RATE_LIMIT_MAX_REQUESTS) return;
        requestTimestamps.push(now);
    }

    agregarBurbuja(text, 'user');
    conversationHistory.push({ role: "user", content: text });
    userInput.value = ''; toggleInput(false);
    const loadingId = mostrarLoading();

    try {
        let respuesta;
        if (CONFIG.DEMO_MODE) {
            await new Promise(r => setTimeout(r, 1000));
            respuesta = MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)];
        } else {
            respuesta = await llamarIA();
        }
        document.getElementById(loadingId)?.remove();
        agregarBurbuja(marked.parse(respuesta), 'bot');
        conversationHistory.push({ role: "assistant", content: respuesta });
        messageCount++;
        updateDemoFeedback(messageCount);
    } catch (e) {
        document.getElementById(loadingId)?.remove();
        if (messageCount < CONFIG.MAX_DEMO_MESSAGES) {
            agregarBurbuja("¡Ups! Hubo un problema.", 'bot');
        }
    } finally {
        const canContinue = messageCount < CONFIG.MAX_DEMO_MESSAGES;
        toggleInput(canContinue);
        if (canContinue) userInput.focus();
    }
}

async function llamarIA() {
    const messages = [{ role: "system", content: systemInstruction }, ...conversationHistory.slice(-CONFIG.MAX_HISTORIAL_MESSAGES)];
    const res = await fetch(CONFIG.URL_PROXY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: CONFIG.MODELO, messages, temperature: CONFIG.TEMPERATURA,
            max_tokens: CONFIG.MAX_TOKENS_RESPONSE
        })
    });
    if (!res.ok) throw new Error();
    const data = await res.json();
    return data.choices[0].message.content;
}

function updateDemoFeedback(count) {
    if (!CONFIG.SHOW_REMAINING_MESSAGES || !feedbackDemoText) return;
    const remaining = CONFIG.MAX_DEMO_MESSAGES - count;
    if (remaining <= 0) {
        feedbackDemoText.innerText = `🛑 Límite alcanzado.`;
        feedbackDemoText.style.color = "red";
    } else if (remaining <= CONFIG.WARNING_THRESHOLD) {
        feedbackDemoText.innerText = `⚠️ Te quedan ${remaining} mensajes.`;
        feedbackDemoText.style.color = CONFIG.COLOR_PRIMARIO;
    }
}

function toggleInput(s) { userInput.disabled = !s; sendBtn.disabled = !s; }

function agregarBurbuja(html, tipo) {
    const div = document.createElement('div');
    div.className = tipo === 'user' ? "p-3 max-w-[85%] text-sm text-white rounded-2xl rounded-tr-none self-end ml-auto shadow-sm" : "p-3 max-w-[85%] text-sm bg-white border border-gray-200 rounded-2xl rounded-tl-none self-start bot-bubble shadow-sm";
    if (tipo === 'user') { div.style.backgroundColor = CONFIG.COLOR_PRIMARIO; div.textContent = html; }
    else { div.innerHTML = html; }
    chatContainer.appendChild(div);
    chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
}

function mostrarLoading() {
    const id = 'load-' + Date.now(), div = document.createElement('div');
    div.id = id; div.className = "p-3 max-w-[85%] bg-white border border-gray-200 rounded-2xl rounded-tl-none self-start flex gap-1 shadow-sm";
    div.innerHTML = `<div class="w-2 h-2 rounded-full typing-dot"></div><div class="w-2 h-2 rounded-full typing-dot" style="animation-delay:0.2s"></div><div class="w-2 h-2 rounded-full typing-dot" style="animation-delay:0.4s"></div>`;
    chatContainer.appendChild(div);
    chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
    return id;
}
