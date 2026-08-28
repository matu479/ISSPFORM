# ISSP - Formulario de consultas

Starter en Next.js para desplegar en Vercel.

## Incluye

- Selector de proyecto: NICE / Policía / Bomberos.
- Datos del aspirante.
- Etapas del proceso.
- Preguntas específicas por etapa.
- Consulta libre.
- Validación de correo repetido.
- Generación de número de ticket.
- Respuestas automáticas para preguntas frecuentes.
- Envío opcional a Formspree.
- Diseño responsive para celular.

## 1. Ejecutar localmente

```bash
npm install
npm run dev
```

Abrir:

```text
http://localhost:3000
```

## 2. Conectar Formspree

1. Crear un formulario en Formspree.
2. Copiar el endpoint, por ejemplo:

```text
https://formspree.io/f/xxxxxxxx
```

3. Crear un archivo `.env.local` en la raíz:

```env
NEXT_PUBLIC_FORMSPREE_ENDPOINT=https://formspree.io/f/xxxxxxxx
```

Si la variable no está configurada, la interfaz igualmente funciona en modo demo, pero no envía datos a Formspree.

## 3. Subir a GitHub

Crear un repositorio nuevo y subir estos archivos.

## 4. Deploy en Vercel

1. New Project.
2. Importar el repo de GitHub.
3. Agregar la variable de entorno:

```text
NEXT_PUBLIC_FORMSPREE_ENDPOINT
```

4. Deploy.

## Personalización

Las etapas y preguntas están en:

```text
app/page.js
```

Buscar:

```js
const STAGES = [...]
const FAQS = {...}
const AUTO_ANSWERS = {...}
```

Ahí se pueden modificar todas las opciones y respuestas sin tocar el resto del formulario.
