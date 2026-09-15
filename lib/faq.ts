export const FAQ_COLLECTION = 'preguntas-frecuentes';

export const UNASSIGNED_PROCESS = 'Sin asignar';

export const DEFAULT_PROJECTS = ['NICE', 'Policía', 'Bomberos'];

export const DEFAULT_STAGES = [
  'Admisión',
  'Requisitos',
  'Psicología 1ª instancia',
  'Psicología 2ª instancia',
  'Laboratorio',
  'Médico',
  'Odontológico',
  'Atlético',
  'Funcional',
  'Socioambiental',
  'Entrevista',
  'Documentación',
  'Examen Intelectual',
  'Cierre',
];

export const PROCESS_TIMELINE = [
  {
    day: 1,
    stages: [
      { value: 'Admisión', label: 'Admisión' },
      { value: 'Requisitos', label: 'Requisitos' },
      {
        value: 'Psicología 1ª instancia',
        label: 'Psicológico primera instancia',
      },
    ],
  },
  {
    day: 2,
    stages: [
      {
        value: 'Psicología 2ª instancia',
        label: 'Psicológico segunda instancia',
      },
    ],
  },
  {
    day: 3,
    stages: [{ value: 'Laboratorio', label: 'Laboratorio' }],
  },
  {
    day: 4,
    stages: [
      { value: 'Médico', label: 'Evaluación médica' },
      { value: 'Odontológico', label: 'Evaluación odontológica' },
      { value: 'Atlético', label: 'Evaluación atlética' },
      { value: 'Funcional', label: 'Funcional' },
    ],
  },
  {
    day: 5,
    stages: [
      {
        value: 'Socioambiental',
        label: 'Evaluación socioambiental',
      },
    ],
  },
  {
    day: 6,
    stages: [
      {
        value: 'Entrevista',
        label: 'Entrevista administrativa',
      },
    ],
  },
  {
    day: 7,
    stages: [
      {
        value: 'Examen Intelectual',
        label: 'Examen intelectual',
      },
    ],
  },
  {
    day: 8,
    stages: [{ value: 'Documentación', label: 'Documentación' }],
  },
  {
    day: 9,
    stages: [
      {
        value: 'Cierre',
        label: 'Firma de vacante, nómina y publicación en listas oficiales',
      },
    ],
  },
] as const;

export type EstadoRevision = 'PENDIENTE' | 'REVISADA';

export interface PreguntaFAQ {
  id: string;
  proyectos: string[];
  etapas: string[];
  proyecto: string;
  etapa: string;
  pregunta: string;
  respuesta: string;
  orden: number;
  activo: boolean;
  revision: EstadoRevision;
}

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];

  return [...new Set(value.map(cleanString).filter(Boolean))];
}

export function normalizePregunta(
  id: string,
  raw: Record<string, unknown>,
): PreguntaFAQ | null {
  const legacyProject =
    cleanString(raw.proyecto) ||
    cleanString(raw.proceso) ||
    UNASSIGNED_PROCESS;
  const legacyStage =
    cleanString(raw.etapa) ||
    cleanString(raw.area) ||
    'Sin etapa';
  const proyectos = cleanStringArray(raw.proyectos);
  const etapas = cleanStringArray(raw.etapas);

  const normalizedProjects = proyectos.length
    ? proyectos
    : [legacyProject];
  const normalizedStages = etapas.length
    ? etapas
    : [legacyStage];

  const pregunta = cleanString(raw.pregunta);
  const respuesta = cleanString(raw.respuesta);
  const parsedOrder = Number(raw.orden ?? raw.numero ?? 0);
  const orden = Number.isFinite(parsedOrder) ? parsedOrder : 0;
  const legacyStatus = cleanString(raw.estado).toUpperCase();
  const rawRevision = cleanString(raw.revision).toUpperCase();
  const revision: EstadoRevision =
    rawRevision === 'REVISADA' ||
    legacyStatus === 'REVISADA' ||
    legacyStatus === 'REVISADO'
      ? 'REVISADA'
      : 'PENDIENTE';
  const activo =
    typeof raw.activo === 'boolean'
      ? raw.activo
      : revision === 'REVISADA';

  if (!pregunta || !respuesta) return null;

  return {
    id,
    proyectos: normalizedProjects,
    etapas: normalizedStages,
    proyecto: normalizedProjects[0],
    etapa: normalizedStages[0],
    pregunta,
    respuesta,
    orden,
    activo,
    revision,
  };
}

export function comparePreguntas(a: PreguntaFAQ, b: PreguntaFAQ) {
  return (
    a.proyectos.join('|').localeCompare(b.proyectos.join('|'), 'es') ||
    a.etapas.join('|').localeCompare(b.etapas.join('|'), 'es') ||
    a.orden - b.orden ||
    a.pregunta.localeCompare(b.pregunta, 'es')
  );
}

function keyPart(value: string | string[]) {
  return (Array.isArray(value) ? value : [value])
    .map((item) => item.trim().toLocaleLowerCase('es'))
    .sort()
    .join(',');
}

export function duplicateKey(
  proyectos: string | string[],
  etapas: string | string[],
  pregunta: string,
) {
  return [keyPart(proyectos), keyPart(etapas), keyPart(pregunta)].join('|');
}
