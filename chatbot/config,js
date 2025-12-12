window.CHAT_CONFIG = {
    // 1. Diseño Visual
    titulo: "Asistente Dra. Ana",
    colorPrincipal: "#2563eb", // Azul (Cámbialo por el color del cliente)
    saludoInicial: "¡Hola! Soy Ana. ¿En qué puedo ayudarte? 🦷",
    placeholder: "Pregunta precios o horarios...",

    // 2. LISTA DE CEREBROS (Failover Automático)
    // El sistema intentará con el primero. Si falla (error o cuota), salta al segundo.
    proveedores: [
        {
            nombre: "Gemini (Gratis)",
            tipo: "google",
            // Pega aquí tu llave de Google (Restringida en Cloud Console)
            apiKey: "AIzaSy_TU_CLAVE_DE_GOOGLE", 
            modelo: "gemini-2.5-flash"
        },
        {
            nombre: "DeepSeek (Respaldo)",
            tipo: "openai-compatible",
            url: "https://api.deepseek.com/chat/completions",
            // Pega aquí tu llave de DeepSeek (Muy barata)
            apiKey: "sk-TU_CLAVE_DE_DEEPSEEK", 
            modelo: "deepseek-chat"
        }
        // Puedes agregar un tercero (ChatGPT) si quieres
    ]
};
