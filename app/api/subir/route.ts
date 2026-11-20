import type { NextRequest } from "next/server";
import { COOKIE, sesionValida } from "@/lib/auth";
import { esVideo, guardarArchivo, MAX_ARCHIVO_MB, miniDe, RE_FOTO, supa, TIPOS, TIPOS_VIDEO } from "@/lib/archivos";

/**
 * Solo pruebas en el PC sin Supabase: recibe una foto o video (y su miniatura) y lo guarda en .datos/archivos/.
 * Con Supabase el navegador sube directo allá y esta ruta no se usa.
 */
export async function POST(req: NextRequest) {
  if (!sesionValida(req.cookies.get(COOKIE)?.value)) return Response.json({ ok: false, msg: "Vuelve a entrar al panel." }, { status: 401 });
  if (supa() || process.env.VERCEL) return Response.json({ ok: false, msg: "Esta ruta es solo para pruebas en el PC." }, { status: 400 });
  try {
    const fd = await req.formData();
    const p = String(fd.get("path") ?? "");
    if (!RE_FOTO.test(p)) return Response.json({ ok: false, msg: "Archivo no válido." }, { status: 400 });
    const archivo = fd.get("archivo"), mini = fd.get("mini");
    const valido = archivo instanceof File && (esVideo(p) ? !!TIPOS_VIDEO[archivo.type] || archivo.type === "" : !!TIPOS[archivo.type]);
    if (!valido) return Response.json({ ok: false, msg: "Debe ser una foto (JPG, PNG, WebP) o un video (MP4, MOV, WebM)." }, { status: 400 });
    if (archivo.size > MAX_ARCHIVO_MB * 1024 * 1024) return Response.json({ ok: false, msg: `Pesa más de ${MAX_ARCHIVO_MB} MB.` }, { status: 400 });
    await guardarArchivo(p, Buffer.from(await archivo.arrayBuffer()), archivo.type || "application/octet-stream");
    if (mini instanceof File && mini.type === "image/jpeg") await guardarArchivo(miniDe(p), Buffer.from(await mini.arrayBuffer()), mini.type);
    return Response.json({ ok: true });
  } catch (x) {
    return Response.json({ ok: false, msg: (x as Error).message }, { status: 500 });
  }
}
