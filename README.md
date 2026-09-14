# ISSP - Formulario de consultas

Aplicación Next.js con un formulario público y un panel para administrar
preguntas frecuentes en Firebase/Firestore.

## Arquitectura

```text
/admin -> Firestore -> /formulario
```

Firestore es la única fuente de preguntas y respuestas. El formulario usa una
suscripción en tiempo real, por lo que los cambios no requieren un nuevo
deployment.

## Configuración local

1. Ejecutá `npm install`.
2. Copiá `.env.example` como `.env.local` y completá las variables
   `NEXT_PUBLIC_FIREBASE_*`.
3. Ejecutá `npm run dev`.

- Formulario: http://localhost:3000/formulario
- Administración: http://localhost:3000/admin

## Habilitar el acceso administrativo

En Firebase Console:

1. Abrí **Authentication > Sign-in method**.
2. Habilitá **Correo electrónico/contraseña**.
3. En **Authentication > Users**, creá únicamente los usuarios administradores.
4. Copiá el UID de cada administrador y reemplazá
   `REEMPLAZAR_CON_UID_ADMIN` en `firestore.rules`.
5. Publicá las reglas.

Si usás Firebase CLI:

```bash
firebase login
firebase use TU_PROJECT_ID
firebase deploy --only firestore:rules
```

Las reglas permiten lectura pública de `preguntas-frecuentes` y reservan las
escrituras para los UID incluidos en `isAdmin()`.

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
  proyecto: "NICE", // proceso al que pertenece
  etapa: "Admisión",
  pregunta: "¿Cuándo me corresponde presentarme?",
  respuesta: "...",
  orden: 1,
  revision: "REVISADA", // o "PENDIENTE"
  activo: true,
  creado: Timestamp,
  actualizado: Timestamp
}
```

El campo `orden` es la posición de la pregunta dentro del mismo proceso y
etapa. El formulario público solo muestra preguntas activas, revisadas y con un
proceso asignado. Los documentos anteriores con `area`, `numero` y
`estado` continúan leyéndose para facilitar la migración.

## Importación del Word

El panel acepta directamente archivos `.docx` de hasta 8 MB. Reconoce tablas,
columnas separadas por tabulaciones y bloques de texto donde cada pregunta está
seguida por su respuesta. También interpreta encabezados como pregunta/consulta,
respuesta modelo, proceso/proyecto, etapa/área/sección, número/orden y
estado/revisión.

Si el Word solo contiene pregunta y respuesta, cada fila se importa como:

- proceso: `Sin asignar`;
- etapa: `Sin etapa`;
- revisión: `PENDIENTE`;
- visibilidad: oculta.

Después de importar, el administrador puede filtrar las preguntas y asignar el
proceso y el estado de revisión directamente desde la tabla. Al marcar una
pregunta como revisada con un proceso asignado, queda visible en el formulario.

También se aceptan archivos CSV o TXT delimitados por barra vertical, punto y
coma o coma. Un encabezado completo posible es:

```text
proceso|etapa|orden|pregunta|respuesta|revision|activo
```

Las filas incompletas o duplicadas se omiten. Para cambios posteriores a la
carga inicial se puede crear, editar o eliminar cada pregunta manualmente.
