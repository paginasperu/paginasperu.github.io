import os
import requests
import pandas as pd
import time
import re
from pathlib import Path
from bs4 import BeautifulSoup
from PIL import Image
from io import BytesIO
import fitz  # PyMuPDF
from urllib.parse import urljoin
from datetime import datetime

# --- CONFIGURACIÓN DE RUTAS Y NUBE ---
BASE_DIR = Path(__file__).resolve().parent.parent

# URL DE TU GOOGLE SHEETS
SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ9Z2C4BVz2pf5BzTj1pAtYBJydtyDgOd7itl9pF12cflFUXR26VaYxAPHARMjupx6t1g3brjMZZPhz/pub?gid=1526309505&single=true&output=csv"

CSV_LOCAL_PATH = BASE_DIR / "data" / "DATOS.csv"
CSV_TMP_PATH = BASE_DIR / "data" / "DATOS.tmp.csv"
IMG_DIR = BASE_DIR / "img" / "portadas"

# ASEGURAR DIRECTORIOS
CSV_LOCAL_PATH.parent.mkdir(parents=True, exist_ok=True)
IMG_DIR.mkdir(parents=True, exist_ok=True)

HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}

def formatear_url(url_template):
    """Reemplaza marcadores {YYYY}, {YY}, {MM}, {M}, {DD}, {D}"""
    hoy = datetime.now()
    datos = {
        "{YYYY}": hoy.strftime("%Y"), "{YY}": hoy.strftime("%y"),
        "{MM}": hoy.strftime("%m"), "{M}": str(hoy.month),
        "{DD}": hoy.strftime("%d"), "{D}": str(hoy.day)
    }
    url_final = url_template
    for marcador, valor in datos.items():
        url_final = url_final.replace(marcador, valor)
    return url_final

def peticion_segura(url, reintentos=3):
    for i in range(reintentos):
        try:
            r = requests.get(url, headers=HEADERS, timeout=25)
            if r.status_code == 200: return r
        except: time.sleep(3)
    return None

def extraer_de_pdf(pdf_url):
    res = peticion_segura(pdf_url)
    if not res: return None
    try:
        doc = fitz.open(stream=res.content, filetype="pdf")
        page = doc.load_page(0)
        zoom = 150 / 72
        pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom))
        img = Image.open(BytesIO(pix.tobytes()))
        return img
    except Exception as e:
        print(f"   [!] Error PDF: {e}")
        return None

def obtener_mejor_img(soup, instruccion, url_base):
    instruccion_raw = str(instruccion)
    instruccion_low = instruccion_raw.lower().strip()
    img_tag = None

    if "issuu" in instruccion_low:
        link_issuu = soup.find("a", href=re.compile(r"issuu\.com", re.I))
        if link_issuu: img_tag = link_issuu.find("img")

    if not img_tag and "src que contenga" in instruccion_low:
        match = re.search(r'src que contenga "([^"]*)"', instruccion_raw, re.I)
        if match:
            valor = match.group(1)
            img_tag = soup.find("img", src=re.compile(re.escape(valor), re.I))

    if not img_tag and "alt=" in instruccion_low:
        match = re.search(r'alt="([^"]*)"', instruccion_raw, re.I)
        val_alt = match.group(1) if match else ""
        if val_alt: img_tag = soup.find("img", alt=re.compile(re.escape(val_alt), re.I))

    if not img_tag and ("class=" in instruccion_low or "." in instruccion_low or "#" in instruccion_low):
        selector = instruccion_raw.replace("class=", "")
        try: img_tag = soup.select_one(selector)
        except: pass

    if img_tag:
        srcset = img_tag.get("srcset") or img_tag.get("data-srcset")
        if srcset:
            try:
                parts = [p.strip().split() for p in srcset.split(',')]
                urls = [(int(p[1][:-1]), p[0]) for p in parts if len(p) == 2 and 'w' in p[1].lower()]
                if urls: return urljoin(url_base, sorted(urls, reverse=True)[0][1])
            except: pass
        for attr in ['data-src-large', 'data-src', 'src']:
            src = img_tag.get(attr)
            if src and not src.startswith('data:image'): return urljoin(url_base, src)

    meta = soup.find("meta", property="og:image")
    if meta and meta.get("content"): return urljoin(url_base, meta["content"])
    return None

def guardar_imagen(img, nombre_diario):
    filename = f"{nombre_diario.lower().replace(' ', '_')}.jpg"
    filepath = IMG_DIR / filename
    if img.mode != 'RGB': img = img.convert('RGB')
    if img.width != 1200:
        new_h = int(img.height * 1200 / img.width)
        img = img.resize((1200, new_h), Image.Resampling.LANCZOS)
    img.save(filepath, "JPEG", quality=85, optimize=True, progressive=True)
    return f"img/portadas/{filename}"

def procesar_diario(row):
    diario = row.get('Diario')
    url = row.get('URL') or row.get('Url')
    instruccion = str(row.get('Instrucción') or row.get('Instruccion') or 'og:image')

    if not diario or not url:
        print(f" [!] {diario}: Faltan datos críticos.")
        return None

    print(f"\n-> Procesando: {diario}")

    # 1. FORMATEO DE FECHA
    if "Formatear fecha actual" in instruccion:
        url = formatear_url(url)
        print(f"   [URL generada]: {url}")

        if instruccion.strip() == "Formatear fecha actual":
            res = peticion_segura(url)
            if not res:
                print(f"   [!] Falló descarga directa")
                return None
            try:
                img = Image.open(BytesIO(res.content))
                print(f"   [OK] Descarga directa exitosa")
                return guardar_imagen(img, diario)
            except Exception as e:
                print(f"   [!] Error Pillow: {e}")
                return None

    # 2. PETICIÓN HTML
    res = peticion_segura(url)
    if not res:
        print(f"   [!] Falló petición HTML")
        return None

    soup = BeautifulSoup(res.text, 'html.parser')

    if "elperuano.pe" in url:
        pdf_link = soup.find("a", href=re.compile(r"epdoc2"))
        if not pdf_link:
            print(f"   [!] No encontró link epdoc2")
            return None
        pdf_url = urljoin(url, pdf_link['href'])
        print(f"   [PDF detectado]: {pdf_url}")
        img = extraer_de_pdf(pdf_url)
        if img:
            print(f"   [OK] Imagen de PDF guardada")
            return guardar_imagen(img, diario)
        return None

    img_url = obtener_mejor_img(soup, instruccion, url)
    if not img_url:
        print(f"   [!] No encontró imagen en HTML")
        return None

    print(f"   [Imagen detectada]: {img_url}")
    img_res = peticion_segura(img_url)
    if not img_res:
        print(f"   [!] Falló descarga de imagen")
        return None

    try:
        img = Image.open(BytesIO(img_res.content))
        print(f"   [OK] Scraping exitoso")
        return guardar_imagen(img, diario)
    except Exception as e:
        print(f"   [!] Error Pillow: {e}")
        return None

def main():
    print(f"--- MOTOR OFICIAL.PE V7.5: LOGS DETALLADOS ---")
    df = None
    for attempt in range(3):
        try:
            df = pd.read_csv(SHEET_CSV_URL)
            break
        except Exception as e:
            print(f" [!] Intento {attempt+1} fallido: {e}")
            time.sleep(5)

    if df is None: return

    actualizados = 0
    if 'Imagen' not in df.columns: df['Imagen'] = ""

    for i, row in df.iterrows():
        ruta_local = procesar_diario(row)
        if ruta_local:
            df.at[i, 'Imagen'] = ruta_local
            actualizados += 1

    if actualizados > 0:
        try:
            df.to_csv(CSV_TMP_PATH, index=False)
            if os.path.exists(CSV_LOCAL_PATH): os.remove(CSV_LOCAL_PATH)
            os.rename(CSV_TMP_PATH, CSV_LOCAL_PATH)
            print(f"\n--- FINALIZADO: {actualizados} portadas listas ---")
        except Exception as e:
            print(f" [!] Error al guardar el CSV: {e}")
    else:
        print("\n [!] Sin cambios detectados. Revisa los logs.")

if __name__ == "__main__":
    main()
