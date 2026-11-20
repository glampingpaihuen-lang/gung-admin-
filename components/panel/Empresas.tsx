"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { crearEmpresaAccion, moverEmpresaAccion } from "@/lib/acciones";
import type { EmpresaResumen } from "@/lib/tipos";
import { cuentaArchivos, Logo } from "@/components/Logo";
import { ElegirLogo, type Eleccion } from "./ElegirImagen";

export function NuevaEmpresa({ abiertaAlInicio = false }: { abiertaAlInicio?: boolean }) {
  const [abierta, setAbierta] = useState(abiertaAlInicio);
  const [nombre, setNombre] = useState("");
  const [logo, setLogo] = useState<Eleccion>({ archivo: null, quitar: false });
  const [error, setError] = useState("");
  const [ocupado, empezar] = useTransition();
  const router = useRouter();

  if (!abierta) {
    return <button type="button" className="btn btn--primario" onClick={() => setAbierta(true)}>Nueva empresa</button>;
  }

  return (
    <form className="p-nueva" style={{ flexBasis: "100%" }}
      onSubmit={e => {
        e.preventDefault();
        empezar(async () => {
          setError("");
          const fd = new FormData();
          fd.set("nombre", nombre);
          if (logo.archivo) fd.set("logo", logo.archivo);
          const r = await crearEmpresaAccion(fd);
          if (!r.ok) { setError(r.msg); return; }
          router.push(`/empresa/${r.id}`);
        });
      }}>
      <h3 className="p-h2" style={{ fontSize: "1.0625rem", marginBottom: 14 }}>Nueva empresa o institución</h3>
      <label className="campo">
        <span className="campo__titulo">Nombre</span>
        <input className="entrada" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej.: Colegio San José" maxLength={80} required autoFocus />
      </label>
      <div className="campo">
        <span className="campo__titulo">Logo</span>
        <ElegirLogo actual={null} nombre={nombre} valor={logo} onChange={setLogo} />
        <small>Mejor si es PNG con fondo transparente. Lo puedes poner después.</small>
      </div>
      {error ? <p className="msg msg--error" role="alert">{error}</p> : null}
      <div className="p-acciones" style={{ marginTop: 14 }}>
        <button type="submit" className="btn btn--primario" disabled={ocupado || !nombre.trim()}>{ocupado ? "Creando…" : "Crear empresa"}</button>
        <button type="button" className="btn btn--linea" onClick={() => { setAbierta(false); setNombre(""); setLogo({ archivo: null, quitar: false }); setError(""); }}>Cancelar</button>
      </div>
    </form>
  );
}

export function ListaEmpresas({ empresas }: { empresas: EmpresaResumen[] }) {
  const [ocupado, empezar] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();

  const mover = (id: string, dir: number) => empezar(async () => {
    setError("");
    const r = await moverEmpresaAccion(id, dir);
    if (!r.ok) setError(r.msg);
    router.refresh();
  });

  return (
    <>
      {error ? <p className="msg msg--error" role="alert">{error}</p> : null}
      <ul className="p-lista" aria-busy={ocupado}>
        {empresas.map((e, i) => (
          <li key={e.id}>
            <div className="p-fila">
              <Logo src={e.logo} nombre={e.nombre} className="p-logo" />
              <div style={{ minWidth: 0 }}>
                <Link href={`/empresa/${e.id}`} className="p-fila__nombre">{e.nombre}</Link>
                <div className="p-fila__meta">
                  {e.total ? cuentaArchivos(e.total, e.videos) : "Sin fotos"}
                  {e.visible ? null : <span className="p-etiqueta">Oculta en la página principal</span>}
                </div>
              </div>
              <div className="p-fila__btns">
                <button type="button" className="btn-ico" disabled={i === 0 || ocupado} onClick={() => mover(e.id, -1)} aria-label={`Subir ${e.nombre} en la lista`} title="Subir">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 14.5 12 8.5l6 6" /></svg>
                </button>
                <button type="button" className="btn-ico" disabled={i === empresas.length - 1 || ocupado} onClick={() => mover(e.id, 1)} aria-label={`Bajar ${e.nombre} en la lista`} title="Bajar">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9.5 12 15.5l6-6" /></svg>
                </button>
                <Link href={`/empresa/${e.id}`} className="btn btn--linea btn--chico" style={{ minHeight: 40 }}>Abrir</Link>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
