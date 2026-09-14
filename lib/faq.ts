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
  'Socioambiental',
  'Entrevista',
  'Documentación',
  'Examen Intelectual',
  'Entrevista Final',
  'Cierre',
];

export type EstadoRevision = 'PENDIENTE' | 'REVISADA';

export interface PreguntaFAQ {
  id: string;
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

export function normalizePregunta(
  id: string,
  raw: Record<string, unknown>,
): PreguntaFAQ | null {
  const proyecto =
    cleanString(raw.proyecto) ||
    cleanString(raw.proceso) ||
    UNASSIGNED_PROCESS;
  const etapa =
    cleanString(raw.etapa) ||
    cleanString(raw.area) ||
    'Sin etapa';
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
    proyecto,
    etapa,
    pregunta,
    respuesta,
    orden,
    activo,
    revision,
  };
}

export function comparePreguntas(a: PreguntaFAQ, b: PreguntaFAQ) {
  return (
    a.proyecto.localeCompare(b.proyecto, 'es') ||
    a.etapa.localeCompare(b.etapa, 'es') ||
    a.orden - b.orden ||
    a.pregunta.localeCompare(b.pregunta, 'es')
  );
}

export function duplicateKey(
  proyecto: string,
  etapa: string,
  pregunta: string,
) {
  return [proyecto, etapa, pregunta]
    .map((value) => value.trim().toLocaleLowerCase('es'))
    .join('|');
}
