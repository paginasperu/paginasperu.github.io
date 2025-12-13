window.CHAT_CONFIG = {
    // === DISEÑO VISUAL ===
    titulo: "Asistente Dra. Ana",
    colorPrincipal: "#2563eb",
    saludoInicial: "¡Hola! Soy Ana. ¿En qué puedo ayudarte? 🦷",
    placeholder: "Pregunta precios o horarios...",

    // === LÍMITE DE USO (FILTRO DE CORTESÍA DEL CLIENTE) ===
    spamLimit: 30,
    spamDurationMinutes: 60,

    // === LISTA DE CEREBROS (Prioridad: Gemini 1.5 Flash) ===
    proveedores: [
        {
            // PROVEEDOR 1: Gemini 1.5 Flash
            // Rápido, inteligente y con cuota gratuita alta (~1,500/día) en proyectos nuevos.
            nombre: "Gemini 1.5 Flash (Principal)",
            tipo: "google",
            // 👇 ¡PEGA TU NUEVA CLAVE AQUÍ!
            apiKey: "TU_NUEVA_CLAVE_GOOGLE_AQUI", 
            modelo: "gemini-1.5-flash"
        },
        {
            // PROVEEDOR 2: Gemini 1.5 Pro (Respaldo Inteligente)
            // Menos cuota (~50/día), pero útil si el Flash falla momentáneamente.
            nombre: "Gemini 1.5 Pro (Respaldo)",
            tipo: "google",
            apiKey: "TU_NUEVA_CLAVE_GOOGLE_AQUI", 
            modelo: "gemini-1.5-pro"
        },
        {
            // PROVEEDOR 3: Gemini 1.0 Pro (Respaldo Compatibilidad)
            // El modelo clásico, muy estable.
            nombre: "Gemini 1.0 Pro (Estable)",
            tipo: "google",
            apiKey: "TU_NUEVA_CLAVE_GOOGLE_AQUI", 
            modelo: "gemini-1.0-pro"
        }
    ]
};
