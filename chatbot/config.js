window.CHAT_CONFIG = {
    // === DISEÑO VISUAL ===
    titulo: "Asistente Fedeliza",
    colorPrincipal: "#D73517",
    saludoInicial: "¡Hola! Soy Fedeliza. ¿En qué puedo ayudarte? 🍗",
    placeholder: "Pregunta precios o horarios...",

    // === LÍMITE DE USO (FILTRO DE CORTESÍA DEL CLIENTE) ===
    spamLimit: 30,
    spamDurationMinutes: 60,

    // === LISTA DE CEREBROS (Estrategia: Flash Lite para Volumen) ===
    proveedores: [
        {
            // PROVEEDOR 1 (PRINCIPAL): Flash Lite Latest
            // Este alias apunta a la versión "Lite" más estable y actual.
            // Diseñado para alta velocidad y bajo costo (mejor cuota gratuita).
            nombre: "Gemini Flash Lite (Latest)",
            tipo: "google",
            // 👇 PEGA TU NUEVA CLAVE AQUÍ
            apiKey: "AIzaSyAT_deiQjOuaiEedotekG2KV5aGsBrFZx4", 
            modelo: "gemini-flash-lite-latest"
        },
        {
            // PROVEEDOR 2 (RESPALDO): Versión Específica 2.0 Lite
            // Usamos la versión específica que apareció en tu lista.
            nombre: "Gemini 2.0 Flash Lite (02-05)",
            tipo: "google",
            apiKey: "AIzaSyAT_deiQjOuaiEedotekG2KV5aGsBrFZx4", 
            modelo: "gemini-2.0-flash-lite-preview-02-05"
        },
        {
            // PROVEEDOR 3: Gemini 2.0 Flash (Estándar)
            // Si los Lite fallan, intentamos con el estándar.
            nombre: "Gemini 2.0 Flash (Estándar)",
            tipo: "google",
            apiKey: "AIzaSyAT_deiQjOuaiEedotekG2KV5aGsBrFZx4", 
            modelo: "gemini-2.0-flash"
        },
        {
            // ÚLTIMO RECURSO: DeepSeek
            nombre: "DeepSeek (Emergencia)",
            tipo: "openai-compatible",
            modelo: "deepseek-chat",
            apiKey: "CLAVE_DEEPSEEK_PENDIENTE", 
            proxies: [
                "https://tu-proxy-1.workers.dev/chat/completions"
            ]
        }
    ]
};
