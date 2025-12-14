// config.js - Configuraciones Globales y Seguridad

export const TECH_CONFIG = {
    // URL del Proxy (Tu Cloudflare Worker)
    deepSeekUrl: "https://deepseek-chat-proxy.precios-com-pe.workers.dev", 
    
    // === OPTIMIZACIÓN DE TOKENS (SALIDA) ===
    modelo: "deepseek-chat",
    temperatura: 0.5,           // Bajo para ser preciso, directo y ahorrar tokens.
    
    // === CONFIGURACIÓN DE UI ===
    color_principal: "#ea580c",     
    whatsapp: "51999999999",       // SOLO NÚMEROS
    placeholder: "Escribe tu consulta...",
    
    // === SEGURIDAD Y BLINDAJE (CLIENTE) ===
    max_length: 150,                // Límite físico de caracteres en el input.
    min_input_length: 4,            // Evita consultas vacías o spam de "a", "b".
    max_retries: 3,                 // Reintentos de conexión.
    
    // === RATE LIMITING (Anti-DDoS / Ahorro de Presupuesto) ===
    rate_limit_max_requests: 5,     // Máximo 5 mensajes...
    rate_limit_window_seconds: 60,  // ...por minuto.
};

// Objeto contenedor para la personalidad (se carga dinámicamente)
export const CONFIG_BOT = {};
