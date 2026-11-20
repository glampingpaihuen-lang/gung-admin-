"use client";
import { useEffect, useState } from "react";
import { iniciales } from "@/components/Logo";
import { prepararImagen } from "./imagen";

export type Eleccion = { archivo: File | null; quitar: boolean };

/** Vista del logo + botones para elegir otro o quitarlo */
export function ElegirLogo({ actual, nombre, valor, onChange, grande = false }: {
  actual: string | null; nombre: string; valor: Eleccion; onChange: (e: Eleccion) => void; grande?: boolean;
}) {
  const [vista, setVista] = useState<string | null>(null);
  const [preparando, setPreparando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!valor.archivo) { setVista(null); return; }
    const u = URL.createObjectURL(valor.archivo);
    setVista(u);
    return () => URL.revokeObjectURL(u);
  }, [valor.archivo]);

  const src = valor.quitar ? null : vista ?? actual;

  return (
    <div>
      <div className="imagen-campo">
        <span className={`p-logo${grande ? " p-logo--grande" : ""}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {src ? <img src={src} alt="" /> : <b>{nombre.trim() ? iniciales(nombre) : "Logo"}</b>}
        </span>
        <div className="p-acciones">
          <label className="btn btn--linea btn--chico archivo-btn">
            {preparando ? "Preparando…" : src ? "Cambiar logo" : "Elegir logo"}
            <input type="file" accept="image/png,image/jpeg,image/webp,image/*" disabled={preparando}
              onChange={async e => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                setError(""); setPreparando(true);
                try { onChange({ archivo: await prepararImagen(f, 700, "#ffffff"), quitar: false }); }
                catch (x) { setError((x as Error).message); }
                finally { setPreparando(false); }
              }} />
          </label>
          {src ? <button type="button" className="btn btn--linea btn--chico" onClick={() => onChange({ archivo: null, quitar: !!actual })}>Quitar logo</button> : null}
        </div>
      </div>
      {error ? <p className="msg msg--error" role="alert">{error}</p> : null}
    </div>
  );
}
