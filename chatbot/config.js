window.CHAT_CONFIG = {
    // === DISEÑO VISUAL ===
    titulo: "Asistente Fedeliza",
    colorPrincipal: "#d73517",
    saludoInicial: "¡Hola! Soy Fedeliza. ¿En qué puedo ayudarte? 🍗",
    placeholder: "Pregunta precios o horarios...",

    // === LÍMITE DE USO (FILTRO DE CORTESÍA DEL CLIENTE) ===
    spamLimit: 30,
    spamDurationMinutes: 60,

    // === LISTA DE CEREBROS (Estrategia: DeepSeek -> Claude) ===
    // Prioridad 1: DeepSeek (Costo bajo, alta cuota)
    // Prioridad 2: Claude (Respaldo de calidad premium)
    proveedores: [
        {
            // PROVEEDOR 1 (PRINCIPAL): DeepSeek
            // Este será tu motor de chat diario.
            nombre: "DeepSeek (Prioritario)",
            tipo: "openai-compatible", // Usamos el tipo "openai-compatible" para DeepSeek
            modelo: "deepseek-chat",
            // IMPORTANTE: Necesitas una CLAVE DE PAGO y un PROXY funcionando.
            apiKey: "CLAVE_DEEPSEEK_PENDIENTE", 
            proxies: [
                "https://api.deepseek.com/chat/completions",       // CAUSA FALLO CORS (Solo para prueba)
                "https://SU_PROXY_CLOUDFLARE_AQUI.workers.dev/v1/chat/completions" // URL REAL DE SU TRABAJADOR
            ]
        },
        {
            // PROVEEDOR 2 (RESPALDO): Anthropic Claude
            // Este es un proveedor de alta calidad para usar si DeepSeek falla.
            // NOTA: Claude requiere un PROXY y puede necesitar un formato de datos diferente al de OpenAI.
            nombre: "Claude 3 Haiku (Respaldo Premium)",
            tipo: "openai-compatible", // Se asume que usarás un proxy para normalizar el formato
            modelo: "claude-3-haiku", 
            apiKey: "CLAVE_ANTHROPIC_PENDIENTE", 
            proxies: [
                "https://SU_PROXY_CLAUDE.workers.dev/v1/messages" // Endpoint de Claude (a través de tu proxy)
            ]
        }
        // Todos los proveedores Gemini han sido eliminados.
    ]
};
