import os
import requests
import pandas as pd
import re
import time
from pathlib import Path
from bs4 import BeautifulSoup
from PIL import Image
from io import BytesIO
import fitz  # PyMuPDF
from urllib.parse import urljoin

# --- CONFIGURACIÓN DE RUTAS ---
BASE_DIR = Path(__file__).resolve().parent.parent
CSV_PATH = BASE_DIR / "data" / "Datos - Portadas.csv"
IMG_DIR = BASE_DIR / "img" / "portadas"
IMG_DIR.mkdir(parents=True, exist_ok=True)

# --- CONFIGURACIÓN TÉCNICA ---
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
}

def peticion_segura(url):
    """Sistema de reintentos (3x) para estabilidad en red."""
    for intento in range(3):
        try:
            r = requests.get(url, headers=HEADERS, timeout=25)
            if r.status_code == 200:
                return r
        except Exception:
            time.sleep(1)
    return None

def obtener_mejor_img(soup, instruccion, base_url):
    """Cazador Jerárquico: Extrae la imagen con mayor resolución disponible."""
    # Rama A: Metadatos (og:image)
    if "og:image" in instruccion.lower():
        meta = soup.find("meta", property=re.compile(r"og:image", re.I)) or \
               soup.find("meta", attrs={"name": "og:image"})
        if meta and meta.get("content"):
            return urljoin(base_url, meta["content"])

    # Rama B: Especial para Prensa Chalaca (Enlace a Issuu)
    img_tag = None
    if "issuu.com" in instruccion.lower():
        link = soup.find("a", href=re.compile(r"issuu\.com", re.I))
        if link: img_tag = link.find("img")

    # Rama C: Búsqueda por selectores del CSV
    if not img_tag:
        if 'alt="' in instruccion.lower():
            match = re.search(r'alt="([^"]*)"', instruccion, re.I)
            if match: img_tag = soup.find("img", alt=re.compile(re.escape(match.group(1)), re.I))
        elif 'class="' in instruccion.lower():
            match = re.search(r'class="([^"]*)"', instruccion, re.I)
            # FIX APLICADO: Restaurado el match.group(1) para búsqueda por clase
            if match: img_tag = soup.find("img", class_=re.compile(re.escape(match.group(1)), re.I))

    if img_tag:
        # Jerarquía Maestra de Atributos
        for attr in ['srcset', 'data-srcset']:
            val = img_tag.get(attr)
            if val:
                try:
                    parts = [p.strip().split() for p in val.split(',')]
                    urls = [(int(p[1][:-1]), p[0]) for p in parts if len(p) == 2 and 'w' in p[1]]
                    if urls: return urljoin(base_url, sorted(urls, reverse=True)[0][1])
                except: continue
        
        for attr in ['data-src-large', 'data-src', 'data-hires', 'data-image', 'data-lazy-src', 'data-original', 'src']:
            val = img_tag.get(attr)
            if val and not val.startswith('data:'):
                return urljoin(base_url, val)
    return None

def procesar_diario(row):
    nombre, url = row['Diario'], row['URL']
    instr = str(row['Instrucción'])
    filename = f"{nombre.lower().replace(' ', '_')}.jpg"
    local_path = IMG_DIR / filename
    
    try:
        # 1. DESCARGA / SCRAPING
        if "descargar directo" in instr.lower():
            res = peticion_segura(url)
            if not res: return None
            img_data = res.content
        else:
            res_html = peticion_segura(url)
            if not res_html: return None
            
            if "epdoc2" in instr.lower():
                soup = BeautifulSoup(res_html.text, 'html.parser')
                link = soup.find("a", href=re.compile(r"epdoc2", re.I))
                if not link: return None
                pdf_res = peticion_segura(urljoin(url, link['href']))
                if not pdf_res: return None
                with fitz.open(stream=pdf_res.content, filetype="pdf") as doc:
                    zoom = 150 / 72
                    pix = doc.load_page(0).get_pixmap(matrix=fitz.Matrix(zoom, zoom))
                    img_data = pix.tobytes("jpg")
            else:
                soup = BeautifulSoup(res_html.text, 'html.parser')
                img_url = obtener_mejor_img(soup, instr, url)
                if not img_url: return None
                img_res = peticion_segura(img_url)
                if not img_res: return None
                img_data = img_res.content

        # 2. VALIDACIÓN (Filtro 1KB con alerta para el log)
        if len(img_data) < 1024:
            print(f" [!] ALERTA: {nombre} < 1KB (posible placeholder o error). Saltando...")
            return None
            
        # 3. OPTIMIZACIÓN (1200px ancho)
        img = Image.open(BytesIO(img_data))
        if img.mode != 'RGB': img = img.convert('RGB')
        
        if img.width != 1200:
            new_h = int(img.height * 1200 / img.width)
            img = img.resize((1200, new_h), Image.Resampling.LANCZOS)
        
        img.save(local_path, "JPEG", quality=85, optimize=True, progressive=True)
        return f"img/portadas/{filename}"
        
    except Exception as e:
        print(f" [!] Error en {nombre}: {e}")
        return None

def main():
    if not CSV_PATH.exists(): return
    df = pd.read_csv(CSV_PATH)
    exitos = 0
    
    for i, row in df.iterrows():
        print(f" -> Procesando: {row['Diario']}...")
        nueva_ruta = procesar_diario(row)
        if nueva_ruta:
            df.at[i, 'Imagen'] = nueva_ruta
            exitos += 1

    if exitos > 0:
        df.to_csv(CSV_PATH, index=False)
        print(f"\n ÉXITO: {exitos} diarios actualizados.")
    else:
        print("\n [!] Sincronización fallida. CSV protegido.")

if __name__ == "__main__":
    main()
