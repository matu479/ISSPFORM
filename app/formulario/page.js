"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { getFirebaseServices } from "@/lib/firebase";
import {
  comparePreguntas,
  DEFAULT_PROJECTS,
  DEFAULT_STAGES,
  FAQ_COLLECTION,
  normalizePregunta
} from "@/lib/faq";

function makeTicket() {
  const now = new Date();
  const year = now.getFullYear();
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `SI-${year}-${rand}`;
}

function stageComparator(a, b) {
  const aIndex = DEFAULT_STAGES.indexOf(a);
  const bIndex = DEFAULT_STAGES.indexOf(b);

  if (aIndex >= 0 && bIndex >= 0) return aIndex - bIndex;
  if (aIndex >= 0) return -1;
  if (bIndex >= 0) return 1;
  return a.localeCompare(b, "es");
}

export default function Home() {
  const [faqs, setFaqs] = useState([]);
  const [loadingFaqs, setLoadingFaqs] = useState(true);
  const [faqError, setFaqError] = useState("");

  const [project, setProject] = useState("NICE");
  const [form, setForm] = useState({
    name: "",
    dni: "",
    email: "",
    email2: "",
    phone: ""
  });
  const [stage, setStage] = useState("");
  const [questionId, setQuestionId] = useState("");
  const [customMode, setCustomMode] = useState(false);
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
            .map((item) =>
              normalizePregunta(item.id, item.data())
            )
            .filter(Boolean)
            .sort(comparePreguntas);

          setFaqs(data);
          setFaqError("");
          setLoadingFaqs(false);
        },
        () => {
          setFaqError(
            "No pudimos cargar las preguntas en este momento. Podés escribir una consulta libre."
          );
          setLoadingFaqs(false);
        }
      );
    } catch {
      setFaqError(
        "El formulario de preguntas no está configurado. Podés escribir una consulta libre."
      );
      setLoadingFaqs(false);
      return undefined;
    }
  }, []);

  const publicFaqs = useMemo(
    () =>
      faqs.filter(
        (item) =>
          item.activo &&
          item.revision === "REVISADA" &&
          item.proyecto !== "Sin asignar"
      ),
    [faqs]
  );

  const projects = useMemo(
    () =>
      [...new Set([...DEFAULT_PROJECTS, ...publicFaqs.map((item) => item.proyecto)])]
        .filter(Boolean),
    [publicFaqs]
  );

  const stages = useMemo(
    () =>
      [...new Set(
        publicFaqs
          .filter((item) => item.proyecto === project)
          .map((item) => item.etapa)
      )].sort(stageComparator),
    [publicFaqs, project]
  );

  const questions = useMemo(
    () =>
      publicFaqs
        .filter(
          (item) =>
            item.proyecto === project &&
            item.etapa === stage
        )
        .sort((a, b) => a.orden - b.orden || a.pregunta.localeCompare(b.pregunta, "es")),
    [publicFaqs, project, stage]
  );

  const selectedQuestion = useMemo(
    () => questions.find((item) => item.id === questionId) || null,
    [questionId, questions]
  );

  useEffect(() => {
    if (stages.length === 0) {
      setStage("");
      setQuestionId("");
      return;
    }

    if (!stages.includes(stage)) {
      setStage(stages[0]);
      setQuestionId("");
      setCustomMode(false);
      setCustomQuery("");
      setResult(null);
      setError("");
    }
  }, [stage, stages]);

  function updateField(key, value) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  function chooseProject(value) {
    setProject(value);
    setStage("");
    setQuestionId("");
    setCustomMode(false);
    setCustomQuery("");
    setResult(null);
    setError("");
  }

  function chooseStage(value) {
    setStage(value);
    setQuestionId("");
    setCustomMode(false);
    setCustomQuery("");
    setResult(null);
    setError("");
  }

  function chooseQuestion(value) {
    setQuestionId(value);
    setCustomMode(false);
    setCustomQuery("");
    setResult(null);
    setError("");
  }

  function chooseCustom() {
    setQuestionId("");
    setCustomMode(true);
    setResult(null);
    setError("");
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

    if (!selectedQuestion && !customMode) {
      setError("Seleccioná una consulta o elegí la opción de consulta libre.");
      return;
    }

    if (customMode && !customQuery.trim()) {
      setError("Escribí brevemente tu consulta.");
      return;
    }

    const ticket = makeTicket();
    const consulta = customMode ? customQuery.trim() : selectedQuestion.pregunta;
    const payload = {
      ticket,
      proyecto: project,
      nombre: form.name.trim(),
      dni: form.dni.trim(),
      email: form.email.trim(),
      telefono: form.phone.trim(),
      etapa: stage || "Sin etapa",
      consulta,
      preguntaId: selectedQuestion?.id || null
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

      setResult({
        ticket,
        answer:
          !customMode && selectedQuestion
            ? selectedQuestion.respuesta
            : "Tu consulta quedó registrada. El equipo de Selección e Ingreso podrá revisarla con los datos informados."
      });
    } catch {
      setError(
        "No pudimos registrar la consulta. Intentá nuevamente en unos minutos."
      );
    } finally {
      setSending(false);
    }
  }

  function resetQuestion() {
    setQuestionId("");
    setCustomMode(false);
    setCustomQuery("");
    setResult(null);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="page">
      <header className="hero">
        <div style={{ marginBottom: "30px", textAlign: "center" }}>
          <h1>Formulario de Consultas</h1>
          <p>Departamento de Selección e Ingreso | ISSP</p>
        </div>
      </header>

      <form onSubmit={submit} className="formWrap">
        <section className="card">
          <h2>1. Proyecto</h2>
          <label>¿A qué proceso corresponde tu consulta?</label>
          <select
            value={project}
            onChange={(event) => chooseProject(event.target.value)}
          >
            {projects.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </section>

        <section className="card">
          <h2>2. Datos Personales</h2>

          <div className="twoCols">
            <div>
              <label>Apellido y nombre</label>
              <input
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="Ingresá apellido y nombre"
              />
            </div>
            <div>
              <label>DNI</label>
              <input
                value={form.dni}
                onChange={(event) =>
                  updateField("dni", event.target.value.replace(/\D/g, ""))
                }
                inputMode="numeric"
                placeholder="Sin puntos"
              />
            </div>
          </div>

          <label>Correo electrónico</label>
          <input
            type="email"
            value={form.email}
            onChange={(event) => updateField("email", event.target.value)}
            placeholder="nombre@correo.com"
          />

          <label>Repetir correo electrónico</label>
          <input
            type="email"
            value={form.email2}
            onChange={(event) => updateField("email2", event.target.value)}
            placeholder="Repetí el correo"
          />

          <label>Teléfono celular</label>
          <input
            value={form.phone}
            onChange={(event) => updateField("phone", event.target.value)}
            inputMode="tel"
            placeholder="Ej.: 11 1234 5678"
          />
        </section>

        <section className="card">
          <h2>3. Etapa del proceso</h2>
          <p className="helper">
            Elegí una etapa. Debajo aparecerán las preguntas activas cargadas
            desde el panel administrativo.
          </p>

          {loadingFaqs ? (
            <p className="helper">Cargando preguntas…</p>
          ) : (
            <>
              {faqError && <div className="errorBox">{faqError}</div>}

              {stages.length > 0 ? (
                <div className="stageList">
                  {stages.map((item) => (
                    <button
                      type="button"
                      key={item}
                      className={`optionButton ${stage === item ? "selected" : ""}`}
                      onClick={() => chooseStage(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="helper">
                  Todavía no hay preguntas activas para {project}.
                </p>
              )}

              {stage && (
                <>
                  <div className="divider" />
                  <h3>Preguntas de {stage}</h3>
                  <div className="questionList">
                    {questions.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        className={`optionButton ${
                          questionId === item.id ? "selected" : ""
                        }`}
                        onClick={() => chooseQuestion(item.id)}
                      >
                        {item.pregunta}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          <div className={stage ? "" : "divider"} />

          <button
            type="button"
            className={`optionButton dashed ${customMode ? "selected" : ""}`}
            onClick={chooseCustom}
          >
            No encuentro mi consulta entre estas opciones
          </button>

          {customMode && (
            <div className="customQuery">
              <label>Escribí brevemente tu consulta</label>
              <textarea
                value={customQuery}
                onChange={(event) => setCustomQuery(event.target.value)}
                placeholder="Contanos qué necesitás consultar."
                rows={5}
              />
            </div>
          )}
        </section>

        <section className="card">
          <h2>4. Envío</h2>
          <p className="helper">
            Al enviar, tu consulta queda registrada. Si seleccionaste una
            pregunta frecuente, verás su respuesta actualizada.
          </p>

          {error && <div className="errorBox">{error}</div>}

          {!result ? (
            <button className="submitButton" type="submit" disabled={sending}>
              {sending ? "Enviando..." : "Enviar consulta"}
            </button>
          ) : (
            <>
              <div className="successBox">
                <strong>Ticket {result.ticket}</strong>
                <p>{result.answer}</p>
              </div>

              <button
                type="button"
                className="secondaryButton"
                onClick={resetQuestion}
              >
                ¿Tenés otra consulta? Hacer otra pregunta
              </button>
            </>
          )}
        </section>
      </form>

      <footer>
        <div
          style={{
            textAlign: "center",
            padding: "20px",
            color: "var(--muted)",
            fontSize: "12px",
            borderTop: "1px solid #e0e0e0"
          }}
        >
          Instituto Superior de Seguridad Pública (ISSP) · Departamento de
          Selección e Ingreso
          <br />© {new Date().getFullYear()} Todos los derechos reservados
        </div>
      </footer>
    </main>
  );
}
