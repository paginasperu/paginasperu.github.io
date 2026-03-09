"""
PORTADAS.PY - Motor de Automatización OFICIAL.PE
-----------------------------------------------
PROYECTO: Validador de Portadas de Diarios Peruanos
FILOSOFÍA: KISS (Keep It Simple, Stupid) y Zero-Dependencies en Frontend.

ÍNDICE DE LÓGICA Y PASOS:
1. CONFIGURACIÓN DE ENTORNO:
   - Define rutas usando Pathlib para compatibilidad Linux/Windows.
   - Establece conexión con el CSV de Google Sheets (Base de Datos).

2. GESTIÓN DE TIEMPO (LIMA):
   - Usa ZoneInfo para garantizar que 'hoy' sea siempre la fecha de Perú,
     sin importar si el servidor de GitHub está en otro continente.

3. TRADUCTOR DE URLs:
   - Reemplaza marcadores dinámicos {YYYY, MM, DD, YY} en las plantillas
     de los diarios para generar el enlace final del día actual.

4. SANITIZACIÓN DE ARCHIVOS:
   - Normaliza nombres (quita tildes y espacios) para generar archivos 
     estables (ej. 'la-republica.jpg'). Usa nombres fijos para evitar 
     llenar el repositorio de basura histórica.

5. MOTOR DE PROCESAMIENTO (PILLOW):
   - Descarga mediante requests.Session para eficiencia de red.
   - Valida Content-Type (evita procesar HTML como si fuera imagen).
   - Optimiza: Convierte a RGB, redimensiona a 1200px y aplica JPEG progresivo.

6. SALIDA DE DATOS (DATA/PORTADAS.CSV):
   - Genera un manifiesto final con los diarios procesados exitosamente,
     manteniendo el orden de 'Posición' para el consumo del Frontend.
"""

import pandas as pd
import requests
import unicodedata
import re
import sys
from datetime import datetime
from zoneinfo import ZoneInfo
from pathlib import Path
from PIL import Image
from io import BytesIO

# ==========================================
# 1. CONFIGURACIÓN DE RUTAS
# ==========================================
BASE_DIR = Path(__file__).resolve().parent.parent
# URL pública del CSV de Google Sheets
SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ9Z2C4BVz2pf5BzTj1pAtYBJydtyDgOd7itl9pF12cflFUXR26VaYxAPHARMjupx6t1g3brjMZZPhz/pub?gid=1526309505&single=true&output=csv"

IMAGES_DIR = BASE_DIR / "images" / "portadas"
DATA_FILE = BASE_DIR / "data" / "portadas.csv"

# Asegurar que las carpetas existan antes de procesar
IMAGES_DIR.mkdir(parents=True, exist_ok=True)
DATA_FILE.parent.mkdir(parents=True, exist_ok=True)

# ==========================================
# 2. FUNCIONES HELPERS
# ==========================================

def obtener_fecha_lima():
    """Retorna el objeto datetime configurado para la zona horaria de Perú."""
    return datetime.now(ZoneInfo("America/Lima"))

def formatear_url(url_plantilla):
    """Sustituye marcadores de fecha en la URL original del diario."""
    f = obtener_fecha_lima()
    reemplazos = {
        "{YYYY}": f.strftime("%Y"),
        "{MM}": f.strftime("%m"),
        "{DD}": f.strftime("%d"),
        "{YY}": f.strftime("%y")
    }
    for marcador, valor in reemplazos.items():
        url_plantilla = url_plantilla.replace(marcador, valor)
    return url_plantilla

def sanitizar_nombre(diario):
    """Convierte nombres con tildes/espacios en nombres de archivo seguros."""
    if pd.isna(diario): return "desconocido"
    texto = str(diario).lower().strip()
    # Eliminar acentos
    texto = unicodedata.normalize('NFKD', texto).encode('ascii', 'ignore').decode('ascii')
    # Solo caracteres alfanuméricos
    return re.sub(r'[^a-z0-9]', '', texto)

def optimizar_imagen(contenido, ruta_destino):
    """Aplica el tratamiento de imagen para que la web vuele (Pillow)."""
    try:
        img = Image.open(BytesIO(contenido))
        # Forzar RGB (evita problemas con perfiles CMYK de impresión)
        if img.mode != 'RGB': 
            img = img.convert('RGB')
        
        # Redimensión proporcional a 1200px de ancho
        img.thumbnail((1200, 1600), Image.Resampling.LANCZOS)
        
        # Guardado Progresivo: La imagen carga de borrosa a nítida (mejor UX)
        img.save(ruta_destino, "JPEG", quality=85, optimize=True, progressive=True)
        return True
    except Exception as e:
        print(f"      [!] Error en procesamiento de imagen: {e}")
        return False

# ==========================================
# 3. EJECUCIÓN PRINCIPAL
# ==========================================

def ejecutar():
    session = requests.Session()
    session.headers.update({'User-Agent': 'Mozilla/5.0'})
    
    try:
        print(f"--- INICIO MOTOR OFICIAL.PE | {obtener_fecha_lima().strftime('%H:%M')} ---")
        
        # Carga de Base de Datos
        df = pd.read_csv(SHEET_URL)
        
        # Validación Paranoica de Columnas
        columnas_requeridas = ['Diario', 'URL', 'Posición']
        for col in columnas_requeridas:
            if col not in df.columns:
                print(f"ERROR CRÍTICO: No se encontró la columna '{col}'.")
                sys.exit(1)

        # Ordenar según la prioridad definida en el Sheets
        df = df.sort_values(by='Posición')
        registros_exitosos = []

        for _, row in df.iterrows():
            diario = row['Diario']
            posicion = row['Posición']
            url_real = formatear_url(row['URL'])
            nombre_file = f"{sanitizar_nombre(diario)}.jpg"
            ruta_img = IMAGES_DIR / nombre_file
            
            print(f"Procesando [{posicion}]: {diario}...")
            
            try:
                # Timeout: 5s para conectar, 25s para bajar la imagen
                res = session.get(url_real, timeout=(5, 25))
                
                if res.status_code == 200:
                    # Validar que sea una imagen y no un error HTML disfrazado
                    if 'image' not in res.headers.get('Content-Type', ''):
                        print("   [!] El servidor no respondió con una imagen.")
                        continue
                    
                    # Seguridad: Evitar archivos sospechosamente grandes
                    if len(res.content) > 10_000_000:
                        print("   [!] Imagen excede el límite de 10MB.")
                        continue

                    if optimizar_imagen(res.content, ruta_img):
                        registros_exitosos.append({
                            'Posición': posicion,
                            'Diario': str(diario).upper(),
                            'Imagen': f"images/portadas/{nombre_file}"
                        })
                        print(f"   [OK] Procesada con éxito.")
                else:
                    print(f"   [!] No disponible (HTTP {res.status_code})")
            
            except Exception as e:
                print(f"   [x] Error de conexión: {e}")

        # Generar el archivo final para el index.html
        if registros_exitosos:
            pd.DataFrame(registros_exitosos).to_csv(DATA_FILE, index=False)
            print(f"\n--- ÉXITO: {len(registros_exitosos)} portadas actualizadas ---")

    except Exception as e:
        print(f"ERROR CRÍTICO DEL SISTEMA: {e}")
    finally:
        session.close()
        print("--- SESIÓN CERRADA ---")

if __name__ == "__main__":
    ejecutar()
