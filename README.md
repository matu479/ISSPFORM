# ISSP - Formulario de consultas

Aplicación Next.js con un formulario público y un panel para administrar
preguntas frecuentes en Firebase/Firestore.

## Arquitectura

```text
/admin -> Firestore -> /formulario
```

Firestore es la única fuente de preguntas y respuestas. El formulario usa una
suscripción en tiempo real, por lo que crear, editar, activar, desactivar o
eliminar una pregunta no requiere un nuevo deployment.

## Configuración local

1. Instalá dependencias:

```bash
npm install
```

2. Copiá `.env.example` como `.env.local` y completá las seis variables
   `NEXT_PUBLIC_FIREBASE_*`. Formspree es opcional.

3. Iniciá el proyecto:

```bash
npm run dev
```

- Formulario: http://localhost:3000/formulario
- Administración: http://localhost:3000/admin

## Habilitar el acceso administrativo

En Firebase Console:

1. Abrí **Authentication > Sign-in method**.
2. Habilitá **Correo electrónico/contraseña**.
3. En **Authentication > Users**, creá únicamente los usuarios administradores.
4. Copiá el UID de cada administrador y reemplazá `REEMPLAZAR_CON_UID_ADMIN` en `firestore.rules`.
5. Publicá las reglas.

Si usás Firebase CLI:

```bash
firebase login
firebase use TU_PROJECT_ID
firebase deploy --only firestore:rules
```

Las reglas permiten lectura pública de `preguntas-frecuentes` y reservan las
escrituras para los UID incluidos en `isAdmin()`. Para autorizar más de un
administrador, agregá sus UID separados por comas dentro de la lista.

## Variables en Vercel

Configurá estas variables tanto para **Production** como para **Preview** si
vas a desplegar ramas:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FORMSPREE_ENDPOINT=
```

## Modelo de las preguntas

Cada documento de la colección `preguntas-frecuentes` usa:

```ts
{
  proyecto: "NICE",
  etapa: "Admisión",
  pregunta: "¿Cuándo me corresponde presentarme?",
  respuesta: "...",
  orden: 1,
  activo: true,
  creado: Timestamp,
  actualizado: Timestamp
}
```

Los documentos anteriores con `area`, `numero` y `estado` continúan
leyéndose para facilitar la migración. Al editarlos desde `/admin`, se agregan
los campos del modelo nuevo.

## Importación

El panel acepta archivos delimitados por barra vertical, punto y coma o coma,
incluyendo campos entre comillas. El encabezado recomendado es:

```text
proyecto|etapa|orden|pregunta|respuesta|activo
```

También acepta el formato anterior
`numero|pregunta|respuesta|area`. Si faltan proyecto u orden, usa `NICE` y
calcula el orden dentro de la etapa. Las filas incompletas o duplicadas se
omiten.
