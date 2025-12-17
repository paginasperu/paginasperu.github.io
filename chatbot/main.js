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
const userInput = document.getElementById('userInput'), 
      sendBtn = document.getElementById('sendBtn'), 
      chatContainer = document.getElementById('chat-container'),
      feedbackDemoText = document.getElementById('feedback-demo-text'), 
      WA_LINK = `https://wa.me/${CONFIG.WHATSAPP_NUMERO}`;

window.onload = () => {
    aplicarConfiguracionGlobal();
    cargarIA();
};

function aplicarConfiguracionGlobal() {
    document.title = CONFIG.NOMBRE_EMPRESA;
    document.documentElement.style.setProperty('--chat-color', CONFIG.COLOR_PRIMARIO);
    
    const headerTitle = document.getElementById('header-title');
    if (headerTitle) headerTitle.innerText = CONFIG.NOMBRE_EMPRESA;

    const headerIcon = document.getElementById('header-icon-initials');
    if (CONFIG.LOGO_URL && headerIcon) {
        headerIcon.innerHTML = `<img src="${CONFIG.LOGO_URL}" class="w-full h-full object-cover">`;
    } else if (headerIcon) {
        headerIcon.innerText = CONFIG.ICONO_HEADER;
    }

    userInput.placeholder = CONFIG.PLACEHOLDER_INPUT;
    userInput.maxLength = CONFIG.MAX_LENGTH_INPUT;
}

async function cargarIA() {
    try {
        // Se añade la versión a la carga del prompt para asegurar frescura de datos
        const res = await fetch(`./prompt.txt?v=${CONFIG.VERSION}`);
        systemInstruction = res.ok ? await res.text() : "";
        document.getElementById('bot-welcome-text').innerText = CONFIG.SALUDO_INICIAL;
        toggleInput(true);
    } catch (e) {
        console.error("Error cargando configuración IA:", e);
    }
}

async function enviarMensaje() {
    const text = userInput.value.trim();
    if (!text) return;

    if (messageCount >= CONFIG.MAX_DEMO_MESSAGES) {
        mostrarMensaje(`Has alcanzado el límite de la demostración. Para continuar, contáctanos vía WhatsApp: <a href="${WA_LINK}" class="underline font-bold text-orange-600" target="_blank">Click aquí</a>`, 'bot');
        userInput.value = "";
        return;
    }

    mostrarMensaje(text, 'user');
    userInput.value = "";
    messageCount++;
    actualizarContadorDemo();

    if (CONFIG.DEMO_MODE) {
        const loadId = mostrarLoading();
        setTimeout(() => {
            eliminarLoading(loadId);
            mostrarMensaje(MOCK_RESPONSES[Math.min(messageCount - 1, MOCK_RESPONSES.length - 1)], 'bot');
        }, 1000);
        return;
    }

    const loadId = mostrarLoading();
    toggleInput(false);

    try {
        conversationHistory.push({ role: "user", content: text });
        const res = await fetch(CONFIG.URL_PROXY, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: CONFIG.MODELO,
                messages: [{ role: "system", content: systemInstruction }, ...conversationHistory.slice(-CONFIG.MAX_HISTORIAL_MESSAGES)],
                temperature: CONFIG.TEMPERATURA,
                max_tokens: CONFIG.MAX_TOKENS_RESPONSE,
                top_p: CONFIG.TOP_P
            })
        });

        const data = await res.json();
        const reply = data.choices[0].message.content;
        eliminarLoading(loadId);
        mostrarMensaje(marked.parse(reply), 'bot');
        conversationHistory.push({ role: "assistant", content: reply });
    } catch (e) {
        eliminarLoading(loadId);
        mostrarMensaje("Lo siento, tuve un problema técnico. ¿Podrías intentar de nuevo?", 'bot');
    } finally {
        toggleInput(true);
        userInput.focus();
    }
}

sendBtn.onclick = enviarMensaje;
userInput.onkeypress = (e) => { if (e.key === 'Enter') enviarMensaje(); };

function mostrarMensaje(html, tipo) {
    const div = document.createElement('div');
    div.className = tipo === 'user' 
        ? "p-3 max-w-[85%] text-sm text-white rounded-2xl rounded-tr-none self-end shadow-md" 
        : "p-3 max-w-[85%] text-sm bg-white border border-gray-200 rounded-2xl rounded-tl-none self-start shadow-sm bot-bubble";
    
    if (tipo === 'user') { 
        div.style.backgroundColor = CONFIG.COLOR_PRIMARIO; 
        div.textContent = html; 
    } else { 
        div.innerHTML = html; 
    }
    chatContainer.appendChild(div);
    chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
}

function mostrarLoading() {
    const id = 'load-' + Date.now(), div = document.createElement('div');
    div.id = id; 
    div.className = "p-3 max-w-[85%] bg-white border border-gray-200 rounded-2xl rounded-tl-none self-start flex gap-1 shadow-sm";
    div.innerHTML = `<div class=\"w-2 h-2 rounded-full typing-dot\"></div><div class=\"w-2 h-2 rounded-full typing-dot\" style=\"animation-delay: 0.2s\"></div><div class=\"w-2 h-2 rounded-full typing-dot\" style=\"animation-delay: 0.4s\"></div>`;
    chatContainer.appendChild(div);
    chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
    return id;
}

function eliminarLoading(id) { const el = document.getElementById(id); if (el) el.remove(); }
function toggleInput(s) { userInput.disabled = !s; sendBtn.disabled = !s; }

function actualizarContadorDemo() {
    const remaining = CONFIG.MAX_DEMO_MESSAGES - messageCount;
    if (remaining > 0) {
        feedbackDemoText.innerText = `PRUEBA: Te quedan ${remaining} mensajes`;
        feedbackDemoText.className = "text-[10px] uppercase font-bold mb-2 text-center h-4 tracking-widest text-orange-500";
    } else {
        feedbackDemoText.innerText = "LÍMITE ALCANZADO";
        feedbackDemoText.className = "text-[10px] uppercase font-bold mb-2 text-center h-4 tracking-widest text-red-600";
        toggleInput(false);
    }
}
