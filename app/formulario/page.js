"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { getFirebaseServices } from "@/lib/firebase";
import {
  comparePreguntas,
  DEFAULT_PROJECTS,
  DEFAULT_STAGES,
  FAQ_COLLECTION,
  normalizePregunta
} from "@/lib/faq";

const ALL_PROJECTS = "__todos__";
const RESULT_LIMIT = 24;

function makeTicket() {
  const now = new Date();
  const year = now.getFullYear();
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `SI-${year}-${rand}`;
}

function normalizeSearch(value) {
  return String(value || "")
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();
}

function stageComparator(a, b) {
  const aIndex = DEFAULT_STAGES.indexOf(a);
  const bIndex = DEFAULT_STAGES.indexOf(b);

  if (aIndex >= 0 && bIndex >= 0) return aIndex - bIndex;
  if (aIndex >= 0) return -1;
  if (bIndex >= 0) return 1;
  return a.localeCompare(b, "es");
}

function getSearchScore(item, tokens, normalizedQuery) {
  if (!tokens.length) return 1;

  const question = normalizeSearch(item.pregunta);
  const answer = normalizeSearch(item.respuesta);
  const context = normalizeSearch(`${item.proyecto} ${item.etapa}`);
  const allText = `${question} ${answer} ${context}`;

  if (!tokens.every((token) => allText.includes(token))) return -1;

  let score = 0;
  if (question === normalizedQuery) score += 100;
  if (question.startsWith(normalizedQuery)) score += 40;
  if (question.includes(normalizedQuery)) score += 25;

  for (const token of tokens) {
    if (question.includes(token)) score += 8;
    if (context.includes(token)) score += 3;
    if (answer.includes(token)) score += 1;
  }

  return score;
}

export default function Home() {
  const [faqs, setFaqs] = useState([]);
  const [loadingFaqs, setLoadingFaqs] = useState(true);
  const [faqError, setFaqError] = useState("");
  const [project, setProject] = useState("NICE");
  const [stage, setStage] = useState("");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedQuestionId, setSelectedQuestionId] = useState("");
  const [supportQuestionId, setSupportQuestionId] = useState("");
  const [supportOpen, setSupportOpen] = useState(false);
  const supportRef = useRef(null);

  const [form, setForm] = useState({
    name: "",
    dni: "",
    email: "",
    email2: "",
    phone: ""
  });
  const [customQuery, setCustomQuery] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const { db } = getFirebaseServices();
      return onSnapshot(
        collection(db, FAQ_COLLECTION),
        (snapshot) => {
          const data = snapshot.docs
            .map((item) => normalizePregunta(item.id, item.data()))
            .filter(Boolean)
            .sort(comparePreguntas);

          setFaqs(data);
          setFaqError("");
          setLoadingFaqs(false);
        },
        () => {
          setFaqError(
            "No pudimos cargar las preguntas en este momento. Podés enviarnos tu consulta."
          );
          setLoadingFaqs(false);
        }
      );
    } catch {
      setFaqError(
        "El buscador de preguntas no está disponible. Podés enviarnos tu consulta."
      );
      setLoadingFaqs(false);
      return undefined;
    }
  }, []);

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === "Escape") setSelectedQuestionId("");
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  const publicFaqs = useMemo(
    () =>
      faqs.filter(
        (item) =>
          item.activo &&
          item.proyecto !== "Sin asignar"
      ),
    [faqs]
  );

  const projects = useMemo(
    () =>
      [...new Set([...DEFAULT_PROJECTS, ...publicFaqs.map((item) => item.proyecto)])]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "es")),
    [publicFaqs]
  );

  const stages = useMemo(() => {
    const candidates = publicFaqs
      .filter((item) => project === ALL_PROJECTS || item.proyecto === project)
      .map((item) => item.etapa);

    return [...new Set(candidates)].filter(Boolean).sort(stageComparator);
  }, [publicFaqs, project]);

  const filteredFaqs = useMemo(() => {
    const normalizedQuery = normalizeSearch(search);
    const tokens = normalizedQuery.split(/\s+/).filter(Boolean);

    return publicFaqs
      .filter(
        (item) =>
          (project === ALL_PROJECTS || item.proyecto === project) &&
          (!stage || item.etapa === stage)
      )
      .map((item) => ({
        item,
        score: getSearchScore(item, tokens, normalizedQuery)
      }))
      .filter(({ score }) => score >= 0)
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.item.orden - b.item.orden ||
          a.item.pregunta.localeCompare(b.item.pregunta, "es")
      )
      .slice(0, RESULT_LIMIT)
      .map(({ item }) => item);
  }, [project, publicFaqs, search, stage]);

  const selectedQuestion = useMemo(
    () => publicFaqs.find((item) => item.id === selectedQuestionId) || null,
    [publicFaqs, selectedQuestionId]
  );

  const supportQuestion = useMemo(
    () => publicFaqs.find((item) => item.id === supportQuestionId) || null,
    [publicFaqs, supportQuestionId]
  );

  useEffect(() => {
    if (stage && !stages.includes(stage)) setStage("");
  }, [stage, stages]);

  function chooseProject(value) {
    setProject(value);
    setStage("");
    setSelectedQuestionId("");
    setResult(null);
    setError("");
  }

  function updateField(key, value) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  function openSupport(question = selectedQuestion) {
    setSupportQuestionId(question?.id || "");
    setSelectedQuestionId("");
    setSupportOpen(true);
    setResult(null);
    setError("");
    if (question) {
      setCustomQuery(`Consulté “${question.pregunta}”, pero todavía necesito saber: `);
    }
    window.setTimeout(
      () => supportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      50
    );
  }

  async function submit(event) {
    event.preventDefault();
    setError("");

    if (
      !form.name.trim() ||
      !form.dni.trim() ||
      !form.email.trim() ||
      !form.email2.trim() ||
      !form.phone.trim()
    ) {
      setError("Completá todos los datos personales.");
      return;
    }

    if (form.email.trim().toLowerCase() !== form.email2.trim().toLowerCase()) {
      setError("Los correos electrónicos no coinciden.");
      return;
    }

    if (!customQuery.trim()) {
      setError("Escribí brevemente qué necesitás consultar.");
      return;
    }

    const ticket = makeTicket();
    const payload = {
      ticket,
      proyecto:
        supportQuestion?.proyecto ||
        (project === ALL_PROJECTS ? "Sin definir" : project),
      nombre: form.name.trim(),
      dni: form.dni.trim(),
      email: form.email.trim(),
      telefono: form.phone.trim(),
      etapa: supportQuestion?.etapa || stage || "Sin etapa",
      consulta: customQuery.trim(),
      preguntaId: supportQuestion?.id || null,
      preguntaOrigen: supportQuestion?.pregunta || null
    };

    setSending(true);

    try {
      const endpoint = process.env.NEXT_PUBLIC_FORMSPREE_ENDPOINT;

      if (endpoint) {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json"
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error("No se pudo registrar la consulta.");
      }

      setResult({ ticket });
    } catch {
      setError("No pudimos registrar la consulta. Intentá nuevamente en unos minutos.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="faq-page">
      <header className="faq-hero">
        <img src="/logo-horizontal.webp" alt="ISSP" className="faq-logo" />
        <div>
          <h1>¿En qué podemos ayudarte?</h1>
          <p>Encontrá una respuesta rápida sobre tu proceso de selección e ingreso.</p>
        </div>
      </header>

      <div className="faq-shell">
        <section className="faq-search-card" aria-labelledby="faq-search-title">
          <div className="faq-project-row">
            <div>
              <label htmlFor="faq-project">Proceso</label>
              <p className="faq-field-help">Elegí uno o buscá en todos si no estás seguro.</p>
            </div>
            <select
              id="faq-project"
              value={project}
              onChange={(event) => chooseProject(event.target.value)}
            >
              {projects.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
              <option value={ALL_PROJECTS}>No estoy seguro / buscar en todos</option>
            </select>
          </div>

          <div className="faq-search-block">
            <label id="faq-search-title" htmlFor="faq-search">
              Escribí tu duda o algunas palabras
            </label>
            <div className="faq-search-input-wrap">
              <span aria-hidden="true" className="faq-search-icon">⌕</span>
              <input
                id="faq-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Ej.: inscripción, documentación, examen médico…"
                autoComplete="off"
              />
              {search && (
                <button type="button" className="faq-clear" onClick={() => setSearch("")}>
                  Limpiar
                </button>
              )}
            </div>
          </div>

          <button
            type="button"
            className="faq-filter-toggle"
            aria-expanded={showFilters}
            onClick={() => setShowFilters((value) => !value)}
          >
            {showFilters ? "Ocultar filtros" : "Filtrar por etapa (opcional)"}
            <span aria-hidden="true">{showFilters ? "▲" : "▼"}</span>
          </button>

          {showFilters && (
            <div className="faq-filter-panel">
              <label htmlFor="faq-stage">Etapa del proceso</label>
              <select
                id="faq-stage"
                value={stage}
                onChange={(event) => setStage(event.target.value)}
              >
                <option value="">Todas las etapas</option>
                {stages.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
          )}
        </section>

        <section className="faq-results" aria-live="polite">
          <div className="faq-results-heading">
            <div>
              <h2>{search ? "Resultados de búsqueda" : "Preguntas frecuentes"}</h2>
              {!loadingFaqs && (
                <p>
                  {filteredFaqs.length
                    ? `${filteredFaqs.length} pregunta${filteredFaqs.length === 1 ? "" : "s"} para consultar`
                    : "No encontramos una pregunta relacionada"}
                </p>
              )}
            </div>
          </div>

          {loadingFaqs ? (
            <div className="faq-status">Cargando preguntas…</div>
          ) : faqError ? (
            <div className="faq-error">{faqError}</div>
          ) : filteredFaqs.length ? (
            <div className="faq-question-list">
              {filteredFaqs.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className="faq-question"
                  onClick={() => setSelectedQuestionId(item.id)}
                >
                  <span className="faq-question-number">N.º {item.orden}</span>
                  <span className="faq-question-copy">
                    <strong>{item.pregunta}</strong>
                    <small>{item.proyecto} · {item.etapa}</small>
                  </span>
                  <span className="faq-chevron" aria-hidden="true">›</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="faq-empty">
              <strong>Probá con menos palabras o con otro término.</strong>
              <p>También podés buscar en todos los procesos o enviarnos tu consulta.</p>
            </div>
          )}

          <button type="button" className="faq-support-link" onClick={() => openSupport(null)}>
            No encuentro mi respuesta
          </button>
        </section>

        {supportOpen && (
          <section className="faq-contact-card" ref={supportRef}>
            <div className="faq-contact-heading">
              <div>
                <span className="faq-eyebrow">Consulta personalizada</span>
                <h2>Contanos qué necesitás</h2>
                <p>Completá tus datos únicamente si no encontraste la respuesta.</p>
              </div>
              <button
                type="button"
                className="faq-close-inline"
                onClick={() => setSupportOpen(false)}
              >
                Cerrar
              </button>
            </div>

            {!result ? (
              <form onSubmit={submit}>
                <label htmlFor="faq-query">Tu consulta</label>
                <textarea
                  id="faq-query"
                  value={customQuery}
                  onChange={(event) => setCustomQuery(event.target.value)}
                  placeholder="Describí brevemente tu duda."
                  rows={5}
                />

                <div className="faq-two-cols">
                  <div>
                    <label htmlFor="faq-name">Apellido y nombre</label>
                    <input
                      id="faq-name"
                      value={form.name}
                      onChange={(event) => updateField("name", event.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="faq-dni">DNI</label>
                    <input
                      id="faq-dni"
                      value={form.dni}
                      inputMode="numeric"
                      onChange={(event) => updateField("dni", event.target.value.replace(/\D/g, ""))}
                    />
                  </div>
                </div>

                <div className="faq-two-cols">
                  <div>
                    <label htmlFor="faq-email">Correo electrónico</label>
                    <input
                      id="faq-email"
                      type="email"
                      value={form.email}
                      onChange={(event) => updateField("email", event.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="faq-email2">Repetir correo</label>
                    <input
                      id="faq-email2"
                      type="email"
                      value={form.email2}
                      onChange={(event) => updateField("email2", event.target.value)}
                    />
                  </div>
                </div>

                <label htmlFor="faq-phone">Teléfono celular</label>
                <input
                  id="faq-phone"
                  value={form.phone}
                  inputMode="tel"
                  onChange={(event) => updateField("phone", event.target.value)}
                />

                {error && <div className="faq-error">{error}</div>}
                <button className="faq-primary-button" type="submit" disabled={sending}>
                  {sending ? "Enviando…" : "Enviar consulta"}
                </button>
              </form>
            ) : (
              <div className="faq-success">
                <strong>Consulta enviada</strong>
                <p>Tu número de seguimiento es {result.ticket}.</p>
              </div>
            )}
          </section>
        )}
      </div>

      {selectedQuestion && (
        <div
          className="faq-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedQuestionId("");
          }}
        >
          <section
            className="faq-answer-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="faq-answer-title"
          >
            <button
              type="button"
              className="faq-modal-close"
              aria-label="Cerrar respuesta"
              onClick={() => setSelectedQuestionId("")}
            >
              ×
            </button>
            <div className="faq-answer-meta">
              <span>{selectedQuestion.proyecto}</span>
              <span>{selectedQuestion.etapa}</span>
              <span>N.º {selectedQuestion.orden}</span>
            </div>
            <h2 id="faq-answer-title">{selectedQuestion.pregunta}</h2>
            <div className="faq-answer-copy">{selectedQuestion.respuesta}</div>
            <div className="faq-answer-actions">
              <button
                type="button"
                className="faq-primary-button"
                onClick={() => setSelectedQuestionId("")}
              >
                Listo, entendí
              </button>
              <button
                type="button"
                className="faq-secondary-button"
                onClick={() => openSupport(selectedQuestion)}
              >
                Todavía tengo una duda
              </button>
            </div>
          </section>
        </div>
      )}

      <footer className="faq-footer">
        Instituto Superior de Seguridad Pública (ISSP) · Departamento de Selección e Ingreso
      </footer>
    </main>
  );
}
