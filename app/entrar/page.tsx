import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EntrarForm } from "@/components/panel/EntrarForm";
import { codigoPanel, hayPanel, usandoCodigoPrueba } from "@/lib/auth";
import { LOGO_GUNG_HO } from "@/lib/nube";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Entrar" };

export default async function Entrar() {
  if (await hayPanel()) redirect("/");
  return (
    <main className="entrar">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="entrar__logo" src={LOGO_GUNG_HO} alt="Gung Ho" />
      <div className="entrar__caja">
        <h1 className="p-h1">Panel Gung Ho</h1>
        <p className="p-nota">Escribe el código para subir fotos y crear empresas.</p>
        <EntrarForm prueba={usandoCodigoPrueba()} numerico={/^\d+$/.test(codigoPanel() ?? "")} />
      </div>
    </main>
  );
}
