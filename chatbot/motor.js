// MOTOR.JS - Sistema de Chat con DeepSeek AI (a través de Cloudflare Proxy)

// === VARIABLES GLOBALES ===
const CHAT_CONFIG = window.CHAT_CONFIG;
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const chatContainer = document.getElementById('chat-container'); 

// IMPORTANTE: La clave de API de DeepSeek AHORA está protegida en Cloudflare Workers.
// La solicitud irá a la URL del Worker, NO a la URL oficial de DeepSeek.
const apiKey = ""; // Ya no se usa para DeepSeek, pero se mantiene vacía.
// *** REEMPLAZA ESTA URL CON LA URL DE TU CLOUDFLARE WORKER ***
const deepSeekUrl = "https://deepseek-chat-proxy.precios-com-pe.workers.dev"; 

// Instrucciones del Sistema para la IA (Define el rol y conocimiento)
const systemInstruction = `Eres Fedeliza, el asistente virtual oficial de Frankos Chicken & Grill.
1. Tu nombre es Fedeliza. Sé siempre amable, entusiasta y usa emojis de pollo 🍗.
2. Tu propósito es responder consultas sobre la carta, precios, delivery, y horarios de Frankos Chicken & Grill.
3. Utiliza la siguiente información simulada:
   - Carta: Pollo a la Brasa, Parrillas (Bife, Anticuchos), Guarniciones (Papas Fritas, Ensaladas), Postres.
   - Precios (Simulados, usar Markdown para listas): Pollo Entero S/. 65, 1/2 Pollo S/. 38, Parrilla Bife S/. 45.
   - Delivery: Costo desde S/. 5 a zonas cercanas (ej. Miraflores, San Isidro). Confirma la zona de cobertura y el costo con la dirección exacta.
   - Horario: Abierto de Lunes a Domingo, de 12:00 PM a 10:00 PM.
4. Si no puedes responder o el usuario pide hablar con una persona, invítalo a chatear por WhatsApp usando el número ${CHAT_CONFIG.whatsapp}.
5. Formatea tus respuestas de manera clara usando Markdown (listas, párrafos) para una buena lectura. Evita el uso excesivo de negritas.
6. NO busques información externa sobre Frankos Chicken & Grill. Usa únicamente la información que se te proporciona en esta instrucción.`;

// === INICIO DEL SISTEMA ===
function iniciarSistema() {
    // 1. Aplicar Configuración
    document.getElementById('header-title').innerText = CHAT_CONFIG.titulo;
    userInput.placeholder = CHAT_CONFIG.placeholder;
    document.getElementById('bot-welcome-text').innerText = CHAT_CONFIG.saludoInicial;
    document.getElementById('status-text').innerText = "Conectado. Asistente IA 🤖";
    
    toggleInput(true);

    // 2. Eventos
    sendBtn.addEventListener('click', procesarMensaje);
    userInput.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault(); 
            procesarMensaje();
        }
    });
}


// === CEREBRO PRINCIPAL (Lógica IA) ===
async function procesarMensaje() {
    const textoUsuario = userInput.value.trim();
    if (!textoUsuario) return;

    agregarBurbuja(textoUsuario, 'user');
    userInput.value = '';
    toggleInput(false);
    
    const loadingId = mostrarLoading();
    
    try {
        const respuestaIA = await generarRespuestaIA(textoUsuario);
        
        document.getElementById(loadingId)?.remove();
        
        let contenidoHTML;
        
        // Si la respuesta es el fallback, no usar marked
        if (respuestaIA.includes("Chatear por WhatsApp")) {
            contenidoHTML = respuestaIA;
        } else {
            // Usar Marked para el formato
            contenidoHTML = marked.parse(respuestaIA);
        }
        
        agregarBurbuja(contenidoHTML, 'bot');
        
    } catch (error) {
        console.error("Error al llamar a la IA de DeepSeek:", error);
        document.getElementById(loadingId)?.remove();
        
        // Fallback de error
        const linkWsp = `https://wa.me/${CHAT_CONFIG.whatsapp}?text=${encodeURIComponent("Hola, tuve un problema con el chat IA sobre: " + textoUsuario)}`;
        const errorHtml = `
            ⚠️ Lo siento, no pude comunicarme con el asistente. Revisa la URL del Worker o la clave en Cloudflare.
            <a href="${linkWsp}" class="chat-btn">Chatear por WhatsApp 🟢</a>
        `;
        agregarBurbuja(errorHtml, 'bot');
    } finally {
        toggleInput(true);
        userInput.focus();
    }
}

// Implementación del API de DeepSeek a través del Worker con retries (Exponential Backoff)
async function generarRespuestaIA(textoUsuario) {
    const maxRetries = 3;
    let delay = 1000;

    // Estructura de mensaje DeepSeek/OpenAI
    const messages = [
        { role: "system", content: systemInstruction },
        { role: "user", content: textoUsuario }
    ];
    
    const payload = {
        model: "deepseek-chat", // Modelo DeepSeek 
        messages: messages,
        temperature: 0.7,
        stream: false
    };
    
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(deepSeekUrl, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    // NO se incluye el Authorization header aquí, el Worker lo añade.
                },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                // El Worker o el API devolvieron un error
                throw new Error(`Error en la solicitud al Proxy! Código: ${response.status}`);
            }
            
            const result = await response.json();

            // Formato de respuesta DeepSeek/OpenAI
            const content = result.choices?.[0]?.message?.content;
            
            if (content) {
                return content;
            } else {
                // Si DeepSeek no pudo generar el contenido
                const fraseFail = `Lo siento, el modelo DeepSeek no pudo procesar tu solicitud. ¿Podrías reformular tu pregunta? 🧐`;
                const linkWsp = `https://wa.me/${CHAT_CONFIG.whatsapp}?text=${encodeURIComponent("Consulta no respondida: " + textoUsuario)}`;
                
                return `${fraseFail}\n<a href="${linkWsp}" class="chat-btn">Chatear por WhatsApp 🟢</a>`;
            }

        } catch (error) {
            if (i === maxRetries - 1) {
                // Último intento fallido
                throw error;
            }
            // Esperar antes de reintentar (Exponencial Backoff)
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2; 
        }
    }
}


// === UTILIDADES DE UI ===
function toggleInput(estado) {
    userInput.disabled = !estado;
    sendBtn.disabled = !estado;
    if (estado) setTimeout(() => userInput.focus(), 10);
}

function agregarBurbuja(html, tipo) {
    const container = chatContainer; 
    const div = document.createElement('div');
    const colorCliente = CHAT_CONFIG.colorPrincipal;
    
    if (tipo === 'user') {
        div.className = "p-3 max-w-[85%] shadow-sm text-sm text-white rounded-2xl rounded-tr-none self-end ml-auto";
        div.style.backgroundColor = colorCliente;
        div.textContent = html;
    } else {
        div.className = "p-3 max-w-[85%] shadow-sm text-sm bg-white text-gray-800 border border-gray-200 rounded-2xl rounded-tl-none self-start mr-auto bot-bubble";
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
        <div class="w-2 h-2 rounded-full typing-dot"></div>
        <div class="w-2 h-2 rounded-full typing-dot" style="animation-delay:0.2s"></div>
        <div class="w-2 h-2 rounded-full typing-dot" style="animation-delay:0.4s"></div>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return id;
}

// Se ejecuta al cargar la ventana
window.onload = iniciarSistema;
