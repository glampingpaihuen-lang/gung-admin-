import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Revisión rápida: sin la cookie de sesión, a la pantalla del código.
 * (La revisión de verdad, que la sesión sea válida, se hace en cada página y acción.)
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.get("nube_panel")?.value) {
    return NextResponse.redirect(new URL("/entrar", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // No revisa: la entrada, archivos de Next, fotos de prueba, íconos, el manifest para instalar y archivos públicos
  matcher: ["/((?!entrar|_next/|api/|icons/|manifest.webmanifest|favicon.ico|.*\\.(?:png|jpe?g|webp|svg|ico)$).*)"],
};
