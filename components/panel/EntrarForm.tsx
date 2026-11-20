"use client";
import { useActionState } from "react";
import { entrar } from "@/lib/acciones";

export function EntrarForm({ prueba, numerico }: { prueba: boolean; numerico: boolean }) {
  const [estado, accion, ocupado] = useActionState(entrar, null);
  return (
    <form action={accion}>
      <label className="campo">
        <span className="sr">Código</span>
        <input className="entrada entrada--codigo" name="codigo" type="password" inputMode={numerico ? "numeric" : "text"} autoComplete="current-password"
          placeholder="••••" required autoFocus />
      </label>
      {estado?.msg ? <p className="msg msg--error" role="alert" style={{ margin: "0 0 12px" }}>{estado.msg}</p> : null}
      <button type="submit" className="btn btn--primario" disabled={ocupado}>{ocupado ? "Revisando…" : "Entrar"}</button>
      {prueba ? <p className="entrar__prueba">Modo de prueba en este PC: el código es <b>1234</b>. Para poner el tuyo, escribe CODIGO_PANEL en el archivo .env.local.</p> : null}
    </form>
  );
}
