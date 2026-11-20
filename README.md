# nube-admin · panel de Gung Ho

Panel para instalar en el celular o el computador. Desde aquí se crean las empresas (nombre y logo),
se suben las fotos y videos (muchos a la vez), se ordenan o borran, y se cambia lo que se ve al entrar a la
página: logo de arriba, título, texto y fondo.

```bash
npm install
npm run dev   # http://localhost:3051 (código de prueba: 1234)
```

- Código para entrar: variable `CODIGO_PANEL` (se pide una vez por dispositivo; dura 60 días).
- `supabase/nube.sql`: tablas y carpeta de fotos para Supabase (pegar en SQL Editor → Run).
- Las fotos y videos se suben directo a Supabase en su archivo original (HD), así se descargan con la
  misma calidad. Aparte se hace una miniatura de 900 px para que la galería cargue rápido.
- Máximo 50 MB por archivo (límite del plan gratis de Supabase). Videos: MP4, MOV o WebM.
- Como se sube el original, la foto conserva sus datos (por ejemplo la ubicación, si el celular la guardó).

Variables: ver `.env.example`. Más detalles en el README de la carpeta de arriba.
