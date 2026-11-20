import Link from "next/link";
import { exigirPanelPagina } from "@/lib/auth";
import { salir } from "@/lib/acciones";
import { supa } from "@/lib/archivos";
import { LOGO_GUNG_HO, URL_NUBE } from "@/lib/nube";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  await exigirPanelPagina();
  const local = !supa();
  return (
    <div className="p">
      <header className="p-top">
        <Link href="/" className="p-top__titulo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_GUNG_HO} alt="" />
          Panel
        </Link>
        <a href={URL_NUBE} target="_blank" rel="noreferrer" className="p-top__btn">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></svg>
          Ver la página
        </a>
        <form action={salir}>
          <button type="submit" className="p-top__btn">Salir</button>
        </form>
      </header>
      {local ? (
        <p className="p-aviso">
          Modo de prueba: las fotos se guardan en este PC (carpeta .datos, al lado de nube-app y nube-admin). Para publicar, conecta Supabase.
        </p>
      ) : null}
      <main className="p-main">{children}</main>
    </div>
  );
}
