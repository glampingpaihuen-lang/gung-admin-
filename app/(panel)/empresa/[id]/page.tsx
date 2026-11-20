import Link from "next/link";
import { notFound } from "next/navigation";
import { EmpresaForm } from "@/components/panel/EmpresaForm";
import { FotosPanel } from "@/components/panel/FotosPanel";
import { SubirFotos } from "@/components/panel/SubirFotos";
import { empresaPorId, fotosDe } from "@/lib/store";

export default async function EmpresaPanel({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const empresa = await empresaPorId(id);
  if (!empresa) notFound();
  const fotos = await fotosDe(empresa.id);

  return (
    <>
      <Link href="/" className="p-volver">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5.5 8 12l6.5 6.5" /></svg>
        Todas las empresas
      </Link>

      <section className="p-sec">
        <div className="p-sec__head">
          <div>
            <h1 className="p-h1">{empresa.nombre}</h1>
            <p className="p-nota">Sube las fotos y videos de esta empresa. En la página se ven en el mismo orden.</p>
          </div>
        </div>
        <SubirFotos empresaId={empresa.id} />
        <FotosPanel empresaId={empresa.id} fotos={fotos} />
      </section>

      <section className="p-sec">
        <div className="p-sec__head">
          <h2 className="p-h2">Datos de la empresa</h2>
        </div>
        <EmpresaForm empresa={empresa} total={fotos.length} />
      </section>
    </>
  );
}
