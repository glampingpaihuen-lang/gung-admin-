/**
 * Arreglo de los archivos en el navegador, antes de subirlos:
 * - Fotos y videos de la galería: se sube el ARCHIVO ORIGINAL, sin achicarlo, para que al descargarlo
 *   quede en HD. Aparte se hace una miniatura JPG de 900 px para que la cuadrícula cargue rápido.
 * - Logos y fondo: más pequeños, conservando la transparencia cuando el navegador puede.
 */
export const LADO_MINI = 900;
export const MAX_MB = 50; // Supabase gratis no deja subir archivos más pesados

type Hecha = { blob: Blob; ancho: number; alto: number };

async function decodificar(f: Blob): Promise<ImageBitmap> {
  return createImageBitmap(f, { imageOrientation: "from-image" });
}

function dibujar(bmp: ImageBitmap, maxLado: number, relleno: string | null) {
  const s = Math.min(1, maxLado / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(bmp.width * s));
  c.height = Math.max(1, Math.round(bmp.height * s));
  const ctx = c.getContext("2d")!;
  if (relleno) { ctx.fillStyle = relleno; ctx.fillRect(0, 0, c.width, c.height); }
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  return c;
}

const aBlob = (c: HTMLCanvasElement, tipo: string, calidad: number) =>
  new Promise<Blob>((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error("No se pudo preparar la imagen."))), tipo, calidad));

const sinExt = (n: string) => n.replace(/\.[a-z0-9]{2,5}$/i, "");
export type Ext = "jpg" | "png" | "webp" | "mp4" | "mov" | "webm";
export type ArchivoListo = { grande: File; mini: File | null; ancho: number; alto: number; ext: Ext; tipo: "foto" | "video" };

const EXT_FOTO: Record<string, Ext> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const EXT_VIDEO: Record<string, Ext> = { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm" };

const pesoMb = (f: File) => (f.size / 1048576).toFixed(0);

/** Foto o video de la galería: original + miniatura */
export async function prepararArchivo(f: File): Promise<ArchivoListo> {
  const nombre = f.name.toLowerCase();
  const esVideo = f.type.startsWith("video/") || /\.(mp4|mov|webm|m4v)$/.test(nombre);
  if (f.size > MAX_MB * 1048576) {
    throw new Error(`pesa ${pesoMb(f)} MB y el máximo es ${MAX_MB} MB.${esVideo ? " Recórtalo o grábalo en menor resolución." : ""}`);
  }
  return esVideo ? prepararVideo(f) : prepararFoto(f);
}

async function prepararFoto(f: File): Promise<ArchivoListo> {
  let ext = EXT_FOTO[f.type];
  let bmp: ImageBitmap | null = null;
  try { bmp = await decodificar(f); } catch { /* el navegador no la sabe abrir */ }
  if (!bmp) {
    if (!ext) throw new Error(/heic|heif/i.test(f.type + f.name)
      ? "está en formato HEIC. En el iPhone ve a Ajustes › Cámara › Formatos y elige «Más compatible», o compártela como JPG."
      : "no es una foto JPG, PNG o WebP.");
    return { grande: f, mini: null, ancho: 0, alto: 0, ext, tipo: "foto" };
  }
  try {
    let grande: File = f;
    if (!ext) {
      // HEIC u otro formato que el navegador abre pero las demás pantallas no: se pasa a JPG con toda su resolución
      const c = dibujar(bmp, Math.max(bmp.width, bmp.height), "#ffffff");
      grande = new File([await aBlob(c, "image/jpeg", 0.95)], sinExt(f.name) + ".jpg", { type: "image/jpeg" });
      ext = "jpg";
    }
    const mini = dibujar(bmp, LADO_MINI, "#ffffff");
    const mBlob = await aBlob(mini, "image/jpeg", 0.8);
    return { grande, mini: new File([mBlob], sinExt(f.name) + ".jpg", { type: "image/jpeg" }), ancho: bmp.width, alto: bmp.height, ext, tipo: "foto" };
  } finally {
    bmp.close();
  }
}

/** Video: se sube tal cual; la miniatura es un cuadro del principio (si el navegador lo puede leer) */
async function prepararVideo(f: File): Promise<ArchivoListo> {
  const nombre = f.name.toLowerCase();
  const ext = EXT_VIDEO[f.type] ?? (nombre.endsWith(".mov") ? "mov" : nombre.endsWith(".webm") ? "webm" : nombre.endsWith(".mp4") || nombre.endsWith(".m4v") ? "mp4" : undefined);
  if (!ext) throw new Error("no es un video MP4, MOV o WebM.");
  const tipo = f.type || (ext === "mov" ? "video/quicktime" : `video/${ext}`);
  const grande = f.type ? f : new File([f], f.name, { type: tipo });
  const url = URL.createObjectURL(f);
  try {
    const v = document.createElement("video");
    v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = url;
    await new Promise<void>((res, rej) => {
      v.onloadeddata = () => res(); v.onerror = () => rej(new Error("x"));
      setTimeout(() => rej(new Error("x")), 15000);
    });
    const ancho = v.videoWidth, alto = v.videoHeight;
    v.currentTime = Math.min(0.5, (v.duration || 1) / 2);
    await new Promise<void>(res => { v.onseeked = () => res(); setTimeout(res, 4000); });
    if (!ancho || !alto) return { grande, mini: null, ancho: 0, alto: 0, ext, tipo: "video" };
    const s = Math.min(1, LADO_MINI / Math.max(ancho, alto));
    const c = document.createElement("canvas");
    c.width = Math.round(ancho * s); c.height = Math.round(alto * s);
    c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
    const mBlob = await aBlob(c, "image/jpeg", 0.8);
    return { grande, mini: new File([mBlob], sinExt(f.name) + ".jpg", { type: "image/jpeg" }), ancho, alto, ext, tipo: "video" };
  } catch {
    // Algunos videos (por ejemplo HEVC del iPhone en Windows) no se pueden leer aquí: se suben sin portada
    return { grande, mini: null, ancho: 0, alto: 0, ext, tipo: "video" };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Logo de una empresa o imagen de fondo. `relleno`: color de fondo si toca pasarla a JPG. */
export async function prepararImagen(f: File, maxLado: number, relleno: string, maxBytes = 3.5 * 1024 * 1024): Promise<File> {
  let bmp: ImageBitmap;
  try {
    bmp = await decodificar(f);
  } catch {
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) throw new Error("La imagen debe ser JPG, PNG o WebP.");
    if (f.size > maxBytes) throw new Error("La imagen pesa demasiado. Prueba con una más liviana.");
    return f;
  }
  try {
    let hecha: Hecha;
    const c = dibujar(bmp, maxLado, null);
    // WebP conserva la transparencia y pesa poco; Safari lo devuelve en PNG
    hecha = { blob: await aBlob(c, "image/webp", 0.9), ancho: c.width, alto: c.height };
    if (hecha.blob.size > maxBytes) {
      const j = dibujar(bmp, maxLado, relleno);
      hecha = { blob: await aBlob(j, "image/jpeg", 0.88), ancho: j.width, alto: j.height };
    }
    const ext = hecha.blob.type === "image/png" ? "png" : hecha.blob.type === "image/jpeg" ? "jpg" : "webp";
    return new File([hecha.blob], `${sinExt(f.name)}.${ext}`, { type: hecha.blob.type });
  } finally {
    bmp.close();
  }
}

/** Sube un archivo con un permiso firmado de Supabase, avisando el avance (0 a 1) */
export function subirPut(url: string, archivo: File, alAvanzar: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", archivo.type);
    xhr.setRequestHeader("cache-control", "max-age=31536000");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = e => { if (e.lengthComputable) alAvanzar(e.loaded / e.total); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`el servidor de fotos respondió ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("se cortó la conexión"));
    xhr.send(archivo);
  });
}

/** Solo pruebas en el PC: manda la foto al servidor local */
export function subirLocal(path: string, grande: File, mini: File | null, alAvanzar: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const fd = new FormData();
    fd.set("path", path);
    fd.set("archivo", grande);
    if (mini) fd.set("mini", mini);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/subir");
    xhr.upload.onprogress = e => { if (e.lengthComputable) alAvanzar(e.loaded / e.total); };
    xhr.onload = () => {
      let r: { ok?: boolean; msg?: string } = {};
      try { r = JSON.parse(xhr.responseText); } catch { /* respuesta rara */ }
      if (xhr.status >= 200 && xhr.status < 300 && r.ok) resolve();
      else reject(new Error(r.msg || `el servidor respondió ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("se cortó la conexión"));
    xhr.send(fd);
  });
}
