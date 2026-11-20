"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ordenInicial, prepararSubida, registrarFoto, terminarSubida, type Ticket } from "@/lib/acciones";
import { prepararArchivo, subirLocal, subirPut } from "./imagen";

const A_LA_VEZ = 2; // archivos subiendo al mismo tiempo

type Estado = { total: number; hechas: number; avance: number; fallas: { nombre: string; msg: string }[]; subiendo: boolean };
const VACIO: Estado = { total: 0, hechas: 0, avance: 0, fallas: [], subiendo: false };

export function SubirFotos({ empresaId, maxMb }: { empresaId: string; maxMb: number }) {
  const [estado, setEstado] = useState<Estado>(VACIO);
  const [encima, setEncima] = useState(false);
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);

  // Si cierran la página mientras sube, el navegador pregunta antes
  useEffect(() => {
    if (!estado.subiendo) return;
    const aviso = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    addEventListener("beforeunload", aviso);
    return () => removeEventListener("beforeunload", aviso);
  }, [estado.subiendo]);

  async function subir(lista: File[]) {
    const files = lista
      .filter(f => /^(image|video)\//.test(f.type) || /\.(jpe?g|png|webp|heic|heif|mp4|mov|m4v|webm)$/i.test(f.name))
      .sort((a, b) => a.name.localeCompare(b.name, "es", { numeric: true }));
    if (!files.length) {
      setEstado({ ...VACIO, fallas: [{ nombre: "", msg: "Esos archivos no son fotos ni videos. Elige fotos JPG, PNG o WebP, o videos MP4, MOV o WebM." }] });
      return;
    }
    const r0 = await ordenInicial(empresaId);
    if (!r0.ok) { setEstado({ ...VACIO, fallas: [{ nombre: "", msg: r0.msg }] }); return; }
    const base = r0.orden;

    const parcial = new Map<number, number>();
    let hechas = 0;
    const fallas: Estado["fallas"] = [];
    const pintar = () => {
      let suma = hechas;
      parcial.forEach(p => { suma += p; });
      setEstado({ total: files.length, hechas, avance: suma / files.length, fallas: [...fallas], subiendo: true });
    };
    pintar();

    let siguiente = 0;
    const trabajar = async () => {
      while (siguiente < files.length) {
        const i = siguiente++;
        const f = files[i];
        try {
          const lista = await prepararArchivo(f, maxMb);
          const permiso = await prepararSubida(empresaId, [{ ext: lista.ext, tipo: lista.grande.type, nombre: lista.grande.name }]);
          if (!permiso.ok) throw new Error(permiso.msg);
          const t: Ticket = permiso.tickets[0];
          const peso = lista.grande.size + (lista.mini?.size ?? 0);
          const avanzar = (p: number) => { parcial.set(i, Math.min(0.95, p)); pintar(); };
          if (t.grande) {
            await subirPut(t.grande.url, lista.grande, t.grande.headers, p => avanzar((p * lista.grande.size) / peso));
            if (lista.mini && t.mini) await subirPut(t.mini.url, lista.mini, t.mini.headers, p => avanzar((lista.grande.size + p * lista.mini!.size) / peso));
          } else {
            await subirLocal(t.path, lista.grande, lista.mini, avanzar);
          }
          const r = await registrarFoto(empresaId, {
            path: t.path, conMini: !!lista.mini, ancho: lista.ancho, alto: lista.alto,
            bytes: lista.grande.size, nombre: f.name, orden: base + i,
          });
          if (!r.ok) throw new Error(r.msg);
          hechas++;
          if (hechas % 12 === 0) router.refresh();
        } catch (x) {
          fallas.push({ nombre: f.name, msg: (x as Error).message });
        } finally {
          parcial.delete(i);
          pintar();
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(A_LA_VEZ, files.length) }, trabajar));
    await terminarSubida();
    setEstado({ total: files.length, hechas, avance: 1, fallas: [...fallas], subiendo: false });
    router.refresh();
  }

  const { total, hechas, avance, fallas, subiendo } = estado;
  const pct = Math.round(avance * 100);

  return (
    <div>
      <label
        className={`subir${encima ? " is-encima" : ""}`}
        onDragOver={e => { e.preventDefault(); if (!subiendo) setEncima(true); }}
        onDragLeave={() => setEncima(false)}
        onDrop={e => { e.preventDefault(); setEncima(false); if (!subiendo) void subir([...e.dataTransfer.files]); }}
        aria-disabled={subiendo}
        style={subiendo ? { pointerEvents: "none", opacity: 0.6 } : undefined}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17.5h-.5a4 4 0 0 1-.6-7.96A6 6 0 0 1 17.5 8.5a4.5 4.5 0 0 1 .5 8.97M12 11v9m0-9-3.5 3.5M12 11l3.5 3.5" /></svg>
        <b>Arrastra las fotos y videos aquí o toca para elegirlos</b>
        <span>Se suben en su calidad original (HD). Puedes subir muchos a la vez; quedan en el orden de su nombre, después de los que ya hay. {maxMb >= 1024 ? "" : `Máximo ${maxMb} MB por archivo.`}</span>
        <input ref={input} type="file" accept="image/*,video/*" multiple disabled={subiendo}
          onChange={e => { const l = [...(e.target.files ?? [])]; e.target.value = ""; void subir(l); }} />
      </label>

      {total ? (
        <div className="progreso" role="status" aria-live="polite">
          <div className="progreso__texto">
            <b>{subiendo ? `Subiendo ${Math.min(hechas + 1, total)} de ${total}` : hechas === total ? (total === 1 ? "Archivo subido" : `${total} archivos subidos`) : `Se subieron ${hechas} de ${total}`}</b>
            <span>{pct}%</span>
          </div>
          <div className="barra"><i style={{ width: `${pct}%` }} /></div>
          {subiendo ? <small>No cierres esta página hasta que termine.</small> : null}
        </div>
      ) : null}

      {fallas.length ? (
        <div className="msg msg--error" role="alert">
          {fallas.length === 1 && !fallas[0].nombre ? fallas[0].msg : (
            <>
              <b>{fallas.length === 1 ? "Un archivo no se pudo subir:" : `${fallas.length} archivos no se pudieron subir:`}</b>
              <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                {fallas.slice(0, 8).map((f, k) => <li key={k}>«{f.nombre}»: {f.msg}</li>)}
              </ul>
              {fallas.length > 8 ? <div>…y {fallas.length - 8} más.</div> : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
