import { AjustesForm } from "@/components/panel/AjustesForm";
import { ListaEmpresas, NuevaEmpresa } from "@/components/panel/Empresas";
import { leerAjustes, listarEmpresas } from "@/lib/store";

export default async function Panel() {
  const [empresas, ajustes] = await Promise.all([listarEmpresas(false), leerAjustes()]);
  const fotos = empresas.reduce((s, e) => s + e.total, 0);
  return (
    <>
      <section className="p-sec">
        <div className="p-sec__head">
          <div>
            <h1 className="p-h1">Empresas e instituciones</h1>
            <p className="p-nota">
              {empresas.length
                ? `${empresas.length === 1 ? "1 empresa" : `${empresas.length} empresas`} con ${fotos === 1 ? "1 archivo" : `${fotos.toLocaleString("es-CO")} archivos`} (fotos y videos) en total. Abre una para subirle fotos.`
                : "Crea la primera: ponle el nombre y el logo, y después le subes las fotos y videos."}
            </p>
          </div>
          <NuevaEmpresa abiertaAlInicio={!empresas.length} />
        </div>
        {empresas.length ? <ListaEmpresas empresas={empresas} /> : null}
      </section>

      <section className="p-sec">
        <div className="p-sec__head">
          <div>
            <h2 className="p-h2">Página principal</h2>
            <p className="p-nota">Lo que se ve al entrar a la página: logo, título, texto y fondo.</p>
          </div>
        </div>
        <AjustesForm ajustes={ajustes} />
      </section>
    </>
  );
}
