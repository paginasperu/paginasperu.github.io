import os
import requests
import pandas as pd
import datetime
import pytz
import re
from pathlib import Path
from bs4 import BeautifulSoup
from PIL import Image
from io import BytesIO
import fitz  # PyMuPDF
from urllib.parse import urljoin

# --- CONFIGURACIÓN DE RUTAS ABSOLUTAS (Elegancia Pathlib) ---
BASE_DIR = Path(__file__).resolve().parent.parent
CSV_PATH = BASE_DIR / "data" / "portadas.csv"
IMG_DIR = BASE_DIR / "img" / "portadas"

# Asegurar que la estructura de carpetas existe
IMG_DIR.mkdir(parents=True, exist_ok=True)

# --- CONFIGURACIÓN TÉCNICA ---
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
}

def obtener_mejor_img(soup, instruccion, base_url):
    """
    Cazador Jerárquico: Busca la mejor resolución disponible.
    """
    # Rama A: Búsqueda por Metadatos (og:image)
    if "og:image" in instruccion.lower():
        meta = soup.find("meta", property=re.compile(r"og:image", re.I)) or \
               soup.find("meta", attrs={"name": "og:image"})
        if meta and meta.get("content"):
            return urljoin(base_url, meta["content"].split('?')[0])

    # Rama B: Búsqueda en etiquetas <img>
    img_tag = None
    if 'alt="' in instruccion.lower():
        alt_match = re.search(r'alt="([^"]*)"', instruccion, re.I)
        alt_val = alt_match.group(1) if alt_match else ""
        img_tag = soup.find("img", alt=re.compile(re.escape(alt_val), re.I))
    elif 'class="' in instruccion.lower():
        class_match = re.search(r'class="([^"]*)"', instruccion, re.I)
        class_val = class_match.group(1) if class_match else ""
        img_tag = soup.find("img", class_=re.compile(re.escape(class_val), re.I))

    if img_tag:
        # Jerarquía Estricta: srcset -> data-srcset -> data-src -> data-lazy-src -> data-original -> src
        for attr in ['srcset', 'data-srcset']:
            val = img_tag.get(attr)
            if val:
                try:
                    parts = [p.strip().split() for p in val.split(',')]
                    # Filtramos las que tienen indicador de ancho 'w'
                    urls = [(int(p[1][:-1]), p[0]) for p in parts if len(p) == 2 and 'w' in p[1]]
                    if urls:
                        return urljoin(base_url, sorted(urls, reverse=True)[0][1])
                except Exception:
                    continue
        
        # Atributos de Lazy Loading comunes
        for attr in ['data-src', 'data-lazy-src', 'data-original', 'src']:
            if img_tag.get(attr):
                return urljoin(base_url, img_tag.get(attr))
            
    return None

def procesar_diario(row):
    nombre = row['Diario']
    url = row['URL']
    instr = str(row['Instrucción']).lower()
    filename = f"{nombre.lower().replace(' ', '_')}.jpg"
    local_path = IMG_DIR / filename
    
    try:
        # 1. IDENTIFICACIÓN DE TIPO DE DESCARGA
        if "descargar directo" in instr:
            res = requests.get(url, headers=HEADERS, timeout=20)
            img_data = res.content
        else:
            # Scraping de página HTML
            res_html = requests.get(url, headers=HEADERS, timeout=20)
            if res_html.status_code != 200: return None
            
            soup = BeautifulSoup(res_html.text, 'html.parser')
            
            # Caso Especial: El Peruano (Conversión PDF a JPG)
            if "epdoc2" in instr:
                link = soup.find("a", href=re.compile(r"epdoc2", re.I))
                if not link: return None
                pdf_url = urljoin(url, link['href'])
                pdf_res = requests.get(pdf_url, headers=HEADERS, timeout=25)
                doc = fitz.open(stream=pdf_res.content, filetype="pdf")
                # Renderizado a 150 DPI (~1200px de ancho)
                pix = doc.load_page(0).get_pixmap(matrix=fitz.Matrix(2, 2))
                img_data = pix.tobytes("jpg")
            else:
                # Caso General de Scraping
                img_url = obtener_mejor_img(soup, instr, url)
                if not img_url: return None
                img_res = requests.get(img_url, headers=HEADERS, timeout=20)
                img_data = img_res.content

        # 2. VALIDACIÓN Y OPTIMIZACIÓN (Pillow)
        if not img_data or len(img_data) == 0:
            return None
            
        img = Image.open(BytesIO(img_data))
        
        # Convertir a RGB (evita errores con CMYK o transparencias)
        if img.mode != 'RGB':
            img = img.convert('RGB')
            
        # Redimensión inteligente (Max 1200px ancho)
        img.thumbnail((1200, 1800), Image.Resampling.LANCZOS)
        
        # Guardado optimizado (Sobrescribe el archivo anterior)
        img.save(local_path, "JPEG", quality=85, optimize=True, progressive=True)
        
        # Retorna ruta relativa para el CSV
        return f"img/portadas/{filename}"
        
    except Exception as e:
        print(f"[ERROR] {nombre}: {e}")
        return None

def main():
    if not CSV_PATH.exists():
        print(f"[CRÍTICO] No se encontró el CSV en {CSV_PATH}")
        return

    # Cargar y procesar según el orden de 'Posición'
    df = pd.read_csv(CSV_PATH)
    if 'Posición' in df.columns:
        df = df.sort_values(by="Posición")

    for i, row in df.iterrows():
        print(f"[INFO] Procesando: {row['Diario']}")
        nueva_ruta = procesar_diario(row)
        if nueva_ruta:
            df.at[i, 'Imagen'] = nueva_ruta
            print(f"[OK] {row['Diario']} actualizado correctamente.")
        else:
            print(f"[FALLO] No se pudo obtener la portada de {row['Diario']}.")

    # Guardar cambios finales en el CSV
    df.to_csv(CSV_PATH, index=False)
    print("\n--- Sincronización Finalizada ---")

if __name__ == "__main__":
    main()
