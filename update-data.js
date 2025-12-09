const fs = require('fs');

// PON AQUÍ TU ENLACE DE PUBLICAR EN LA WEB (CSV)
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR67aoFMPN7IdCJuST7JW3lweWiT_aUucVi8qO1IztTDNLCxThrGbzu4NoQ8LZoDknfzq_l8opyzcEr/pub?gid=0&single=true&output=csv';

async function main() {
    try {
        console.log("⏳ Descargando datos de Google Sheets...");
        const response = await fetch(SHEET_URL);
        const csvText = await response.text();

        console.log("⚙️ Convirtiendo CSV a JSON...");
        const data = csvToJson(csvText);

        console.log(`✅ ${data.length} productos procesados.`);
        
        // Guardamos el archivo JSON estático
        fs.writeFileSync('productos.json', JSON.stringify(data, null, 2));
        console.log("💾 Archivo productos.json guardado con éxito.");

    } catch (error) {
        console.error("❌ Error:", error);
        process.exit(1);
    }
}

// Función auxiliar para convertir CSV a JSON nativo
function csvToJson(csv) {
    const lines = csv.split('\n').filter(line => line.trim() !== '');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, '')); // Limpia comillas
    
    return lines.slice(1).map(line => {
        // Esta regex maneja comas dentro de comillas (ej: "Producto, Rojo")
        const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
        
        let obj = {};
        headers.forEach((header, i) => {
            // Limpiamos comillas extra de los valores y asignamos
            let val = values[i] ? values[i].replace(/^"|"$/g, '').trim() : '';
            
            // Convertir precio a número si corresponde
            if (header === 'precio') val = parseFloat(val) || 0;
            
            obj[header] = val;
        });
        return obj;
    });
}

main();
