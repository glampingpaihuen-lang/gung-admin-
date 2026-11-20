import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Entrada al panel con un código (sin correo ni contraseña).
 * El código va en la variable CODIGO_PANEL. En el PC, si no está, el código de prueba es 1234.
 * La sesión dura 60 días en ese dispositivo; si cambias el código, todos tienen que volver a entrar.
 */
export const COOKIE = "nube_panel";
const DIAS = 60;
export const CODIGO_PRUEBA = "1234";

const enProduccion = () => !!process.env.VERCEL || process.env.NODE_ENV === "production";

export function codigoPanel(): string | null {
  const c = process.env.CODIGO_PANEL?.trim();
  if (c) return c;
  return enProduccion() ? null : CODIGO_PRUEBA;
}

export const usandoCodigoPrueba = () => !process.env.CODIGO_PANEL?.trim() && !enProduccion();

function llave(): Buffer {
  return createHash("sha256").update(`nube-gung-ho|${process.env.SESION_SECRETO ?? ""}|${codigoPanel() ?? ""}`).digest();
}

const firma = (texto: string) => createHmac("sha256", llave()).update(texto).digest("base64url");

function iguales(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function codigoCorrecto(intento: string): boolean {
  const c = codigoPanel();
  if (!c) return false;
  // Se comparan las huellas para que siempre tarde lo mismo, sin importar el largo
  const h = (t: string) => createHash("sha256").update(t.normalize("NFKC")).digest("hex");
  return iguales(h(intento.trim()), h(c));
}

export function crearSesion(): { valor: string; maxAge: number } {
  const vence = Date.now() + DIAS * 86400_000;
  return { valor: `${vence}.${firma(`panel.${vence}`)}`, maxAge: DIAS * 86400 };
}

export function sesionValida(valor: string | undefined): boolean {
  if (!valor || !codigoPanel()) return false;
  const [vence, f] = valor.split(".");
  if (!vence || !f || !(Number(vence) > Date.now())) return false;
  return iguales(f, firma(`panel.${vence}`));
}

export async function hayPanel(): Promise<boolean> {
  return sesionValida((await cookies()).get(COOKIE)?.value);
}

/** Para páginas del panel: sin sesión, a la pantalla del código */
export async function exigirPanelPagina() {
  if (!(await hayPanel())) redirect("/entrar");
}

/** Para acciones del panel: sin sesión, error */
export async function exigirPanel() {
  if (!(await hayPanel())) throw new Error("Tu sesión del panel se cerró. Vuelve a entrar con el código.");
}

/* ------- Freno para quien intente adivinar el código (5 intentos fallidos → 15 minutos) ------- */
const fallos = new Map<string, number[]>();
const VENTANA = 15 * 60_000, MAX_FALLOS = 5;

export async function ipCliente() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim().slice(0, 64);
}

export function bloqueado(ip: string): boolean {
  const ahora = Date.now();
  const lista = (fallos.get(ip) ?? []).filter(t => ahora - t < VENTANA);
  fallos.set(ip, lista);
  return lista.length >= MAX_FALLOS;
}

export function anotarFallo(ip: string) {
  fallos.set(ip, [...(fallos.get(ip) ?? []), Date.now()]);
}
