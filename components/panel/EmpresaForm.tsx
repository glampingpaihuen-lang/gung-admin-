"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { borrarEmpresaAccion, guardarEmpresa } from "@/lib/acciones";
import { aSlug } from "@/lib/slug";
import type { Empresa } from "@/lib/tipos";
import { ElegirLogo, type Eleccion } from "./ElegirImagen";
import { useSeguro } from "./FotosPanel";
import { URL_NUBE } from "@/lib/nube";

export function EmpresaForm({ empresa, total }: { empresa: Empresa; total: number }) {
  const [nombre, setNombre] = useState(empresa.nombre);
  const [slug, setSlug] = useState(empresa.slug);
  const [visible, setVisible] = useState(empresa.visible);
  const [logo, setLogo] = useState<Eleccion>({ archivo: null, quitar: false });
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [ocupado, empezar] = useTransition();
  const [armado, pedir] = useSeguro();
  const router = useRouter();

  const enlace = `${URL_NUBE}/${empresa.slug}`;
  const cambio = nombre !== empresa.nombre || slug !== empresa.slug || visible !== empresa.visible || !!logo.archivo || logo.quitar;

  return (
    <>
      <form
        onSubmit={e => {
          e.preventDefault();
          empezar(async () => {
            setMsg(null);
            const fd = new FormData();
            fd.set("nombre", nombre);
            fd.set("slug", slug);
            if (visible) fd.set("visible", "on");
            if (logo.archivo) fd.set("logo", logo.archivo);
            if (logo.quitar) fd.set("quitarLogo", "1");
            const r = await guardarEmpresa(empresa.id, fd);
            if (!r.ok) { setMsg({ ok: false, texto: r.msg }); return; }
            setSlug(r.slug);
            setLogo({ archivo: null, quitar: false });
            setMsg({ ok: true, texto: "Cambios guardados." });
            router.refresh();
          });
        }}>
        <div className="campo">
          <span className="campo__titulo">Logo</span>
          <ElegirLogo actual={empresa.logo} nombre={nombre} valor={logo} onChange={setLogo} grande />
        </div>
        <label className="campo">
          <span className="campo__titulo">Nombre</span>
          <input className="entrada" value={nombre} onChange={e => setNombre(e.target.value)} maxLength={80} required />
        </label>
        <label className="campo">
          <span className="campo__titulo">Enlace para compartir</span>
          <span className="entrada-grupo">
            <span>{URL_NUBE.replace(/^https?:\/\//, "")}/</span>
            <input className="entrada" value={slug} maxLength={60} required
              onChange={e => setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
              onBlur={() => setSlug(s => aSlug(s || nombre))} />
          </span>
          <small>Si lo cambias, el enlace viejo deja de funcionar.</small>
        </label>
        <label className="casilla">
          <input type="checkbox" checked={visible} onChange={e => setVisible(e.target.checked)} />
          <span>
            Mostrar en la página principal
            <small>Si la quitas, su tarjeta no sale y solo se puede abrir con su enlace.</small>
          </span>
        </label>
        {msg ? <p className={`msg ${msg.ok ? "msg--ok" : "msg--error"}`} role={msg.ok ? "status" : "alert"}>{msg.texto}</p> : null}
        <div className="p-acciones" style={{ marginTop: 16 }}>
          <button type="submit" className="btn btn--primario" disabled={ocupado || !cambio || !nombre.trim()}>{ocupado ? "Guardando…" : "Guardar cambios"}</button>
          <a className="btn btn--linea" href={enlace} target="_blank" rel="noreferrer">Ver como la ven los clientes</a>
          <button type="button" className="btn btn--linea" onClick={async () => {
            try { await navigator.clipboard.writeText(enlace); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }
            catch { setMsg({ ok: true, texto: `Enlace: ${enlace}` }); }
          }}>{copiado ? "Enlace copiado" : "Copiar enlace"}</button>
        </div>
      </form>

      <div style={{ marginTop: 26, paddingTop: 18, borderTop: "1px solid var(--p-linea)" }}>
        <button type="button" className={`btn btn--peligro${armado === "empresa" ? " is-seguro" : ""}`} disabled={ocupado}
          onClick={() => {
            if (!pedir("empresa")) return;
            empezar(async () => {
              const r = await borrarEmpresaAccion(empresa.id);
              if (!r.ok) { setMsg({ ok: false, texto: r.msg }); return; }
              router.push("/");
            });
          }}>
          {armado === "empresa"
            ? "Toca otra vez para borrarla del todo"
            : total === 1 ? "Borrar la empresa y su archivo" : total ? `Borrar la empresa y sus ${total} fotos y videos` : "Borrar la empresa"}
        </button>
      </div>
    </>
  );
}
