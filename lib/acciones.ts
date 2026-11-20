"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { anotarFallo, bloqueado, codigoCorrecto, codigoPanel, COOKIE, crearSesion, exigirPanel, hayPanel, ipCliente } from "./auth";
import { borrarArchivos, esVideo, EXT_FOTO, EXT_VIDEO, existeArchivo, guardarArchivo, MIME, miniDe, nombreNuevo, permisoSubida, RE_FOTO, TIPOS, type Permiso } from "./archivos";
import {
  actualizarEmpresa, agregarFoto, borrarEmpresa, borrarFotos, crearEmpresa, empresaPorId, guardarAjustes,
  leerAjustes, moverEmpresa, moverFoto, siguienteOrden,
} from "./store";
import type { FondoModo, Resultado } from "./tipos";

const MB = 1024 * 1024;
const fallo = (x: unknown): { ok: false; msg: string } => ({ ok: false, msg: x instanceof Error ? x.message : "Algo salió mal. Inténtalo otra vez." });
const refrescar = () => revalidatePath("/", "layout");
const texto = (v: FormDataEntryValue | null, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/* ------------------------------ Entrada ------------------------------ */

export async function entrar(_: { msg: string } | null, fd: FormData): Promise<{ msg: string } | null> {
  const ip = await ipCliente();
  if (!codigoPanel()) return { msg: "El panel todavía no tiene código. Agrega la variable CODIGO_PANEL en Vercel." };
  if (bloqueado(ip)) return { msg: "Demasiados intentos. Espera 15 minutos y vuelve a intentarlo." };
  if (!codigoCorrecto(String(fd.get("codigo") ?? ""))) {
    anotarFallo(ip);
    await new Promise(r => setTimeout(r, 700));
    return { msg: "Ese código no es. Revísalo e inténtalo otra vez." };
  }
  const s = crearSesion();
  (await cookies()).set(COOKIE, s.valor, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: s.maxAge,
    secure: process.env.NODE_ENV === "production",
  });
  redirect("/");
}

export async function salir() {
  (await cookies()).delete(COOKIE);
  redirect("/entrar");
}

/* ------------------------- Logos y fondo ------------------------- */

async function subirImagen(v: FormDataEntryValue | null, carpeta: "logos" | "fondo", maxMb: number): Promise<string | null> {
  if (!(v instanceof File) || v.size === 0) return null;
  const ext = TIPOS[v.type];
  if (!ext) throw new Error("La imagen debe ser JPG, PNG o WebP.");
  if (v.size > maxMb * MB) throw new Error(`La imagen pesa más de ${maxMb} MB.`);
  const p = nombreNuevo(carpeta, ext);
  await guardarArchivo(p, Buffer.from(await v.arrayBuffer()), v.type);
  return p;
}

/* ----------------------------- Empresas ----------------------------- */

export async function crearEmpresaAccion(fd: FormData): Promise<Resultado<{ id: string }>> {
  let logo: string | null = null;
  try {
    await exigirPanel();
    const nombre = texto(fd.get("nombre"), 80);
    if (!nombre) return { ok: false, msg: "Escribe el nombre de la empresa o institución." };
    logo = await subirImagen(fd.get("logo"), "logos", 4);
    const e = await crearEmpresa(nombre, logo);
    refrescar();
    return { ok: true, id: e.id };
  } catch (x) {
    await borrarArchivos([logo]);
    return fallo(x);
  }
}

export async function guardarEmpresa(id: string, fd: FormData): Promise<Resultado<{ slug: string }>> {
  let nuevo: string | null = null;
  try {
    await exigirPanel();
    const e = await empresaPorId(id);
    if (!e) return { ok: false, msg: "Esa empresa ya no existe." };
    const nombre = texto(fd.get("nombre"), 80);
    if (!nombre) return { ok: false, msg: "El nombre no puede quedar vacío." };
    const slug = texto(fd.get("slug"), 60) || nombre;
    const quitarLogo = fd.get("quitarLogo") === "1";
    nuevo = await subirImagen(fd.get("logo"), "logos", 4);
    const cambios: Parameters<typeof actualizarEmpresa>[1] = { nombre, slug, visible: fd.get("visible") === "on" };
    if (nuevo) cambios.logo_path = nuevo;
    else if (quitarLogo) cambios.logo_path = null;
    await actualizarEmpresa(id, cambios);
    if (nuevo || quitarLogo) await borrarArchivos([e.logoPath]);
    refrescar();
    return { ok: true, slug: cambios.slug ?? e.slug };
  } catch (x) {
    await borrarArchivos([nuevo]);
    return fallo(x);
  }
}

export async function borrarEmpresaAccion(id: string): Promise<Resultado> {
  try {
    await exigirPanel();
    await borrarArchivos(await borrarEmpresa(id));
    refrescar();
    return { ok: true };
  } catch (x) { return fallo(x); }
}

export async function moverEmpresaAccion(id: string, dir: number): Promise<Resultado> {
  try {
    await exigirPanel();
    await moverEmpresa(id, dir < 0 ? -1 : 1);
    refrescar();
    return { ok: true };
  } catch (x) { return fallo(x); }
}

/* ------------------------------ Fotos ------------------------------ */

/** Lugar donde empiezan a quedar las fotos nuevas (al final de las que ya hay) */
export async function ordenInicial(empresaId: string): Promise<Resultado<{ orden: number }>> {
  try {
    await exigirPanel();
    if (!(await empresaPorId(empresaId))) return { ok: false, msg: "Esa empresa ya no existe." };
    return { ok: true, orden: await siguienteOrden(empresaId) };
  } catch (x) { return fallo(x); }
}

/** Permisos para subir un archivo y su miniatura (null: se sube al servidor del PC) */
export type Ticket = { path: string; grande: Permiso; mini: Permiso };
export type PorSubir = { ext: string; tipo: string; nombre: string };

/** Nombres y permisos para subir un grupo de fotos y videos (máximo 20 por vez) */
export async function prepararSubida(empresaId: string, items: PorSubir[]): Promise<Resultado<{ tickets: Ticket[] }>> {
  try {
    await exigirPanel();
    if (!(await empresaPorId(empresaId))) return { ok: false, msg: "Esa empresa ya no existe." };
    if (!items.length || items.length > 20) return { ok: false, msg: "Se suben de a 20 archivos por vez." };
    const tickets = await Promise.all(items.map(async ({ ext, tipo, nombre }) => {
      if (![...EXT_FOTO, ...EXT_VIDEO].includes(ext)) throw new Error("Debe ser una foto (JPG, PNG, WebP) o un video (MP4, MOV, WebM).");
      const path = nombreNuevo(`empresas/${empresaId}/fotos`, ext);
      const archivo = String(nombre || "archivo").replace(/[\\/:*?"<>|#%]+/g, "-").slice(0, 100);
      const [grande, mini] = await Promise.all([
        permisoSubida(path, tipo || MIME[ext] || "application/octet-stream", archivo),
        permisoSubida(miniDe(path), "image/jpeg"),
      ]);
      return { path, grande, mini };
    }));
    return { ok: true, tickets };
  } catch (x) { return fallo(x); }
}

export type DatosFoto = { path: string; conMini: boolean; ancho: number; alto: number; bytes: number; nombre: string; orden: number };

/** Anota en la base de datos una foto o video que ya quedó subido */
export async function registrarFoto(empresaId: string, d: DatosFoto): Promise<Resultado> {
  try {
    await exigirPanel();
    const m = RE_FOTO.exec(String(d.path));
    if (!m || m[1] !== empresaId) return { ok: false, msg: "Archivo no válido." };
    if (!(await existeArchivo(d.path))) return { ok: false, msg: "El archivo no alcanzó a subir. Inténtalo otra vez." };
    const entero = (n: unknown, max: number) => Math.max(0, Math.min(max, Math.round(Number(n) || 0)));
    await agregarFoto({
      empresa_id: empresaId,
      tipo: esVideo(d.path) ? "video" : "foto",
      path: d.path,
      mini_path: d.conMini && (await existeArchivo(miniDe(d.path))) ? miniDe(d.path) : null,
      ancho: entero(d.ancho, 100000), alto: entero(d.alto, 100000), bytes: entero(d.bytes, 1e10),
      nombre: String(d.nombre ?? "").replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[\\/:*?"<>|#%]+/g, "-").trim().slice(0, 80),
      orden: entero(d.orden, 1e9),
    });
    return { ok: true };
  } catch (x) { return fallo(x); }
}

export async function borrarFotosAccion(empresaId: string, ids: string[]): Promise<Resultado<{ n: number }>> {
  try {
    await exigirPanel();
    const archivos = await borrarFotos(empresaId, ids.slice(0, 5000));
    await borrarArchivos(archivos);
    refrescar();
    return { ok: true, n: ids.length };
  } catch (x) { return fallo(x); }
}

export async function moverFotoAccion(empresaId: string, id: string, dir: number): Promise<Resultado> {
  try {
    await exigirPanel();
    await moverFoto(empresaId, id, dir < 0 ? -1 : 1);
    refrescar();
    return { ok: true };
  } catch (x) { return fallo(x); }
}

export async function terminarSubida(): Promise<void> {
  if (await hayPanel()) refrescar();
}

/* ----------------------------- Ajustes ----------------------------- */

export async function guardarAjustesAccion(fd: FormData): Promise<Resultado> {
  let nuevo: string | null = null, nuevoLogo: string | null = null;
  try {
    await exigirPanel();
    const antes = await leerAjustes();
    const quitarFondo = fd.get("quitarFondo") === "1";
    const quitarLogo = fd.get("quitarLogo") === "1";
    nuevo = await subirImagen(fd.get("fondo"), "fondo", 5);
    nuevoLogo = await subirImagen(fd.get("logo"), "logos", 4);
    const modo: FondoModo = fd.get("fondoModo") === "centrado" ? "centrado" : "cubrir";
    const oscuro = Math.max(0, Math.min(95, Math.round(Number(fd.get("fondoOscuro")) || 0)));
    await guardarAjustes({
      titulo: texto(fd.get("titulo"), 60),
      subtitulo: texto(fd.get("subtitulo"), 140),
      fondo_modo: modo,
      fondo_oscuro: oscuro,
      ...(nuevo ? { fondo_path: nuevo } : quitarFondo ? { fondo_path: null } : {}),
      ...(nuevoLogo ? { logo_path: nuevoLogo } : quitarLogo ? { logo_path: null } : {}),
    });
    if (nuevo || quitarFondo) await borrarArchivos([antes.fondoPath]);
    if (nuevoLogo || quitarLogo) await borrarArchivos([antes.logoPath]);
    refrescar();
    return { ok: true };
  } catch (x) {
    await borrarArchivos([nuevo, nuevoLogo]);
    return fallo(x);
  }
}
