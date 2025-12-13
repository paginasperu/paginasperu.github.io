window.CHAT_CONFIG = {
    // === DISEÑO VISUAL ===
    titulo: "Asistente Dra. Ana",
    colorPrincipal: "#2563eb",
    saludoInicial: "¡Hola! Soy Ana. ¿En qué puedo ayudarte? 🦷",
    placeholder: "Pregunta precios o horarios...",

    // === LÍMITE DE USO (FILTRO DE CORTESÍA DEL CLIENTE) ===
    spamLimit: 30,
    spamDurationMinutes: 60,

    // === LISTA DE CEREBROS (Estrategia: Estabilidad y Cuota Alta) ===
    proveedores: [
        {
            // PROVEEDOR PRINCIPAL: Usamos la versión 1.5 Flash ESTÁNDAR.
            // Esta versión tiene una cuota gratuita de aprox. 1,500 peticiones/día.
            // NO USAR versiones "exp", "preview" o "2.0" aquí, ya que esas tienen límites de 20-50 al día.
            nombre: "Gemini 1.5 Flash (Alta Disponibilidad)",
            tipo: "google",
            apiKey: "TU_CLAVE_ACTIVA_DE_GEMINI", 
            modelo: "gemini-1.5-flash"
        },
        {
            // RESPALDO: Versión Pro. Más inteligente pero más lenta y con menos cuota (aprox 50/día).
            nombre: "Gemini 1.5 Pro (Respaldo)",
            tipo: "google",
            apiKey: "TU_CLAVE_ACTIVA_DE_GEMINI", 
            modelo: "gemini-1.5-pro"
        },
        {
            // ÚLTIMO RECURSO: DeepSeek
            // Solo se activará si Google bloquea totalmente tu proyecto.
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
