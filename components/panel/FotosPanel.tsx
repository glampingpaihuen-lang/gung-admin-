"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { borrarFotosAccion, moverFotoAccion } from "@/lib/acciones";
import type { Foto } from "@/lib/tipos";
import { cuentaArchivos } from "@/components/Logo";

/** Botón que pide un segundo toque antes de hacer algo que no se puede deshacer */
export function useSeguro(): [string | null, (clave: string) => boolean] {
  const [armado, setArmado] = useState<string | null>(null);
  useEffect(() => {
    if (!armado) return;
    const t = setTimeout(() => setArmado(null), 3500);
    return () => clearTimeout(t);
  }, [armado]);
  const pedir = (clave: string) => {
    if (armado === clave) { setArmado(null); return true; }
    setArmado(clave);
    return false;
  };
  return [armado, pedir];
}

export function FotosPanel({ empresaId, fotos }: { empresaId: string; fotos: Foto[] }) {
  const [eligiendo, setEligiendo] = useState(false);
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [ocupado, empezar] = useTransition();
  const [armado, pedir] = useSeguro();
  const router = useRouter();

  // Si una foto ya no está (la borraron), se quita de las elegidas
  useEffect(() => {
    setElegidas(s => new Set([...s].filter(id => fotos.some(f => f.id === id))));
  }, [fotos]);

  const hacer = (fn: () => Promise<{ ok: boolean; msg?: string }>) => empezar(async () => {
    setError("");
    const r = await fn();
    if (!r.ok) setError(r.msg ?? "No se pudo.");
    router.refresh();
  });

  const alternar = (id: string) => setElegidas(s => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  if (!fotos.length) return <p className="p-vacio">Esta empresa todavía no tiene fotos ni videos. Súbelos arriba.</p>;

  return (
    <div>
      <div className="p-fotos-barra">
        <b>{cuentaArchivos(fotos.length, fotos.filter(f => f.tipo === "video").length)}</b>
        <div className="p-acciones">
          {eligiendo ? (
            <>
              <button type="button" className="btn btn--linea btn--chico" onClick={() => setElegidas(elegidas.size === fotos.length ? new Set() : new Set(fotos.map(f => f.id)))}>
                {elegidas.size === fotos.length ? "Quitar todas" : "Elegir todas"}
              </button>
              <button type="button" className={`btn btn--peligro btn--chico${armado === "varias" ? " is-seguro" : ""}`} disabled={!elegidas.size || ocupado}
                onClick={() => { if (pedir("varias")) hacer(async () => { const r = await borrarFotosAccion(empresaId, [...elegidas]); if (r.ok) setElegidas(new Set()); return r; }); }}>
                {armado === "varias" ? `Toca otra vez para borrar ${elegidas.size}` : `Borrar elegidas (${elegidas.size})`}
              </button>
              <button type="button" className="btn btn--linea btn--chico" onClick={() => { setEligiendo(false); setElegidas(new Set()); }}>Listo</button>
            </>
          ) : (
            <button type="button" className="btn btn--linea btn--chico" onClick={() => setEligiendo(true)}>Elegir varias para borrar</button>
          )}
        </div>
      </div>

      {error ? <p className="msg msg--error" role="alert">{error}</p> : null}

      <ul className="p-fotos" aria-busy={ocupado}>
        {fotos.map((f, i) => (
          <li key={f.id} className={`p-foto${elegidas.has(f.id) ? " is-elegida" : ""}`}>
            {f.mini
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={f.mini} alt={f.nombre} loading="lazy" decoding="async" />
              : <video src={`${f.url}#t=0.5`} muted playsInline preload="metadata" />}
            {f.tipo === "video" ? (
              <span className="p-foto__video" aria-label="Video">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10-6.5z" fill="currentColor" stroke="none" /></svg>
              </span>
            ) : null}
            <span className="p-foto__n">{i + 1}</span>
            {eligiendo ? (
              <label className="p-foto__elegir">
                <input type="checkbox" checked={elegidas.has(f.id)} onChange={() => alternar(f.id)} aria-label={`Elegir ${f.tipo === "video" ? "video" : "foto"} ${i + 1}`} />
              </label>
            ) : (
              <div className="p-foto__tools">
                <button type="button" disabled={i === 0 || ocupado} onClick={() => hacer(() => moverFotoAccion(empresaId, f.id, -1))} aria-label="Mover antes" title="Mover antes">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5.5 8 12l6.5 6.5" /></svg>
                </button>
                <button type="button" disabled={i === fotos.length - 1 || ocupado} onClick={() => hacer(() => moverFotoAccion(empresaId, f.id, 1))} aria-label="Mover después" title="Mover después">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 5.5 16 12l-6.5 6.5" /></svg>
                </button>
                <button type="button" className={`is-borrar${armado === f.id ? " is-seguro" : ""}`} disabled={ocupado}
                  onClick={() => { if (pedir(f.id)) hacer(() => borrarFotosAccion(empresaId, [f.id])); }}
                  aria-label={armado === f.id ? "Toca otra vez para borrar" : "Borrar"} title="Borrar">
                  {armado === f.id ? "¿Borrar?" : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" /></svg>}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
