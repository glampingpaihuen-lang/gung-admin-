"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { guardarAjustesAccion } from "@/lib/acciones";
import { LOGO_GUNG_HO } from "@/lib/nube";
import type { Ajustes, FondoModo } from "@/lib/tipos";
import { prepararImagen } from "./imagen";

/** Vista previa local de un archivo elegido */
function useVista(archivo: File | null) {
  const [vista, setVista] = useState<string | null>(null);
  useEffect(() => {
    if (!archivo) { setVista(null); return; }
    const u = URL.createObjectURL(archivo);
    setVista(u);
    return () => URL.revokeObjectURL(u);
  }, [archivo]);
  return vista;
}

/** Lo que se ve al entrar a la página: logo de arriba, textos y fondo, con vista previa */
export function AjustesForm({ ajustes }: { ajustes: Ajustes }) {
  const [titulo, setTitulo] = useState(ajustes.titulo);
  const [subtitulo, setSubtitulo] = useState(ajustes.subtitulo);
  const [modo, setModo] = useState<FondoModo>(ajustes.fondoModo);
  const [oscuro, setOscuro] = useState(ajustes.fondoOscuro);
  const [fondoArchivo, setFondoArchivo] = useState<File | null>(null);
  const [quitarFondo, setQuitarFondo] = useState(false);
  const [logoArchivo, setLogoArchivo] = useState<File | null>(null);
  const [quitarLogo, setQuitarLogo] = useState(false);
  const [preparando, setPreparando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [ocupado, empezar] = useTransition();
  const router = useRouter();
  const vistaFondo = useVista(fondoArchivo);
  const vistaLogo = useVista(logoArchivo);

  const fondo = quitarFondo ? null : vistaFondo ?? ajustes.fondo;
  const logoPropio = quitarLogo ? null : vistaLogo ?? ajustes.logo;
  const cambio = titulo !== ajustes.titulo || subtitulo !== ajustes.subtitulo || modo !== ajustes.fondoModo
    || oscuro !== ajustes.fondoOscuro || !!fondoArchivo || quitarFondo || !!logoArchivo || quitarLogo;
  const estiloFondo = { "--oscuro": oscuro / 100, ...(fondo ? { "--fondo-img": `url("${fondo}")` } : {}) } as CSSProperties;

  async function elegir(f: File | undefined, maxLado: number, relleno: string, maxBytes: number, listo: (f: File) => void) {
    if (!f) return;
    setMsg(null); setPreparando(true);
    try { listo(await prepararImagen(f, maxLado, relleno, maxBytes)); }
    catch (x) { setMsg({ ok: false, texto: (x as Error).message }); }
    finally { setPreparando(false); }
  }

  return (
    <form className="p-ajustes"
      onSubmit={e => {
        e.preventDefault();
        empezar(async () => {
          setMsg(null);
          const fd = new FormData();
          fd.set("titulo", titulo);
          fd.set("subtitulo", subtitulo);
          fd.set("fondoModo", modo);
          fd.set("fondoOscuro", String(oscuro));
          if (fondoArchivo) fd.set("fondo", fondoArchivo);
          if (quitarFondo) fd.set("quitarFondo", "1");
          if (logoArchivo) fd.set("logo", logoArchivo);
          if (quitarLogo) fd.set("quitarLogo", "1");
          const r = await guardarAjustesAccion(fd);
          if (!r.ok) { setMsg({ ok: false, texto: r.msg }); return; }
          setFondoArchivo(null); setQuitarFondo(false); setLogoArchivo(null); setQuitarLogo(false);
          setMsg({ ok: true, texto: "Listo, la página ya se ve así." });
          router.refresh();
        });
      }}>
      <div>
        <div className="campo">
          <span className="campo__titulo">Logo de arriba</span>
          <div className="p-acciones">
            <label className="btn btn--linea btn--chico archivo-btn">
              {preparando ? "Preparando…" : "Cambiar logo"}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/*" disabled={preparando}
                onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; void elegir(f, 1600, "#000000", 3.5 * 1024 * 1024, a => { setLogoArchivo(a); setQuitarLogo(false); }); }} />
            </label>
            {logoPropio ? <button type="button" className="btn btn--linea btn--chico" onClick={() => { setLogoArchivo(null); setQuitarLogo(!!ajustes.logo); }}>Usar el de Gung Ho</button> : null}
          </div>
          <small>Si no subes otro, sale el logo de Gung Ho.</small>
        </div>

        <label className="campo">
          <span className="campo__titulo">Título debajo del logo</span>
          <input className="entrada" value={titulo} onChange={e => setTitulo(e.target.value)} maxLength={60} placeholder="Déjalo vacío si no quieres título" />
        </label>
        <label className="campo">
          <span className="campo__titulo">Texto debajo del título</span>
          <input className="entrada" value={subtitulo} onChange={e => setSubtitulo(e.target.value)} maxLength={140} />
        </label>

        <div className="campo">
          <span className="campo__titulo">Imagen de fondo</span>
          <div className="p-acciones">
            <label className="btn btn--linea btn--chico archivo-btn">
              {preparando ? "Preparando…" : fondo ? "Cambiar imagen" : "Poner una imagen"}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/*" disabled={preparando}
                onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; void elegir(f, 2600, "#000000", 3.8 * 1024 * 1024, a => { setFondoArchivo(a); setQuitarFondo(false); }); }} />
            </label>
            {fondo ? <button type="button" className="btn btn--linea btn--chico" onClick={() => { setFondoArchivo(null); setQuitarFondo(!!ajustes.fondo); }}>Quitar imagen</button> : null}
          </div>
          <small>Sin imagen propia, de fondo van los afiches de Gung Ho (el vertical en el celular y el horizontal en el computador).</small>
        </div>

        {fondo ? (
            <fieldset className="campo" style={{ border: 0, padding: 0, margin: "0 0 16px" }}>
              <legend className="campo__titulo" style={{ marginBottom: 6 }}>Cómo se acomoda</legend>
              <div className="opciones">
                <label className="opcion"><input type="radio" name="modo" checked={modo === "cubrir"} onChange={() => setModo("cubrir")} />Llenar toda la pantalla</label>
                <label className="opcion"><input type="radio" name="modo" checked={modo === "centrado"} onChange={() => setModo("centrado")} />Completa en el centro</label>
              </div>
            </fieldset>
        ) : null}
            <label className="campo">
              <span className="campo__titulo">Oscurecer el fondo: {oscuro}%</span>
              <input type="range" min={0} max={95} step={5} value={oscuro} onChange={e => setOscuro(Number(e.target.value))} />
              <small>Más oscuro hace que las tarjetas y los textos se lean mejor encima.</small>
            </label>

        {msg ? <p className={`msg ${msg.ok ? "msg--ok" : "msg--error"}`} role={msg.ok ? "status" : "alert"}>{msg.texto}</p> : null}
        <div className="p-acciones" style={{ marginTop: 16 }}>
          <button type="submit" className="btn btn--primario" disabled={ocupado || preparando || !cambio}>{ocupado ? "Guardando…" : "Guardar"}</button>
        </div>
      </div>

      <div>
        <span className="campo__titulo" style={{ display: "block", marginBottom: 6 }}>Así se ve al entrar</span>
        <div className="muestra">
          <div className={`fondo fondo--muestra ${fondo ? `fondo--${modo}` : "fondo--gungho"}`} style={estiloFondo} aria-hidden="true" />
          <div className="muestra__contenido">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={`muestra__logo${logoPropio ? "" : " is-gungho"}`} src={logoPropio ?? LOGO_GUNG_HO} alt="" />
            {titulo ? <p className="muestra__titulo">{titulo}</p> : null}
            {subtitulo ? <p className="muestra__sub">{subtitulo}</p> : null}
            <div className="muestra__tarjetas" aria-hidden="true"><i /><i /></div>
          </div>
        </div>
      </div>
    </form>
  );
}
