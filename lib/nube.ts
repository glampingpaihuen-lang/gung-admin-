/** Dirección de la página pública (nube-app). En el PC: http://localhost:3050 */
export const URL_NUBE = (process.env.NEXT_PUBLIC_URL_NUBE?.trim() || "http://localhost:3050").replace(/\/+$/, "");

/** Logo de Gung Ho que viene con el panel (public/gung ho logo.jpeg) */
export const LOGO_GUNG_HO = "/gung%20ho%20logo.jpeg";
