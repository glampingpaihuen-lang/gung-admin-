import "server-only";
import { DeleteObjectsCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Cloudflare R2: aquí quedan las fotos y videos (10 GB gratis, sin cobro por descargas y sin el
 * límite de 50 MB de Supabase gratis). Se activa con estas variables:
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET y R2_PUBLIC_URL (https://pub-xxxx.r2.dev)
 * Los archivos de R2 se guardan con nombres que empiezan por "r2/", así los que ya estaban en
 * Supabase siguen funcionando.
 */
export const CACHE = "public, max-age=31536000, immutable";

const env = (k: string) => process.env[k]?.trim() || "";

export function r2Activo(): boolean {
  return !!(env("R2_ACCOUNT_ID") && env("R2_ACCESS_KEY_ID") && env("R2_SECRET_ACCESS_KEY") && env("R2_BUCKET") && env("R2_PUBLIC_URL"));
}

let cliente: S3Client | undefined;
function r2(): S3Client {
  if (!r2Activo()) throw new Error("Falta configurar Cloudflare R2 (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET y R2_PUBLIC_URL).");
  cliente ??= new S3Client({
    region: "auto",
    endpoint: `https://${env("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env("R2_ACCESS_KEY_ID"), secretAccessKey: env("R2_SECRET_ACCESS_KEY") },
    // R2 no usa las sumas de verificación nuevas del SDK; sin esto fallan las subidas desde el navegador
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    // Solo para probar en el PC con un servidor parecido a R2
    ...(env("R2_ENDPOINT") ? { endpoint: env("R2_ENDPOINT"), forcePathStyle: true } : {}),
  });
  return cliente;
}

const bucket = () => env("R2_BUCKET");
const codificar = (p: string) => p.split("/").map(encodeURIComponent).join("/");

export const r2Url = (key: string) => `${env("R2_PUBLIC_URL").replace(/\/+$/, "")}/${codificar(key)}`;

/** «attachment»: al abrir el enlace se descarga con su nombre (en las etiquetas img/video se ve normal) */
export function comoDescarga(nombre: string) {
  const ascii = nombre.normalize("NFD").replace(/[^\x20-\x7e]/g, "").replace(/["\\]/g, "") || "archivo";
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nombre)}`;
}

/** Permiso para que el navegador suba el archivo directo a R2 (vale 2 horas). Hay que mandar estos encabezados tal cual. */
export async function r2Firmar(key: string, tipo: string, disposicion?: string) {
  const headers: Record<string, string> = { "content-type": tipo, "cache-control": CACHE };
  if (disposicion) headers["content-disposition"] = disposicion;
  const url = await getSignedUrl(
    r2(),
    new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: tipo, CacheControl: CACHE, ContentDisposition: disposicion }),
    { expiresIn: 7200 },
  );
  return { url, headers };
}

export async function r2Subir(key: string, bytes: Buffer, tipo: string) {
  await r2().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: bytes, ContentType: tipo, CacheControl: CACHE }));
}

export async function r2Existe(key: string): Promise<boolean> {
  try {
    await r2().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return true;
  } catch {
    return false;
  }
}

export async function r2Borrar(keys: string[]) {
  for (let i = 0; i < keys.length; i += 1000) {
    await r2().send(new DeleteObjectsCommand({
      Bucket: bucket(),
      Delete: { Objects: keys.slice(i, i + 1000).map(Key => ({ Key })), Quiet: true },
    }));
  }
}
