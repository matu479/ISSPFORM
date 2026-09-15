'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { getFirebaseServices } from '@/lib/firebase';
import {
  comparePreguntas,
  DEFAULT_PROJECTS,
  DEFAULT_STAGES,
  duplicateKey,
  FAQ_COLLECTION,
  normalizePregunta,
  UNASSIGNED_PROCESS,
  type EstadoRevision,
  type PreguntaFAQ,
} from '@/lib/faq';

type FormData = {
  proyectos: string[];
  etapas: string[];
  pregunta: string;
  respuesta: string;
  orden: number;
  activo: boolean;
  revision: EstadoRevision;
};

const EMPTY_FORM: FormData = {
  proyectos: ['NICE'],
  etapas: ['Admisión'],
  pregunta: '',
  respuesta: '',
  orden: 1,
  activo: false,
  revision: 'PENDIENTE',
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function detectDelimiter(header: string) {
  const candidates = ['|', ';', ','];
  return candidates.sort(
    (a, b) => header.split(b).length - header.split(a).length,
  )[0];
}

function parseDelimited(text: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      row.push(field.trim());
      field = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }

  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function normalizeHeader(value: string) {
  return value
    .replace(/^\uFEFF/, '')
    .trim()
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function canonicalHeader(value: string) {
  const normalized = normalizeHeader(value);

  if (normalized.includes('pregunta') || normalized.includes('consulta')) {
    return 'pregunta';
  }
  if (normalized.includes('respuesta')) return 'respuesta';
  if (normalized.includes('proceso') || normalized.includes('proyecto')) {
    return 'proyecto';
  }
  if (
    normalized.includes('etapa') ||
    normalized.includes('area') ||
    normalized.includes('seccion')
  ) {
    return 'etapa';
  }
  if (normalized.includes('revision') || normalized.includes('estado')) {
    return 'estado';
  }
  if (['n', 'n°', 'nº', 'nro', 'numero'].includes(normalized)) {
    return 'numero';
  }
  if (normalized === 'orden') return 'orden';

  return normalized;
}

function detectReviewMarker(value: string): EstadoRevision | '' {
  if (
    /\[(?:A\s+REVISAR|PENDIENTE|REVISAR|FALTA\s+REVISAR|NO\s+REVISADA?)\]/i.test(
      value,
    )
  ) {
    return 'PENDIENTE';
  }
  if (/\[REVISADA?\]/i.test(value)) return 'REVISADA';
  return '';
}

function stripReviewMarkers(value: string) {
  return value
    .replace(
      /\s*\[(?:REVISADA?|A\s+REVISAR|PENDIENTE|REVISAR|FALTA\s+REVISAR|NO\s+REVISADA?)\]\s*/gi,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();
}

function processFromHeading(value: string) {
  const normalized = normalizeHeader(value);
  return (
    DEFAULT_PROJECTS.find((project) =>
      normalized.includes(normalizeHeader(project)),
    ) || ''
  );
}

function parseParagraphFaqs(paragraphs: string[]) {
  const rows: string[][] = [
    ['proyecto', 'numero', 'pregunta', 'respuesta', 'revision'],
  ];
  let currentProcess = UNASSIGNED_PROCESS;
  let pendingNumber = '';
  let currentNumber = '';
  let currentQuestion = '';
  let answerParts: string[] = [];

  const flush = () => {
    const rawAnswer = answerParts.join('\n').trim();
    const question = stripReviewMarkers(currentQuestion);
    const answer = stripReviewMarkers(rawAnswer);
    const revision =
      detectReviewMarker(currentQuestion) ||
      detectReviewMarker(rawAnswer) ||
      'PENDIENTE';

    if (question && answer) {
      rows.push([
        currentProcess,
        currentNumber,
        question,
        answer,
        revision,
      ]);
    }
    currentNumber = '';
    currentQuestion = '';
    answerParts = [];
  };

  for (const rawParagraph of paragraphs) {
    for (const rawLine of rawParagraph.split(/\n+/)) {
      const line = rawLine.replace(/^[•·▪◦]\s*/, '').trim();
      if (!line) continue;

      const standaloneNumber = line.match(
        /^(?:n(?:ro|°|º)?\.?\s*)?(\d+)[).:\-]*$/i,
      );
      if (standaloneNumber) {
        flush();
        pendingNumber = standaloneNumber[1];
        continue;
      }

      const headingProcess = processFromHeading(line);
      const letters = line.replace(/[^a-záéíóúüñ]/gi, '');
      const looksLikeHeading =
        line.length <= 120 &&
        letters.length >= 3 &&
        line === line.toLocaleUpperCase('es') &&
        !line.includes('?');

      if (looksLikeHeading) {
        flush();
        if (headingProcess) currentProcess = headingProcess;
        continue;
      }

      const inlinePair = line.match(
        /^(?:(\d+)[).:-]?\s*)?(?:pregunta|consulta)(?:\s+\d+)?\s*[:.-]\s*(.+?)\s+(?:respuesta)(?:\s+(?:modelo|automatica|sugerida))?\s*[:.-]\s*(.+)$/i,
      );
      if (inlinePair) {
        flush();
        const revision =
          detectReviewMarker(inlinePair[2]) ||
          detectReviewMarker(inlinePair[3]) ||
          'PENDIENTE';
        rows.push([
          currentProcess,
          inlinePair[1] || pendingNumber,
          stripReviewMarkers(inlinePair[2]),
          stripReviewMarkers(inlinePair[3]),
          revision,
        ]);
        pendingNumber = '';
        continue;
      }

      const questionLabel = line.match(
        /^(?:(\d+)[).:-]?\s*)?(?:pregunta|consulta)(?:\s+\d+)?\s*[:.-]\s*(.+)$/i,
      );
      if (questionLabel) {
        flush();
        currentNumber = questionLabel[1] || pendingNumber;
        pendingNumber = '';
        currentQuestion = questionLabel[2].trim();
        continue;
      }

      const answerLabel = line.match(
        /^(?:respuesta)(?:\s+(?:modelo|automatica|sugerida))?\s*[:.-]\s*(.*)$/i,
      );
      if (answerLabel && currentQuestion) {
        if (answerLabel[1]) answerParts.push(answerLabel[1].trim());
        continue;
      }

      if (
        /^(pregunta|consulta|respuesta(?:\s+(?:modelo|automatica|sugerida))?)\s*:?$/i.test(
          line,
        )
      ) {
        continue;
      }

      const numberedLine = line.match(/^(\d+)[).:\-]*\s+(.+)$/);
      const withoutNumber = (numberedLine?.[2] || line).trim();
      const cleanCandidate = stripReviewMarkers(withoutNumber);
      const looksLikeQuestion =
        cleanCandidate.startsWith('¿') ||
        (cleanCandidate.endsWith('?') && cleanCandidate.length <= 500);

      if (looksLikeQuestion) {
        flush();
        currentNumber = numberedLine?.[1] || pendingNumber;
        pendingNumber = '';
        currentQuestion = withoutNumber;
      } else if (currentQuestion) {
        answerParts.push(line);
      }
    }
  }

  flush();
  return rows;
}

export default function AdminFAQ() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [startupError, setStartupError] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);

  const [preguntas, setPreguntas] = useState<PreguntaFAQ[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataError, setDataError] = useState('');
  const [notice, setNotice] = useState('');

  const [filtroProyecto, setFiltroProyecto] = useState('');
  const [filtroEtapa, setFiltroEtapa] = useState('');
  const [filtroRevision, setFiltroRevision] = useState('');
  const [busqueda, setBusqueda] = useState('');

  const [modo, setModo] = useState<'list' | 'nuevo' | 'editar'>('list');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const { auth } = getFirebaseServices();
      return onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        setAuthLoading(false);
      });
    } catch (error) {
      setStartupError(getErrorMessage(error));
      setAuthLoading(false);
      return undefined;
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setPreguntas([]);
      return undefined;
    }

    setLoading(true);
    setDataError('');

    try {
      const { db } = getFirebaseServices();
      return onSnapshot(
        collection(db, FAQ_COLLECTION),
        (snapshot) => {
          const data = snapshot.docs
            .map((item) =>
              normalizePregunta(
                item.id,
                item.data() as Record<string, unknown>,
              ),
            )
            .filter((item): item is PreguntaFAQ => item !== null)
            .sort(comparePreguntas);

          setPreguntas(data);
          setLoading(false);
        },
        (error) => {
          setDataError(getErrorMessage(error));
          setLoading(false);
        },
      );
    } catch (error) {
      setDataError(getErrorMessage(error));
      setLoading(false);
      return undefined;
    }
  }, [user]);

  const proyectos = useMemo(
    () =>
      [...new Set([...DEFAULT_PROJECTS, ...preguntas.flatMap((p) => p.proyectos)])]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, 'es')),
    [preguntas],
  );

  const etapas = useMemo(
    () =>
      [...new Set([...DEFAULT_STAGES, ...preguntas.flatMap((p) => p.etapas)])]
        .filter(Boolean)
        .sort((a, b) => {
          const aIndex = DEFAULT_STAGES.indexOf(a);
          const bIndex = DEFAULT_STAGES.indexOf(b);
          if (aIndex >= 0 && bIndex >= 0) return aIndex - bIndex;
          if (aIndex >= 0) return -1;
          if (bIndex >= 0) return 1;
          return a.localeCompare(b, 'es');
        }),
    [preguntas],
  );

  const preguntasFiltradas = useMemo(() => {
    const term = busqueda.trim().toLocaleLowerCase('es');

    return preguntas.filter((pregunta) => {
      const matchesProject =
        !filtroProyecto || pregunta.proyectos.includes(filtroProyecto);
      const matchesStage = !filtroEtapa || pregunta.etapas.includes(filtroEtapa);
      const matchesRevision =
        !filtroRevision || pregunta.revision === filtroRevision;
      const matchesSearch =
        !term ||
        pregunta.pregunta.toLocaleLowerCase('es').includes(term) ||
        pregunta.respuesta.toLocaleLowerCase('es').includes(term);

      return matchesProject && matchesStage && matchesRevision && matchesSearch;
    });
  }, [
    busqueda,
    filtroEtapa,
    filtroProyecto,
    filtroRevision,
    preguntas,
  ]);

  function nextOrder(proyecto: string, etapa: string) {
    return (
      Math.max(
        0,
        ...preguntas
          .filter(
            (item) =>
              item.proyectos.includes(proyecto) &&
              item.etapas.includes(etapa),
          )
          .map((item) => item.orden),
      ) + 1
    );
  }

  function startCreate() {
    const proyecto = filtroProyecto || 'NICE';
    const etapa = filtroEtapa || 'Admisión';
    setFormData({
      ...EMPTY_FORM,
      proyectos: [proyecto],
      etapas: [etapa],
      orden: nextOrder(proyecto, etapa),
    });
    setNotice('');
    setModo('nuevo');
  }

  function startEdit(pregunta: PreguntaFAQ) {
    setFormData({
      proyectos: [...pregunta.proyectos],
      etapas: [...pregunta.etapas],
      pregunta: pregunta.pregunta,
      respuesta: pregunta.respuesta,
      orden: pregunta.orden,
      activo: pregunta.activo,
      revision: pregunta.revision,
    });
    setEditandoId(pregunta.id);
    setNotice('');
    setModo('editar');
  }

  function toggleFormValue(
    field: 'proyectos' | 'etapas',
    value: string,
  ) {
    setFormData((previous) => {
      const current = previous[field];
      const next = current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value];

      return {
        ...previous,
        [field]: next,
        activo:
          field === 'proyectos' && next.length === 0
            ? false
            : previous.activo,
      };
    });
  }

  function cancelEdit() {
    setModo('list');
    setEditandoId(null);
    setFormData(EMPTY_FORM);
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginBusy(true);
    setLoginError('');

    try {
      const { auth } = getFirebaseServices();
      await signInWithEmailAndPassword(
        auth,
        loginEmail.trim(),
        loginPassword,
      );
      setLoginPassword('');
    } catch {
      setLoginError('No se pudo iniciar sesión. Revisá el correo y la contraseña.');
    } finally {
      setLoginBusy(false);
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const proyectosSeleccionados = [...new Set(formData.proyectos)]
      .map((item) => item.trim())
      .filter(Boolean);
    const etapasSeleccionadas = [...new Set(formData.etapas)]
      .map((item) => item.trim())
      .filter(Boolean);
    const hasAssignedProject = proyectosSeleccionados.some(
      (item) => item !== UNASSIGNED_PROCESS,
    );

    const cleanData = {
      proyectos: proyectosSeleccionados,
      etapas: etapasSeleccionadas,
      // Se conservan los campos escalares para reglas y documentos anteriores.
      proyecto: proyectosSeleccionados[0] || UNASSIGNED_PROCESS,
      etapa: etapasSeleccionadas[0] || 'Sin etapa',
      pregunta: formData.pregunta.trim(),
      respuesta: formData.respuesta.trim(),
      orden: Number(formData.orden),
      activo: hasAssignedProject ? formData.activo : false,
      revision: formData.revision,
    };

    if (
      cleanData.proyectos.length === 0 ||
      cleanData.etapas.length === 0 ||
      !cleanData.pregunta ||
      !cleanData.respuesta ||
      !Number.isFinite(cleanData.orden) ||
      cleanData.orden < 0
    ) {
      setNotice(
        'Seleccioná al menos un proyecto y una etapa, y completá los demás campos.',
      );
      return;
    }

    const duplicate = preguntas.find(
      (item) =>
        item.id !== editandoId &&
        duplicateKey(item.proyectos, item.etapas, item.pregunta) ===
          duplicateKey(
            cleanData.proyectos,
            cleanData.etapas,
            cleanData.pregunta,
          ),
    );

    if (duplicate) {
      setNotice(
        'Ya existe esa pregunta con la misma combinación de proyectos y etapas.',
      );
      return;
    }

    setSaving(true);
    setNotice('');

    try {
      const { db } = getFirebaseServices();

      if (modo === 'editar' && editandoId) {
        await updateDoc(doc(db, FAQ_COLLECTION, editandoId), {
          ...cleanData,
          actualizado: serverTimestamp(),
        });
        setNotice('Pregunta actualizada.');
      } else {
        await addDoc(collection(db, FAQ_COLLECTION), {
          ...cleanData,
          creado: serverTimestamp(),
          actualizado: serverTimestamp(),
        });
        setNotice('Pregunta creada.');
      }

      cancelEdit();
    } catch (error) {
      setNotice(`No se pudo guardar: ${getErrorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(pregunta: PreguntaFAQ) {
    if (!confirm(`¿Eliminar “${pregunta.pregunta}”? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      const { db } = getFirebaseServices();
      await deleteDoc(doc(db, FAQ_COLLECTION, pregunta.id));
      setNotice('Pregunta eliminada.');
    } catch (error) {
      setNotice(`No se pudo eliminar: ${getErrorMessage(error)}`);
    }
  }

  async function handleDeleteAll() {
    if (!preguntas.length) return;

    const confirmation = prompt(
      `Se eliminarán las ${preguntas.length} preguntas. Escribí BORRAR para confirmar.`,
    );
    if (confirmation !== 'BORRAR') return;

    setSaving(true);
    setNotice('');

    try {
      const { db } = getFirebaseServices();

      for (let index = 0; index < preguntas.length; index += 400) {
        const batch = writeBatch(db);
        for (const pregunta of preguntas.slice(index, index + 400)) {
          batch.delete(doc(db, FAQ_COLLECTION, pregunta.id));
        }
        await batch.commit();
      }

      setNotice(
        'Se eliminaron todas las preguntas. Ya podés volver a importar el Word.',
      );
    } catch (error) {
      setNotice(`No se pudieron eliminar: ${getErrorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleEnableAllForTest() {
    const eligible = preguntas.filter(
      (pregunta) =>
        pregunta.proyectos.some(
          (proyecto) => proyecto !== UNASSIGNED_PROCESS,
        ),
    );
    const skipped = preguntas.length - eligible.length;

    if (!eligible.length) {
      setNotice(
        'Primero asigná un proceso a las preguntas que querés probar.',
      );
      return;
    }

    const confirmed = confirm(
      `Se harán visibles ${eligible.length} preguntas con proceso asignado. ${skipped ? `${skipped} pregunta(s) “Sin asignar” seguirán ocultas. ` : ''}¿Continuar?`,
    );
    if (!confirmed) return;

    setSaving(true);
    setNotice('');

    try {
      const { db } = getFirebaseServices();

      for (let index = 0; index < eligible.length; index += 400) {
        const batch = writeBatch(db);
        for (const pregunta of eligible.slice(index, index + 400)) {
          batch.update(doc(db, FAQ_COLLECTION, pregunta.id), {
            activo: true,
            actualizado: serverTimestamp(),
          });
        }
        await batch.commit();
      }

      setNotice(
        `${eligible.length} pregunta(s) habilitada(s) para la prueba sin modificar su estado de revisión.${skipped ? ` ${skipped} quedaron ocultas porque todavía no tienen proceso.` : ''}`,
      );
    } catch (error) {
      setNotice(`No se pudieron habilitar: ${getErrorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleEndTest() {
    const pendingVisible = preguntas.filter(
      (pregunta) =>
        pregunta.revision === 'PENDIENTE' && pregunta.activo,
    );

    if (!pendingVisible.length) {
      setNotice('No hay preguntas pendientes visibles por la prueba.');
      return;
    }

    const confirmed = confirm(
      `Se volverán a ocultar ${pendingVisible.length} preguntas pendientes. Las preguntas revisadas conservarán su visibilidad. ¿Continuar?`,
    );
    if (!confirmed) return;

    setSaving(true);
    setNotice('');

    try {
      const { db } = getFirebaseServices();

      for (let index = 0; index < pendingVisible.length; index += 400) {
        const batch = writeBatch(db);
        for (const pregunta of pendingVisible.slice(index, index + 400)) {
          batch.update(doc(db, FAQ_COLLECTION, pregunta.id), {
            activo: false,
            actualizado: serverTimestamp(),
          });
        }
        await batch.commit();
      }

      setNotice(
        `${pendingVisible.length} pregunta(s) pendiente(s) volvieron a quedar ocultas.`,
      );
    } catch (error) {
      setNotice(`No se pudo finalizar la prueba: ${getErrorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleRandomAssignment() {
    if (!preguntas.length) return;

    const confirmed = confirm(
      `Se asignarán aleatoriamente ${preguntas.length} preguntas a uno o más proyectos y a una sola etapa. La revisión y la visibilidad no cambiarán. ¿Continuar?`,
    );
    if (!confirmed) return;

    setSaving(true);
    setNotice('');

    try {
      const { db } = getFirebaseServices();

      for (let index = 0; index < preguntas.length; index += 400) {
        const batch = writeBatch(db);

        for (const pregunta of preguntas.slice(index, index + 400)) {
          const shuffledProjects = [...DEFAULT_PROJECTS].sort(
            () => Math.random() - 0.5,
          );
          const projectCount = Math.random() < 0.35 ? 2 : 1;
          const assignedProjects = shuffledProjects.slice(0, projectCount);
          const assignedStage =
            DEFAULT_STAGES[
              Math.floor(Math.random() * DEFAULT_STAGES.length)
            ];

          batch.update(doc(db, FAQ_COLLECTION, pregunta.id), {
            proyectos: assignedProjects,
            etapas: [assignedStage],
            proyecto: assignedProjects[0],
            etapa: assignedStage,
            actualizado: serverTimestamp(),
          });
        }

        await batch.commit();
      }

      setNotice(
        `${preguntas.length} pregunta(s) asignada(s) aleatoriamente. Cada una tiene una sola etapa y uno o dos proyectos.`,
      );
    } catch (error) {
      setNotice(
        `No se pudo completar la asignación: ${getErrorMessage(error)}`,
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleQuickUpdate(
    pregunta: PreguntaFAQ,
    changes: Partial<Pick<PreguntaFAQ, 'revision' | 'activo'>>,
  ) {
    setNotice('');

    try {
      const { db } = getFirebaseServices();
      await updateDoc(doc(db, FAQ_COLLECTION, pregunta.id), {
        ...changes,
        actualizado: serverTimestamp(),
      });
    } catch (error) {
      setNotice(`No se pudo actualizar: ${getErrorMessage(error)}`);
    }
  }

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    setSaving(true);
    setNotice('');

    try {
      let tables: string[][][];

      if (file.name.toLocaleLowerCase('es').endsWith('.docx')) {
        if (file.size > 8_000_000) {
          throw new Error('El Word supera el límite de 8 MB.');
        }

        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch('/api/import-docx', {
          method: 'POST',
          body: formData,
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || 'No se pudo leer el Word.');
        }

        const paragraphRows = Array.isArray(payload.paragraphs)
          ? payload.paragraphs
              .map((paragraph: string) => paragraph.split('\t'))
              .filter((row: string[]) => row.some(Boolean))
          : [];
        const paragraphFaqs = Array.isArray(payload.paragraphs)
          ? parseParagraphFaqs(payload.paragraphs)
          : [];

        tables = [
          ...(Array.isArray(payload.tables) ? payload.tables : []),
          paragraphRows,
          paragraphFaqs,
        ].filter((rows) => rows.length > 1);
      } else {
        if (file.size > 1_000_000) {
          throw new Error('El archivo supera el límite de 1 MB.');
        }

        const text = await file.text();
        const firstLine = text.split(/\r?\n/, 1)[0];
        tables = [parseDelimited(text, detectDelimiter(firstLine))];
      }

      const parsedTables = tables
        .map((rows) => {
          const headerIndex = rows.findIndex((row) => {
            const normalized = row.map(canonicalHeader);
            return (
              normalized.includes('pregunta') &&
              normalized.includes('respuesta')
            );
          });

          if (headerIndex < 0) return null;

          return {
            headers: rows[headerIndex].map(canonicalHeader),
            rows: rows.slice(headerIndex + 1),
          };
        })
        .filter(
          (
            table,
          ): table is { headers: string[]; rows: string[][] } =>
            table !== null,
        );

      if (parsedTables.length === 0) {
        throw new Error(
          'No pude reconocer pares de Pregunta y Respuesta en el Word.',
        );
      }

      const existingKeys = new Set(
        preguntas.map((item) =>
          duplicateKey(item.proyectos, item.etapas, item.pregunta),
        ),
      );
      const groupMaximums = new Map<string, number>();

      for (const item of preguntas) {
        const group = duplicateKey(item.proyectos, item.etapas, '');
        groupMaximums.set(
          group,
          Math.max(groupMaximums.get(group) ?? 0, item.orden),
        );
      }

      const records: Omit<PreguntaFAQ, 'id'>[] = [];
      let skipped = 0;

      for (const table of parsedTables) {
        for (const row of table.rows) {
          const values = Object.fromEntries(
            table.headers.map((header, index) => [
              header,
              row[index]?.trim() ?? '',
            ]),
          );
          const proyecto =
            values.proyecto ||
            values.proceso ||
            UNASSIGNED_PROCESS;
          const etapa =
            values.etapa ||
            values.area ||
            values.seccion ||
            'Sin etapa';
          const rawPregunta = values.pregunta;
          const rawRespuesta = values.respuesta;
          const markerRevision =
            detectReviewMarker(rawPregunta) ||
            detectReviewMarker(rawRespuesta);
          const pregunta = stripReviewMarkers(rawPregunta);
          const respuesta = stripReviewMarkers(rawRespuesta);

          if (!pregunta || !respuesta) {
            skipped += 1;
            continue;
          }

          const key = duplicateKey(proyecto, etapa, pregunta);
          if (existingKeys.has(key)) {
            skipped += 1;
            continue;
          }

          const group = duplicateKey(proyecto, etapa, '');
          const suppliedOrder = Number(
            values.orden ||
            values.numero ||
            values['n°'] ||
            values['nº'] ||
            values.nro,
          );
          const orden =
            Number.isFinite(suppliedOrder) && suppliedOrder >= 0
              ? suppliedOrder
              : (groupMaximums.get(group) ?? 0) + 1;
          groupMaximums.set(
            group,
            Math.max(groupMaximums.get(group) ?? 0, orden),
          );

          const rawStatus = (
            values.revision ||
            values.estado ||
            values.revisada ||
            markerRevision ||
            ''
          ).toLocaleLowerCase('es');
          const explicitlyPending =
            rawStatus.includes('pend') ||
            rawStatus.includes('falta') ||
            rawStatus.includes('no revis');
          const revision: EstadoRevision =
            !explicitlyPending &&
            (rawStatus.includes('revisad') ||
              rawStatus.includes('aprobad') ||
              ['si', 'sí', 'true', '1'].includes(rawStatus))
              ? 'REVISADA'
              : 'PENDIENTE';

          const inactiveValues = [
            'false',
            '0',
            'no',
            'inactiva',
            'inactivo',
          ];
          const explicitActive = values.activo
            ? !inactiveValues.includes(
                values.activo.toLocaleLowerCase('es'),
              )
            : true;
          const activo =
            explicitActive &&
            revision === 'REVISADA' &&
            proyecto !== UNASSIGNED_PROCESS;

          records.push({
            proyectos: [proyecto],
            etapas: [etapa],
            proyecto,
            etapa,
            pregunta,
            respuesta,
            orden,
            activo,
            revision,
          });
          existingKeys.add(key);
        }
      }

      const { db } = getFirebaseServices();
      for (let index = 0; index < records.length; index += 400) {
        const batch = writeBatch(db);
        for (const record of records.slice(index, index + 400)) {
          batch.set(doc(collection(db, FAQ_COLLECTION)), {
            ...record,
            creado: serverTimestamp(),
            actualizado: serverTimestamp(),
          });
        }
        await batch.commit();
      }

      setNotice(
        `${records.length} pregunta(s) importada(s). ${skipped} fila(s) omitida(s) por estar incompletas o duplicadas.`,
      );
    } catch (error) {
      setNotice(`No se pudo importar: ${getErrorMessage(error)}`);
    } finally {
      setSaving(false);
      input.value = '';
    }
  }

  if (authLoading) {
    return <main style={styles.center}>Verificando acceso…</main>;
  }

  if (startupError) {
    return (
      <main style={styles.center}>
        <div style={styles.errorCard}>
          <h1>Configuración incompleta</h1>
          <p>{startupError}</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main style={styles.center}>
        <form onSubmit={handleLogin} style={styles.loginCard}>
          <img
            src="/logo-horizontal.webp"
            alt="ISSP"
            style={{ width: '220px', maxWidth: '100%', marginBottom: 20 }}
          />
          <h1 style={{ marginTop: 0 }}>Acceso administrativo</h1>
          <p style={{ color: '#64748b' }}>
            Ingresá con el usuario administrador configurado en Firebase.
          </p>
          <label htmlFor="email">Correo electrónico</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={loginEmail}
            onChange={(event) => setLoginEmail(event.target.value)}
            required
          />
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={loginPassword}
            onChange={(event) => setLoginPassword(event.target.value)}
            required
          />
          {loginError && <div style={styles.alert}>{loginError}</div>}
          <button type="submit" style={styles.primaryButton} disabled={loginBusy}>
            {loginBusy ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={{ margin: 0 }}>Preguntas frecuentes</h1>
          <p style={{ color: '#64748b', marginBottom: 0 }}>
            {preguntas.length} preguntas guardadas en Firestore
          </p>
        </div>
        <button
          type="button"
          style={styles.secondaryButton}
          onClick={() => signOut(getFirebaseServices().auth)}
        >
          Cerrar sesión
        </button>
      </header>

      {notice && <div style={styles.notice}>{notice}</div>}
      {dataError && <div style={styles.alert}>{dataError}</div>}

      {modo === 'list' ? (
        <>
          <section style={styles.toolbar}>
            <button type="button" style={styles.primaryButton} onClick={startCreate}>
              + Nueva pregunta
            </button>
            <input
              type="search"
              placeholder="Buscar pregunta o respuesta…"
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              style={{ flex: '1 1 260px', margin: 0 }}
            />
            <select
              value={filtroProyecto}
              onChange={(event) => setFiltroProyecto(event.target.value)}
              style={{ flex: '0 1 180px', margin: 0 }}
            >
              <option value="">Todos los proyectos</option>
              {proyectos.map((proyecto) => (
                <option key={proyecto} value={proyecto}>
                  {proyecto}
                </option>
              ))}
            </select>
            <select
              value={filtroEtapa}
              onChange={(event) => setFiltroEtapa(event.target.value)}
              style={{ flex: '0 1 220px', margin: 0 }}
            >
              <option value="">Todas las etapas</option>
              {etapas.map((etapa) => (
                <option key={etapa} value={etapa}>
                  {etapa}
                </option>
              ))}
            </select>
            <select
              value={filtroRevision}
              onChange={(event) => setFiltroRevision(event.target.value)}
              style={{ flex: '0 1 190px', margin: 0 }}
            >
              <option value="">Todos los estados</option>
              <option value="PENDIENTE">Pendientes de revisión</option>
              <option value="REVISADA">Revisadas</option>
            </select>
            <button
              type="button"
              onClick={handleRandomAssignment}
              disabled={saving || preguntas.length === 0}
              title="Asigna uno o dos proyectos y una sola etapa a cada pregunta"
              style={{
                ...styles.randomButton,
                opacity: saving || preguntas.length === 0 ? 0.55 : 1,
              }}
            >
              Asignar aleatoriamente
            </button>
            <button
              type="button"
              onClick={handleEnableAllForTest}
              disabled={saving || preguntas.length === 0}
              title="Marca como revisadas y visibles todas las preguntas con proceso asignado"
              style={{
                ...styles.testButton,
                opacity: saving || preguntas.length === 0 ? 0.55 : 1,
              }}
            >
              Habilitar todas para prueba
            </button>
            <button
              type="button"
              onClick={handleEndTest}
              disabled={
                saving ||
                !preguntas.some(
                  (pregunta) =>
                    pregunta.revision === 'PENDIENTE' && pregunta.activo,
                )
              }
              title="Oculta las preguntas pendientes habilitadas durante la prueba"
              style={{
                ...styles.secondaryButton,
                margin: 0,
                opacity:
                  saving ||
                  !preguntas.some(
                    (pregunta) =>
                      pregunta.revision === 'PENDIENTE' && pregunta.activo,
                  )
                    ? 0.55
                    : 1,
              }}
            >
              Finalizar prueba
            </button>
            <label style={styles.importButton}>
              {saving ? 'Procesando…' : 'Importar Word/CSV'}
              <input
                type="file"
                accept=".docx,.csv,.txt,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/csv,text/plain"
                disabled={saving}
                onChange={handleImport}
                style={{ display: 'none' }}
              />
            </label>
            <button
              type="button"
              onClick={handleDeleteAll}
              disabled={saving || preguntas.length === 0}
              style={{
                ...styles.deleteButton,
                padding: '12px 16px',
                opacity: saving || preguntas.length === 0 ? 0.55 : 1,
              }}
            >
              Vaciar preguntas
            </button>
          </section>

          <p style={{ color: '#64748b' }}>
            {preguntasFiltradas.length} resultado(s). Podés subir el Word original
            o un archivo con las columnas Pregunta y Respuesta. Las preguntas sin
            proceso quedan como “Sin asignar” y pendientes de revisión.
          </p>

          {loading ? (
            <p style={{ textAlign: 'center', padding: 40 }}>Cargando…</p>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Proyectos</th>
                    <th style={styles.th}>Procesos / etapas · N.º</th>
                    <th style={styles.th}>Pregunta y respuesta</th>
                    <th style={styles.th}>Revisión</th>
                    <th style={styles.th}>Visibilidad</th>
                    <th style={styles.th}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {preguntasFiltradas.map((pregunta) => (
                    <tr key={pregunta.id}>
                      <td style={styles.td}>
                        <div style={styles.tagList}>
                          {pregunta.proyectos.map((proyecto) => (
                            <span key={proyecto} style={styles.projectTag}>
                              {proyecto}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={styles.td}>
                        <div style={styles.tagList}>
                          {pregunta.etapas.map((etapa) => (
                            <span key={etapa} style={styles.stageTag}>
                              {etapa}
                            </span>
                          ))}
                        </div>
                        <small>N.º {pregunta.orden}</small>
                      </td>
                      <td style={styles.td}>
                        <strong>{pregunta.pregunta}</strong>
                        <p style={styles.preview}>{pregunta.respuesta}</p>
                      </td>
                      <td style={styles.td}>
                        <select
                          aria-label={`Revisión de ${pregunta.pregunta}`}
                          value={pregunta.revision}
                          onChange={(event) => {
                            const revision =
                              event.target.value as EstadoRevision;
                            handleQuickUpdate(pregunta, {
                              revision,
                              activo:
                                revision === 'REVISADA' &&
                                pregunta.proyectos.some(
                                  (proyecto) =>
                                    proyecto !== UNASSIGNED_PROCESS,
                                ),
                            });
                          }}
                          style={{ minWidth: 150, margin: 0 }}
                        >
                          <option value="PENDIENTE">Falta revisar</option>
                          <option value="REVISADA">Revisada</option>
                        </select>
                      </td>
                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.badge,
                            background: pregunta.activo ? '#dcfce7' : '#fee2e2',
                            color: pregunta.activo ? '#166534' : '#991b1b',
                          }}
                        >
                          {pregunta.activo ? 'Visible' : 'Oculta'}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            style={styles.editButton}
                            onClick={() => startEdit(pregunta)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            style={styles.deleteButton}
                            onClick={() => handleDelete(pregunta)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!preguntasFiltradas.length && !loading && (
                    <tr>
                      <td colSpan={6} style={{ ...styles.td, textAlign: 'center' }}>
                        No hay preguntas para mostrar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <form onSubmit={handleSave} style={styles.editor}>
          <h2 style={{ marginTop: 0 }}>
            {modo === 'nuevo' ? 'Nueva pregunta' : 'Editar pregunta'}
          </h2>

          <div style={styles.grid}>
            <fieldset style={styles.multiSelect}>
              <legend>Proyectos</legend>
              <p style={styles.fieldHelp}>
                Podés seleccionar uno o más proyectos.
              </p>
              <div style={styles.checkGrid}>
                {proyectos
                  .filter((proyecto) => proyecto !== UNASSIGNED_PROCESS)
                  .map((proyecto) => (
                    <label key={proyecto} style={styles.checkOption}>
                      <input
                        type="checkbox"
                        checked={formData.proyectos.includes(proyecto)}
                        onChange={() =>
                          toggleFormValue('proyectos', proyecto)
                        }
                        style={styles.checkInput}
                      />
                      <span>{proyecto}</span>
                    </label>
                  ))}
              </div>
            </fieldset>
            <fieldset style={styles.multiSelect}>
              <legend>Procesos / etapas</legend>
              <p style={styles.fieldHelp}>
                Podés seleccionar una o más etapas.
              </p>
              <div style={styles.checkGrid}>
                {etapas.map((etapa) => (
                  <label key={etapa} style={styles.checkOption}>
                    <input
                      type="checkbox"
                      checked={formData.etapas.includes(etapa)}
                      onChange={() => toggleFormValue('etapas', etapa)}
                      style={styles.checkInput}
                    />
                    <span>{etapa}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div>
              <label htmlFor="orden">N.º de pregunta</label>
              <input
                id="orden"
                type="number"
                min="0"
                step="1"
                value={formData.orden}
                onChange={(event) =>
                  setFormData({
                    ...formData,
                    orden: Number(event.target.value),
                  })
                }
                required
              />
            </div>
            <div>
              <label htmlFor="revision">Estado de revisión</label>
              <select
                id="revision"
                value={formData.revision}
                onChange={(event) => {
                  const revision = event.target.value as EstadoRevision;
                  setFormData({
                    ...formData,
                    revision,
                    activo:
                      revision === 'REVISADA' &&
                      formData.proyectos.some(
                        (proyecto) => proyecto !== UNASSIGNED_PROCESS,
                      ),
                  });
                }}
              >
                <option value="PENDIENTE">Falta revisar</option>
                <option value="REVISADA">Revisada</option>
              </select>
            </div>
            <div>
              <label htmlFor="activo">Visibilidad</label>
              <select
                id="activo"
                value={String(formData.activo)}
                disabled={
                  formData.proyectos.length === 0
                }
                onChange={(event) =>
                  setFormData({
                    ...formData,
                    activo: event.target.value === 'true',
                  })
                }
              >
                <option value="true">Activa: visible en el formulario</option>
                <option value="false">Inactiva: oculta en el formulario</option>
              </select>
            </div>
          </div>

          <label htmlFor="pregunta">Pregunta</label>
          <input
            id="pregunta"
            value={formData.pregunta}
            onChange={(event) =>
              setFormData({ ...formData, pregunta: event.target.value })
            }
            maxLength={500}
            required
          />

          <label htmlFor="respuesta">Respuesta automática</label>
          <textarea
            id="respuesta"
            value={formData.respuesta}
            onChange={(event) =>
              setFormData({ ...formData, respuesta: event.target.value })
            }
            maxLength={5000}
            rows={8}
            required
          />

          {notice && <div style={styles.notice}>{notice}</div>}

          <div style={{ display: 'flex', gap: 12 }}>
            <button type="submit" style={styles.primaryButton} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            <button type="button" style={styles.secondaryButton} onClick={cancelEdit}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 1400,
    minHeight: '100vh',
    margin: '0 auto',
    padding: '32px 20px',
    fontFamily: 'system-ui, sans-serif',
  },
  center: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    padding: 20,
    fontFamily: 'system-ui, sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 20,
    marginBottom: 24,
  },
  loginCard: {
    width: 'min(440px, 100%)',
    padding: 32,
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    boxShadow: '0 10px 30px rgba(15, 23, 42, .08)',
  },
  errorCard: {
    width: 'min(640px, 100%)',
    padding: 32,
    background: '#fff',
    border: '1px solid #fecaca',
    borderRadius: 12,
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    padding: 16,
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 10,
  },
  primaryButton: {
    minHeight: 46,
    padding: '10px 18px',
    background: '#003d7a',
    color: '#fff',
    border: 0,
    borderRadius: 7,
    cursor: 'pointer',
    fontWeight: 700,
  },
  secondaryButton: {
    minHeight: 46,
    padding: '10px 18px',
    background: '#fff',
    color: '#003d7a',
    border: '1px solid #003d7a',
    borderRadius: 7,
    cursor: 'pointer',
    fontWeight: 700,
  },
  randomButton: {
    minHeight: 46,
    padding: '10px 18px',
    background: '#0f766e',
    color: '#fff',
    border: 0,
    borderRadius: 7,
    cursor: 'pointer',
    fontWeight: 700,
  },
  testButton: {
    minHeight: 46,
    padding: '10px 18px',
    background: '#7c3aed',
    color: '#fff',
    border: 0,
    borderRadius: 7,
    cursor: 'pointer',
    fontWeight: 700,
  },
  importButton: {
    minHeight: 46,
    display: 'inline-flex',
    alignItems: 'center',
    padding: '10px 18px',
    margin: 0,
    background: '#047857',
    color: '#fff',
    borderRadius: 7,
    cursor: 'pointer',
    fontWeight: 700,
  },
  tableWrap: {
    overflowX: 'auto',
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 10,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: 900,
  },
  th: {
    padding: 12,
    textAlign: 'left',
    background: '#f1f5f9',
    borderBottom: '1px solid #cbd5e1',
  },
  td: {
    padding: 12,
    verticalAlign: 'top',
    borderBottom: '1px solid #e2e8f0',
  },
  preview: {
    maxWidth: 620,
    margin: '6px 0 0',
    color: '#64748b',
    fontSize: 13,
    lineHeight: 1.4,
  },
  badge: {
    display: 'inline-block',
    padding: '4px 8px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
  },
  editButton: {
    padding: '7px 10px',
    background: '#d97706',
    color: '#fff',
    border: 0,
    borderRadius: 5,
    cursor: 'pointer',
  },
  deleteButton: {
    padding: '7px 10px',
    background: '#dc2626',
    color: '#fff',
    border: 0,
    borderRadius: 5,
    cursor: 'pointer',
  },
  multiSelect: {
    minWidth: 0,
    padding: 16,
    margin: 0,
    background: '#f8fafc',
    border: '1px solid #cbd5e1',
    borderRadius: 9,
  },
  fieldHelp: {
    margin: '2px 0 12px',
    color: '#64748b',
    fontSize: 13,
  },
  checkGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: 8,
  },
  checkOption: {
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    minHeight: 42,
    padding: '8px 10px',
    margin: 0,
    background: '#fff',
    border: '1px solid #dbe3ec',
    borderRadius: 7,
    cursor: 'pointer',
    fontWeight: 600,
  },
  checkInput: {
    width: 18,
    height: 18,
    minHeight: 0,
    padding: 0,
    margin: 0,
    accentColor: '#003d7a',
  },
  tagList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  projectTag: {
    display: 'inline-block',
    padding: '4px 8px',
    color: '#1e3a8a',
    background: '#dbeafe',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
  },
  stageTag: {
    display: 'inline-block',
    padding: '4px 8px',
    color: '#065f46',
    background: '#d1fae5',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
  },
  editor: {
    maxWidth: 900,
    padding: 24,
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 10,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
    gap: 16,
  },
  notice: {
    marginBottom: 18,
    padding: 12,
    background: '#eff6ff',
    color: '#1e3a8a',
    border: '1px solid #bfdbfe',
    borderRadius: 7,
  },
  alert: {
    marginBottom: 18,
    padding: 12,
    background: '#fef2f2',
    color: '#991b1b',
    border: '1px solid #fecaca',
    borderRadius: 7,
  },
};
