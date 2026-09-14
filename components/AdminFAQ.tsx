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
  proyecto: string;
  etapa: string;
  pregunta: string;
  respuesta: string;
  orden: number;
  activo: boolean;
  revision: EstadoRevision;
};

const EMPTY_FORM: FormData = {
  proyecto: 'NICE',
  etapa: 'Admisión',
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
    /\[(?:PENDIENTE|REVISAR|FALTA\s+REVISAR|NO\s+REVISADA?)\]/i.test(value)
  ) {
    return 'PENDIENTE';
  }
  if (/\[REVISADA?\]/i.test(value)) return 'REVISADA';
  return '';
}

function stripReviewMarkers(value: string) {
  return value
    .replace(
      /\s*\[(?:REVISADA?|PENDIENTE|REVISAR|FALTA\s+REVISAR|NO\s+REVISADA?)\]\s*/gi,
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
    ['proyecto', 'pregunta', 'respuesta', 'revision'],
  ];
  let currentProcess = UNASSIGNED_PROCESS;
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
      rows.push([currentProcess, question, answer, revision]);
    }
    currentQuestion = '';
    answerParts = [];
  };

  for (const rawParagraph of paragraphs) {
    for (const rawLine of rawParagraph.split(/\n+/)) {
      const line = rawLine.replace(/^[•·▪◦]\s*/, '').trim();
      if (!line) continue;

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
        /^(?:pregunta|consulta)(?:\s+\d+)?\s*[:.-]\s*(.+?)\s+(?:respuesta)(?:\s+(?:modelo|automatica|sugerida))?\s*[:.-]\s*(.+)$/i,
      );
      if (inlinePair) {
        flush();
        const revision =
          detectReviewMarker(inlinePair[1]) ||
          detectReviewMarker(inlinePair[2]) ||
          'PENDIENTE';
        rows.push([
          currentProcess,
          stripReviewMarkers(inlinePair[1]),
          stripReviewMarkers(inlinePair[2]),
          revision,
        ]);
        continue;
      }

      const questionLabel = line.match(
        /^(?:\d+[).:-]?\s*)?(?:pregunta|consulta)(?:\s+\d+)?\s*[:.-]\s*(.+)$/i,
      );
      if (questionLabel) {
        flush();
        currentQuestion = questionLabel[1].trim();
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

      const withoutNumber = line.replace(/^\d+[).:-]?\s*/, '').trim();
      const cleanCandidate = stripReviewMarkers(withoutNumber);
      const looksLikeQuestion =
        cleanCandidate.startsWith('¿') ||
        (cleanCandidate.endsWith('?') && cleanCandidate.length <= 500);

      if (looksLikeQuestion) {
        flush();
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
      [...new Set([...DEFAULT_PROJECTS, ...preguntas.map((p) => p.proyecto)])]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, 'es')),
    [preguntas],
  );

  const etapas = useMemo(
    () =>
      [...new Set([...DEFAULT_STAGES, ...preguntas.map((p) => p.etapa)])]
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
        !filtroProyecto || pregunta.proyecto === filtroProyecto;
      const matchesStage = !filtroEtapa || pregunta.etapa === filtroEtapa;
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
          .filter((item) => item.proyecto === proyecto && item.etapa === etapa)
          .map((item) => item.orden),
      ) + 1
    );
  }

  function startCreate() {
    const proyecto = filtroProyecto || 'NICE';
    const etapa = filtroEtapa || 'Admisión';
    setFormData({
      ...EMPTY_FORM,
      proyecto,
      etapa,
      orden: nextOrder(proyecto, etapa),
    });
    setNotice('');
    setModo('nuevo');
  }

  function startEdit(pregunta: PreguntaFAQ) {
    setFormData({
      proyecto: pregunta.proyecto,
      etapa: pregunta.etapa,
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
    const cleanData = {
      proyecto: formData.proyecto.trim(),
      etapa: formData.etapa.trim(),
      pregunta: formData.pregunta.trim(),
      respuesta: formData.respuesta.trim(),
      orden: Number(formData.orden),
      activo:
        formData.revision === 'REVISADA' &&
        formData.proyecto.trim() !== UNASSIGNED_PROCESS
          ? formData.activo
          : false,
      revision: formData.revision,
    };

    if (
      !cleanData.proyecto ||
      !cleanData.etapa ||
      !cleanData.pregunta ||
      !cleanData.respuesta ||
      !Number.isFinite(cleanData.orden) ||
      cleanData.orden < 0
    ) {
      setNotice('Completá todos los campos y usá un orden válido.');
      return;
    }

    const duplicate = preguntas.find(
      (item) =>
        item.id !== editandoId &&
        duplicateKey(item.proyecto, item.etapa, item.pregunta) ===
          duplicateKey(
            cleanData.proyecto,
            cleanData.etapa,
            cleanData.pregunta,
          ),
    );

    if (duplicate) {
      setNotice('Ya existe esa pregunta para el mismo proceso y etapa.');
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

  async function handleQuickUpdate(
    pregunta: PreguntaFAQ,
    changes: Partial<Pick<PreguntaFAQ, 'proyecto' | 'revision' | 'activo'>>,
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
          duplicateKey(item.proyecto, item.etapa, item.pregunta),
        ),
      );
      const groupMaximums = new Map<string, number>();

      for (const item of preguntas) {
        const group = duplicateKey(item.proyecto, item.etapa, '');
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
              <option value="">Todos los procesos</option>
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
                    <th style={styles.th}>Proceso</th>
                    <th style={styles.th}>Etapa / orden</th>
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
                        <select
                          aria-label={`Proceso de ${pregunta.pregunta}`}
                          value={pregunta.proyecto}
                          onChange={(event) => {
                            const proyecto = event.target.value;
                            handleQuickUpdate(pregunta, {
                              proyecto,
                              activo:
                                proyecto === UNASSIGNED_PROCESS
                                  ? false
                                  : pregunta.revision === 'REVISADA',
                            });
                          }}
                          style={{ minWidth: 150, margin: 0 }}
                        >
                          {[UNASSIGNED_PROCESS, ...proyectos]
                            .filter(
                              (value, index, items) =>
                                items.indexOf(value) === index,
                            )
                            .map((proyecto) => (
                              <option key={proyecto} value={proyecto}>
                                {proyecto}
                              </option>
                            ))}
                        </select>
                      </td>
                      <td style={styles.td}>
                        {pregunta.etapa}
                        <br />
                        <small>Orden {pregunta.orden}</small>
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
                                pregunta.proyecto !== UNASSIGNED_PROCESS,
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
            <div>
              <label htmlFor="proyecto">Proceso</label>
              <input
                id="proyecto"
                list="project-options"
                value={formData.proyecto}
                onChange={(event) => {
                  const proyecto = event.target.value;
                  setFormData({
                    ...formData,
                    proyecto,
                    activo:
                      proyecto === UNASSIGNED_PROCESS
                        ? false
                        : formData.activo,
                  });
                }}
                required
              />
              <datalist id="project-options">
                {proyectos.map((proyecto) => (
                  <option key={proyecto} value={proyecto} />
                ))}
              </datalist>
            </div>
            <div>
              <label htmlFor="etapa">Etapa</label>
              <input
                id="etapa"
                list="stage-options"
                value={formData.etapa}
                onChange={(event) =>
                  setFormData({ ...formData, etapa: event.target.value })
                }
                required
              />
              <datalist id="stage-options">
                {etapas.map((etapa) => (
                  <option key={etapa} value={etapa} />
                ))}
              </datalist>
            </div>
            <div>
              <label htmlFor="orden">Orden</label>
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
                      formData.proyecto !== UNASSIGNED_PROCESS,
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
                  formData.revision !== 'REVISADA' ||
                  formData.proyecto === UNASSIGNED_PROCESS
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
