import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { comoDescarga, r2Activo, r2Borrar, r2Existe, r2Firmar, r2Subir, r2Url } from "./r2";

/**
 * Dónde quedan las fotos.
 * - Con Supabase (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY): en la carpeta pública "nube" de Supabase Storage.
 * - Sin Supabase (solo pruebas en el PC): en la carpeta .datos/ que comparten nube-app y nube-admin
 *   (al lado de los dos proyectos) y se muestran por /api/archivo/...
 */
export const BUCKET = "nube";
export const DATOS_DIR = process.env.NUBE_DATOS?.trim() || path.join(process.cwd(), "..", ".datos");
export const LOCAL_DIR = path.join(DATOS_DIR, "archivos");

export const TIPOS: Record<string, "jpg" | "png" | "webp"> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const TIPOS_VIDEO: Record<string, "mp4" | "mov" | "webm"> = { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm" };
export const MIME: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
  mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm",
};
export const EXT_FOTO = ["jpg", "jpeg", "png", "webp"];
export const EXT_VIDEO = ["mp4", "mov", "webm"];
/** Supabase gratis no deja subir archivos de más de 50 MB */
export const MAX_ARCHIVO_MB = 50;

let cliente: SupabaseClient | null | undefined;
export function supa(): SupabaseClient | null {
  if (cliente !== undefined) return cliente;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(), key = process.env.SUPABASE_SECRET_KEY?.trim();
  cliente = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  return cliente;
}

/** En Vercel no hay disco donde guardar: sin Supabase no se puede subir nada */
export function exigirAlmacen() {
  if (!supa() && process.env.VERCEL) throw new Error("Falta configurar Supabase (NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY) en Vercel.");
}

const codificar = (p: string) => p.split("/").map(encodeURIComponent).join("/");

/** Los archivos que empiezan por "r2/" están en Cloudflare R2; los demás en Supabase (o en el PC) */
export const enR2 = (p: string) => p.startsWith("r2/");

/** Dirección pública de un archivo. Con `descarga`, el navegador lo descarga con ese nombre. */
export function urlPublica(p: string, descarga?: string): string {
  if (enR2(p)) return r2Url(p); // en R2 el original ya se guarda «para descargar» con su nombre
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, "");
  if (supa() && base) {
    const u = `${base}/storage/v1/object/public/${BUCKET}/${codificar(p)}`;
    return descarga ? `${u}?download=${encodeURIComponent(descarga)}` : u;
  }
  const u = `/api/archivo/${codificar(p)}`;
  return descarga ? `${u}?descargar=${encodeURIComponent(descarga)}` : u;
}

/** Nombre para un archivo nuevo: en R2 si está configurado */
export const nombreNuevo = (carpeta: string, ext: string) =>
  `${r2Activo() ? "r2/" : ""}${carpeta}/${Date.now()}-${randomBytes(4).toString("hex")}.${ext}`;

/** Límite por archivo: 50 MB en Supabase gratis; en R2 hasta 2 GB por subida directa */
export const maxArchivoMb = () => (r2Activo() ? 2048 : MAX_ARCHIVO_MB);

/**
 * Fotos y videos de la galería: el archivo original (en HD) en [r2/]empresas/<id>/fotos/<archivo>
 * y su miniatura JPG (para la cuadrícula) en [r2/]empresas/<id>/mini/<mismo nombre>.jpg
 */
export const RE_FOTO = /^(?:r2\/)?empresas\/([0-9a-f-]{36})\/fotos\/(\d+-[a-f0-9]{8}\.(jpg|jpeg|png|webp|mp4|mov|webm))$/;
export const miniDe = (p: string) => p.replace("/fotos/", "/mini/").replace(/\.[a-z0-9]+$/, ".jpg");
export const esVideo = (p: string) => /\.(mp4|mov|webm)$/i.test(p);

export async function guardarArchivo(p: string, bytes: Buffer, tipo: string) {
  if (enR2(p)) { await r2Subir(p, bytes, tipo); return; }
  exigirAlmacen();
  const sb = supa();
  if (sb) {
    const { error } = await sb.storage.from(BUCKET).upload(p, bytes, { contentType: tipo, cacheControl: "31536000", upsert: false });
    if (error) throw new Error("No se pudo guardar el archivo: " + error.message);
    return;
  }
  const f = path.join(LOCAL_DIR, p);
  await mkdir(path.dirname(f), { recursive: true });
  await writeFile(f, bytes);
}

export async function existeArchivo(p: string): Promise<boolean> {
  if (enR2(p)) return r2Existe(p);
  const sb = supa();
  if (sb) {
    const { data } = await sb.storage.from(BUCKET).exists(p);
    return !!data;
  }
  try { return (await stat(path.join(LOCAL_DIR, p))).isFile(); } catch { return false; }
}

export async function borrarArchivos(paths: (string | null | undefined)[]) {
  const todos = [...new Set(paths.filter((p): p is string => !!p))];
  const deR2 = todos.filter(enR2), lista = todos.filter(p => !enR2(p));
  if (deR2.length) await r2Borrar(deR2).catch(() => {});
  if (!lista.length) return;
  const sb = supa();
  if (sb) {
    for (let i = 0; i < lista.length; i += 500) await sb.storage.from(BUCKET).remove(lista.slice(i, i + 500));
    return;
  }
  await Promise.all(lista.map(p => unlink(path.join(LOCAL_DIR, p)).catch(() => {})));
}

export type Permiso = { url: string; headers: Record<string, string> } | null;

/**
 * Permiso para que el navegador suba el archivo directo a R2 o a Supabase (sin pasar por el
 * servidor, porque Vercel no deja más de 4,5 MB por envío). Sin ninguno de los dos devuelve null
 * y el archivo se manda a /api/subir (solo en el PC).
 * `descarga`: nombre con el que se descarga (solo los originales en R2).
 */
export async function permisoSubida(p: string, tipo: string, descarga?: string): Promise<Permiso> {
  if (enR2(p)) return r2Firmar(p, tipo, descarga ? comoDescarga(descarga) : undefined);
  exigirAlmacen();
  const sb = supa();
  if (!sb) return null;
  const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(p);
  if (error || !data) throw new Error("No se pudo preparar la subida: " + (error?.message ?? ""));
  return { url: data.signedUrl, headers: { "content-type": tipo, "cache-control": "max-age=31536000", "x-upsert": "false" } };
}
