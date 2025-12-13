window.CHAT_CONFIG = {
    // === FUENTE DE DATOS EXTERNA ÚNICA ===
    // INSTRUCCIÓN CRÍTICA: Reemplaza esta URL por la ÚNICA URL de tu hoja de cálculo publicada.
    data_source_url: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQUfzxFN8E2Wr4oRtEd7ivk-yn8dxMB4e8Bs30WTXwd6Ihn7CclMwhru8LczHDmswNoEXHNmtjgc1_O/pub?gid=0&single=true&output=csv", 

    // === IDENTIDAD ===
    titulo: "Frankos Chicken & Grill 🍗",
    colorPrincipal: "#ea580c", 
    saludoInicial: "¡Hola! Bienvenido a Frankos Chicken. Soy Fedeliza. ¿Qué se te antoja hoy? 🍗",
    placeholder: "Escribe 'carta', 'precio' o selecciona una opción...",
    whatsapp: "51949973277", // CAMBIAR POR TU NÚMERO REAL

    // === SUGERENCIAS RÁPIDAS (Botones que activan las reglas) ===
    sugerencias_rapidas: [
        { texto: "Ver Carta", accion: "carta" },
        { texto: "Precios de Pollo", accion: "precio" },
        { texto: "Delivery", accion: "delivery" },
        { texto: "Horario", accion: "horario" }
    ],
    
    // NOTA: La sección 'personalidad' se cargará aquí dinámicamente desde la URL.
};
