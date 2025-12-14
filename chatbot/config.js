// config.js - Configuraciones Globales de Cliente y Desarrollador

export const CONFIG_BOT = {
    // === CONFIGURACIÓN DE LA EMPRESA (FRONTEND) ===
    nombre_empresa: "Frankos Chicken & Grill", 
    saludo_inicial: "¡Hola! Bienvenido a Frankos Chicken. ¿En qué puedo ayudarte hoy?", 
    icono_header: "FC", 
    
    // NOTA: La personalidad (nombre, tono, idioma, etc.) se ha movido al archivo instrucciones.txt.
};

export const TECH_CONFIG = {
    // === CONFIGURACIÓN DE LA IA (DESARROLLADOR) ===
    deepSeekUrl: "https://deepseek-chat-proxy.precios-com-pe.workers.dev", // URL del Proxy (Cloudflare Worker)
    modelo: "deepseek-chat",            // Modelo de IA a usar.
    temperatura: 0.5,                   // Nivel de creatividad (Bajo para ser preciso).
    max_retries: 3,                     // Reintentos de conexión.
    
    // === ACCESO SIMPLE (UX BARRIER) ===
    CLAVE_ACCESO: "frankos",             // CLAVE para acceso simple (SOLO UX, NO SEGURIDAD REAL)
    CLAVE_TEXTO: "Ingresa la clave de acceso para continuar:", // Mensaje del prompt de clave

    // === CONFIGURACIÓN DE UI ===
    color_principal: "#ea580c",          // Color de acento principal.
    whatsapp: "51999999999",            // SOLO NÚMEROS de WhatsApp para soporte.
    placeholder: "Escribe tu consulta...", // Texto del input
    
    // === SEGURIDAD (FRONTEND) ===
    max_length: 50,                     // Límite físico de caracteres en el input.
    min_input_length: 4,                // Evita consultas vacías o spam.
    
    // Límite de Mensajes para Demostración
    max_demo_messages: 3,               // Contador de mensajes totales para la demo.
    
    // Rate Limiting
    rate_limit_max_requests: 5,         // Máximo 5 mensajes...
    rate_limit_window_seconds: 60,      // ...por minuto.
};
