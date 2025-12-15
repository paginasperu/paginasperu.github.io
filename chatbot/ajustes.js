// ajustes.js - Configuraciones Globales PROFESIONALES Y MODULARES

// ═══════════════════════════════════════════════════════════════
// 1. CONFIGURACIÓN DE LA APLICACIÓN (APP_CONFIG)
// ═══════════════════════════════════════════════════════════════
export const APP_CONFIG = {
    NOMBRE_EMPRESA: "Frankos Chicken",       // Nombre visible principal (ej. en el Header).
    VERSION: "1.0.0",                       // Versión actual de la aplicación.
    MODO_ENTORNO: "development",            
    
    // SEO Y METADATOS (CRÍTICO)
    TITLE_SUFFIX: "| Asistente de Pedidos y Soporte", 
    META_DESCRIPTION: "Chatea con nuestro asistente virtual para realizar pedidos, consultar el menú y obtener soporte rápido en Frankos Chicken.",
};

// ═══════════════════════════════════════════════════════════════
// 2. CONFIGURACIÓN DE LA INTERFAZ (UI_CONFIG)
// ═══════════════════════════════════════════════════════════════
export const UI_CONFIG = {
    // Branding Visual
    COLOR_PRIMARIO: "#ea580c",              // Color de acento principal (botones, header, burbujas del usuario).
    ICONO_HEADER: "FC",                     // Texto o Emoji que aparece en el header del chat (Fallback si no hay LOGO_URL).
    FAVICON_EMOJI: "🐔",                    // Icono que sale en la pestaña del navegador.
    LOGO_URL: "https://i.ibb.co/W4m7vxxn/logo-frankos-chicken.jpg",                           // URL completa a un logo de imagen (ej: "https://tudominio.com/logo.png"). Dejar "" para usar ICONO_HEADER.
    
    // Textos Estáticos (Visibles al Cliente)
    SALUDO_INICIAL: "¡Hola! Bienvenido a Frankos Chicken. ¿En qué puedo ayudarte hoy?",
    TEXTO_CLAVE_ACCESO: "Ingresa la clave de acceso para continuar:",
    TEXTO_BOTON_ACCESO: "Ingresar al Chat", // Texto del botón de la puerta de acceso.
    PLACEHOLDER_INPUT: "Escribe tu consulta...",
    FOOTER_TEXTO: "Chat oficial.pe",         // Texto en el pie de página del chat.
    
    // Integración
    WHATSAPP_NUMERO: "51949973277",         // Número de WhatsApp para el CTA de ayuda.
    
    // UX Avanzada (Modo Demo)
    SHOW_REMAINING_MESSAGES: true,          // Muestra al usuario cuántos mensajes de demo quedan.
    WARNING_THRESHOLD: 1,                   // Número de mensajes restantes para mostrar la alerta de advertencia.
};


// ═══════════════════════════════════════════════════════════════
// 3. CONFIGURACIÓN DEL MODELO DE IA Y CONEXIÓN (AI_CONFIG)
// ═══════════════════════════════════════════════════════════════
export const AI_CONFIG = {
    URL_PROXY: "https://deepseek-chat-proxy.precios-com-pe.workers.dev",
    MODELO: "deepseek-chat",                // Modelo de DeepSeek a utilizar.
    TEMPERATURA: 0.5,                       // Creatividad de la IA (0.0 muy preciso, 1.0 muy creativo).
    
    // Control de Robustez y Costos
    TIMEOUT_MS: 15000,                      // Tiempo máximo de espera para la API (15 segundos).
    MAX_TOKENS_RESPONSE: 300,               // MÁXIMO DE TOKENS que la IA puede generar (Control de Costos).
    MAX_CONTEXT_MESSAGES: 4,                // Cuántos mensajes previos se envían como contexto.
    
    // Manejo de Reintentos
    RETRY_LIMIT: 3,                         // Número de veces que se reintenta la llamada a la API.
    RETRY_DELAY_MS: 1000,                   // Delay inicial para el Backoff Exponencial.
    ENABLE_LOGGING: true,                   // Activar/desactivar logs de consola para debug.
};


// ═══════════════════════════════════════════════════════════════
// 4. CONFIGURACIÓN DE SEGURIDAD Y LÍMITES (SEGURIDAD_CONFIG)
// ═══════════════════════════════════════════════════════════════
export const SEGURIDAD_CONFIG = {
    // Acceso
    CLAVE_ACCESO: "",                       // Clave requerida para entrar al chat. Dejar "" para bypass.
    
    // Validación de Input
    MIN_LENGTH_INPUT: 4,                    // Longitud mínima para un mensaje válido.
    MAX_LENGTH_INPUT: 150,                  // Longitud máxima del mensaje (Estratégico para modo Demo).
    
    // Límite de Demo (Frontend)
    MAX_DEMO_MESSAGES: 5,                   // Límite de mensajes para la demo por sesión.
    
    // Rate Limiting (Frontend - Complementa al Worker)
    RATE_LIMIT_MAX_REQUESTS: 5,             // Máximo de requests permitidas en la ventana.
    RATE_LIMIT_WINDOW_SECONDS: 60,          // Ventana de tiempo (en segundos) para el Rate Limit.
};
