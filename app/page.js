"use client";

import { useMemo, useState } from "react";

const STAGES = [
  "Admisión",
  "Requisitos",
  "Psicología 1ª instancia",
  "Psicología 2ª instancia",
  "Laboratorio",
  "Médico",
  "Odontológico",
  "Atlético",
  "Socioambiental",
  "Entrevista",
  "Documentación",
  "Examen Intelectual",
  "Entrevista Final",
  "Cierre"
];

const FAQS = {
  "Admisión": [
    "¿Cuándo me corresponde presentarme?",
    "No recibí el correo con las indicaciones",
    "¿Qué documentación debo llevar?"
  ],
  "Requisitos": [
    "¿Qué edad tengo que tener para ingresar?",
    "¿Tengo que ser argentino/a?",
    "¿Puedo anotarme si estoy cursando el último año del secundario?",
    "¿Cuál es la altura requerida?",
    "¿Cuál es el IMC permitido?",
    "Tengo NAT por IMC, ¿cuándo puedo volver?"
  ],
  "Psicología 1ª instancia": [
    "¿Qué significa No Apto Transitorio (NAT)?",
    "Tengo NAT en primera instancia, ¿cuándo puedo volver?",
    "¿Qué significa No Apto Definitivo (NAD)?",
    "No veo mi resultado",
    "Me figura AUSENTE, ¿cómo continúo?",
    "Tengo una consulta sobre mi turno"
  ],
  "Psicología 2ª instancia": [
    "¿Qué significa No Apto Transitorio (NAT)?",
    "Tengo NAT en segunda instancia, ¿cuándo puedo volver?",
    "¿Qué significa No Apto Definitivo (NAD)?",
    "Quiero consultar por el motivo de mi resultado",
    "No veo mi resultado",
    "Tengo una consulta sobre mi turno"
  ],
  "Laboratorio": [
    "¿Cuándo me corresponde laboratorio?",
    "No recibí turno o indicaciones para laboratorio",
    "Ya hice el laboratorio, ¿qué sigue?",
    "No aparece el resultado del laboratorio"
  ],
  "Médico": [
    "Me pidieron un estudio complementario, ¿qué tengo que hacer?",
    "Tengo NAT en Médico, ¿cuándo puedo volver?",
    "Ya tengo el estudio complementario, ¿cómo continúo?",
    "No veo mi resultado médico",
    "Tengo una consulta sobre mi turno médico"
  ],
  "Odontológico": [
    "¿Qué se evalúa en Odontológico?",
    "No veo mi resultado de Odontológico",
    "Tengo una observación o estudio pendiente",
    "Tengo una consulta sobre mi turno"
  ],
  "Atlético": [
    "¿Cómo se aprueba la evaluación atlética?",
    "Tengo NAT en Atlético, ¿cuándo puedo volver?",
    "No veo mi resultado",
    "Tengo una consulta sobre mi turno"
  ],
  "Socioambiental": [
    "¿Cuándo me hacen la evaluación socioambiental?",
    "Tengo NAT en Socioambiental, ¿cuándo puedo retomar?",
    "No me contactaron todavía",
    "No veo mi resultado",
    "Tengo una consulta sobre mi turno"
  ],
  "Entrevista": [
    "¿Cuándo tengo la entrevista?",
    "Ya hice la entrevista y no veo el resultado",
    "Tengo una consulta sobre mi turno",
    "¿Qué tengo que llevar a la entrevista?"
  ],
  "Documentación": [
    "¿Puedo enviar documentación por mail?",
    "¿Qué documentación tengo que presentar?",
    "¿Qué documento del secundario tengo que presentar?",
    "Cargué o presenté un documento incorrecto",
    "¿Mi documentación está completa?",
    "No puedo cargar documentación"
  ],
  "Examen Intelectual": [
    "¿Cuándo tengo el Examen Intelectual?",
    "¿Cómo veo el resultado?",
    "Tengo una consulta sobre mi turno",
    "No veo mi resultado"
  ],
  "Entrevista Final": [
    "Ya hice la Entrevista Final pero no aparece en el sistema",
    "¿Tengo que volver a hacer la Entrevista Final?",
    "¿Cuál es el paso siguiente?",
    "Tengo una consulta sobre mi turno"
  ],
  "Cierre": [
    "¿Cómo sé si finalicé el proceso?",
    "¿Estoy en lista de espera?",
    "¿Cuándo me van a convocar?",
    "¿Cuál es el paso siguiente?"
  ]
};

// RESPUESTAS POR COMBINACIÓN: Proyecto_Etapa_Pregunta
const RESPUESTAS = {
  // ADMISIÓN
  "NICE_Admisión_¿Cuándo me corresponde presentarme?": "Tu fecha de presentación fue informada en el correo de confirmación de inscripción. Podés verificarla accediendo con tu DNI en el portal del ISSP. Si no la encuentras, revisá la carpeta de SPAM. La presentación es obligatoria en la fecha y hora asignadas.",
  "NICE_Admisión_No recibí el correo con las indicaciones": "Si no recibiste el correo en los últimos 7 días, podés solicitar reenvío accediendo al portal con tu DNI. También revisá la carpeta de correo no deseado (SPAM). Si persiste el problema, contactanos con tu número de DNI para que podamos verificar tu registro.",
  "NICE_Admisión_¿Qué documentación debo llevar?": "Para la presentación inicial debes llevar: DNI original y en buen estado, comprobante de domicilio (factura de servicios de los últimos 3 meses), certificado de estudios secundarios o constancia de cursada si aún estás en el último año. Si vivís fuera de la provincia, acepta documentación adicional según corresponda.",
  
  // REQUISITOS
  "NICE_Requisitos_¿Qué edad tengo que tener para ingresar?": "Para ingresar al programa NICE debes tener entre 18 y 40 años (inclusive) al momento de la inscripción. Si cumpliste años después de inscribirte, tu edad registrada es la que vale para el proceso. Podés verificar tu edad registrada en el portal.",
  "NICE_Requisitos_¿Tengo que ser argentino/a?": "Sí, es necesario ser ciudadano/a argentino/a o tener nacionalidad naturalizada con acta de naturalización vigente. En caso de tener otra nacionalidad, debe acreditarse residencia permanente en Argentina con al menos 2 años previos a la inscripción.",
  "NICE_Requisitos_¿Puedo anotarme si estoy cursando el último año del secundario?": "Sí, podés inscribirte en el proceso aunque estés en el último año del secundario. Sin embargo, deberás acreditar el certificado de egreso antes de finalizar la etapa de Documentación. Si no lo presentas a tiempo, tu proceso se suspende hasta que lo hagas.",
  "NICE_Requisitos_¿Cuál es la altura requerida?": "La altura mínima requerida para NICE es 1,60 m para mujeres y 1,70 m para hombres. Esta se verifica en la etapa de Requisitos. Si no cumplís la altura mínima, te será informado un resultado de No Apto.",
  "NICE_Requisitos_¿Cuál es el IMC permitido?": "El Índice de Masa Corporal (IMC) permitido está entre 18,5 y 32. Se calcula según tu peso y altura en la evaluación médica. Si tu IMC está fuera de este rango, se te informará un NAT (No Apto Transitorio) y podrás presentarte nuevamente en 6 meses.",
  "NICE_Requisitos_Tengo NAT por IMC, ¿cuándo puedo volver?": "Si recibiste NAT por IMC, podrás presentarte nuevamente después de 6 meses contados desde la fecha de notificación. Te recomendamos consultar con un médico sobre un plan de ajuste nutricional. Cuando el plazo venza, podrás solicitar un nuevo turno en el portal.",
  
  // PSICOLOGÍA 1ª INSTANCIA
  "NICE_Psicología 1ª instancia_¿Qué significa No Apto Transitorio (NAT)?": "NAT significa que en esta evaluación no cumplís los estándares psicológicos requeridos, pero podés presentarte nuevamente. El NAT es válido por 12 meses desde su emisión. Durante este tiempo, podés solicitar asesoramiento psicológico o psicopedagógico para mejorar en próximas instancias.",
  "NICE_Psicología 1ª instancia_Tengo NAT en primera instancia, ¿cuándo puedo volver?": "Con NAT en primera instancia, podrás presentarte nuevamente después de 90 días desde la notificación. Durante este tiempo, te recomendamos buscar acompañamiento psicológico. Cuando cumpla el plazo, podrás solicitar un nuevo turno en el portal del ISSP.",
  "NICE_Psicología 1ª instancia_¿Qué significa No Apto Definitivo (NAD)?": "NAD significa que no cumplís los requisitos psicológicos necesarios para el proceso y no podrás presentarte nuevamente. Esta es una determinación final. Si considerás que fue un error, podés solicitar revisión por apelación dentro de 15 días de la notificación.",
  "NICE_Psicología 1ª instancia_No veo mi resultado": "Los resultados psicológicos se publican dentro de 15 a 30 días de la evaluación. Si ya pasaron más de 30 días y no ves tu resultado, podés consultar en el portal o registrando una solicitud indicando tu número de DNI.",
  "NICE_Psicología 1ª instancia_Me figura AUSENTE, ¿cómo continúo?": "Si te figura AUSENTE en psicología, significa que no asististe al turno asignado. El proceso se pausa automáticamente. Podés solicitar un nuevo turno desde el portal. Si la ausencia fue por razones de fuerza mayor, podés registrar una justificación y solicitar reactivación.",
  "NICE_Psicología 1ª instancia_Tengo una consulta sobre mi turno": "Para consultas sobre tu turno de evaluación psicológica, verificá el portal del ISSP donde aparece la fecha, hora y lugar de la cita. Si necesitás cambiar el turno, podés solicitarlo directamente en el portal hasta 48 horas antes. Si tenés dudas, registrá tu consulta y serás contactado dentro de 2 días hábiles.",
  
  // PSICOLOGÍA 2ª INSTANCIA
  "NICE_Psicología 2ª instancia_¿Qué significa No Apto Transitorio (NAT)?": "NAT en segunda instancia significa que aún no cumplís los estándares psicológicos requeridos. Tendrás oportunidad de una tercera evaluación. El NAT es válido por 12 meses y podés presentarte después de 90 días.",
  "NICE_Psicología 2ª instancia_Tengo NAT en segunda instancia, ¿cuándo puedo volver?": "Con NAT en segunda instancia, podrás solicitar una tercera evaluación después de 120 días desde la notificación. Te sugerimos aprovecha este tiempo para trabajar en lo que fue observado. Pasado el plazo, podés solicitar nuevo turno en el portal.",
  "NICE_Psicología 2ª instancia_¿Qué significa No Apto Definitivo (NAD)?": "NAD en segunda instancia es definitivo. Significa que no cumplís con los requisitos psicológicos para continuar. No hay oportunidad de tercera evaluación. Podés solicitar apelación administrativo dentro de 15 días de la notificación.",
  "NICE_Psicología 2ª instancia_Quiero consultar por el motivo de mi resultado": "Si obtuviste NAT o NAD, podés solicitar una devolución psicológica registrando una consulta específica. Un profesional te contactará para explicar en detalle los aspectos observados y orientarte sobre próximos pasos.",
  "NICE_Psicología 2ª instancia_No veo mi resultado": "Los resultados de segunda instancia se publican en un plazo de 20 a 40 días. Si ya pasó este tiempo, verificá que hayas completado la evaluación. Podés consultar el estado accediendo con tu DNI al portal.",
  "NICE_Psicología 2ª instancia_Tengo una consulta sobre mi turno": "Podés verificar tu turno en el portal del ISSP. Si necesitás cambiarlo, hacelo hasta 48 horas antes de la cita. Si no aparece turno y completaste primera instancia, podés solicitar que te asignen uno registrando una consulta.",
  
  // LABORATORIO
  "NICE_Laboratorio_¿Cuándo me corresponde laboratorio?": "El laboratorio se realiza una vez aprobada la etapa psicológica correspondiente y cuando el sistema habilita la derivación. Las indicaciones y el turno se informan por los canales registrados durante la inscripción. Usualmente recibís el turno dentro de 7 a 14 días después de aprobar psicología.",
  "NICE_Laboratorio_No recibí turno o indicaciones para laboratorio": "Si ya aprobaste la etapa psicológica y no recibiste indicaciones en 15 días, registrá una consulta para que el equipo verifique tu situación. Es posible que haya un retraso en la generación del turno. Te contactaremos con los detalles del laboratorio contratado.",
  "NICE_Laboratorio_Ya hice el laboratorio, ¿qué sigue?": "Una vez realizado el laboratorio, los resultados se procesan en 5 a 10 días hábiles. Cuando se carguen en el sistema, se inicia la evaluación médica. Te notificaremos cuando te corresponda el turno médico. Mientras, podés consultar el estado en el portal.",
  "NICE_Laboratorio_No aparece el resultado del laboratorio": "Los resultados pueden requerir un tiempo de procesamiento y validación. Si ya pasaron 15 días desde que realizaste el estudio y no aparecen, registrá una consulta indicando la fecha de realización. Nos comunicaremos con el laboratorio para acelerar la carga.",
  
  // MÉDICO
  "NICE_Médico_Me pidieron un estudio complementario, ¿qué tengo que hacer?": "Si la evaluación médica requiere estudios complementarios (radiografías, resonancias, etc.), recibirás la orden especificando qué estudios necesitás. Tenés 30 días para realizarlos. Podés hacerlos en laboratorios privados y cargar los resultados en el portal.",
  "NICE_Médico_Tengo NAT en Médico, ¿cuándo puedo volver?": "Con NAT en medicina, podrás presentarte nuevamente después de 60 días. Durante este tiempo, realizá los tratamientos o estudios recomendados por el médico evaluador. Después de ese plazo, podés solicitar una nueva evaluación en el portal.",
  "NICE_Médico_Ya tengo el estudio complementario, ¿cómo continúo?": "Cargá los resultados en el portal en la sección 'Documentación Médica'. El médico los revisará en un plazo de 5 a 7 días. Si todo está en orden, recibirás aprobación y pasarás a la siguiente etapa.",
  "NICE_Médico_No veo mi resultado médico": "Los resultados médicos se publican en un plazo de 10 a 20 días después de la evaluación. Si ya pasó este tiempo, ingresá al portal para verificar el estado. Si sigue sin aparecer, contactanos registrando una consulta.",
  "NICE_Médico_Tengo una consulta sobre mi turno médico": "Verificá el turno médico en el portal del ISSP. Recibirás confirmación por correo con fecha, hora y centro médico. Si necesitás cambiar el turno, hacelo hasta 48 horas antes. Presentate 10 minutos antes con DNI original.",
  
  // ODONTOLÓGICO
  "NICE_Odontológico_¿Qué se evalúa en Odontológico?": "En la evaluación odontológica se revisa la salud bucal general: piezas dentales presentes, caries, enfermedades periodontales y alineación. Se utiliza un equipo estándar de evaluación. No es una limpieza ni tratamiento, solo una inspección clínica.",
  "NICE_Odontológico_No veo mi resultado de Odontológico": "Los resultados odontológicos se publican dentro de 10 a 15 días. Si no aparece después de este plazo, podés consultar en el portal o registrar una solicitud. El evaluador odontológico será contactado para agilizar la carga.",
  "NICE_Odontológico_Tengo una observación o estudio pendiente": "Si el odontólogo anotó observaciones, podés consultarlas en el sistema. Si requiere tratamientos previos (limpiezas, empastes), deberás realizarlos y cargar constancia. Tenés 60 días para completar tratamientos y revalidar la evaluación.",
  "NICE_Odontológico_Tengo una consulta sobre mi turno": "El turno odontológico se asigna automáticamente después de etapas previas. Verificalo en el portal. Si no aparece o necesitás cambiarlo, registrá una consulta indicando tu disponibilidad horaria.",
  
  // ATLÉTICO
  "NICE_Atlético_¿Cómo se aprueba la evaluación atlética?": "La evaluación atlética incluye pruebas de resistencia, flexibilidad y fuerza. Debes cumplir con los estándares mínimos en cada prueba. Los criterios varían según género. Se considera Apto si cumplís al menos el 80% de los requerimientos.",
  "NICE_Atlético_Tengo NAT en Atlético, ¿cuándo puedo volver?": "Con NAT en atletismo, podrás presentarte nuevamente después de 90 días. Te recomendamos entrenar enfocándote en las áreas observadas. Podés solicitar orientación sobre rutinas de entrenamiento registrando una consulta.",
  "NICE_Atlético_No veo mi resultado": "Los resultados atléticos se publican dentro de 15 días de la evaluación. Si no aparecen, verificá en el portal o contactanos. Es posible que el evaluador aún esté cargando datos.",
  "NICE_Atlético_Tengo una consulta sobre mi turno": "El turno atlético se notifica por correo. Presentate 15 minutos antes con ropa cómoda y zapatillas de deporte. El turno incluye calentamiento previo. Si no recibiste notificación, registrá una consulta.",
  
  // SOCIOAMBIENTAL
  "NICE_Socioambiental_¿Cuándo me hacen la evaluación socioambiental?": "La evaluación socioambiental se realiza mediante entrevista después de completar etapas médicas. El equipo se comunicará directamente para coordinar un turno. Usualmente ocurre entre 2 a 4 semanas después de la evaluación médica.",
  "NICE_Socioambiental_Tengo NAT en Socioambiental, ¿cuándo puedo retomar?": "Con NAT en socioambiental, tendrás oportunidad de una segunda entrevista después de 60 días. Durante este tiempo, podés buscar asesoramiento sobre los aspectos observados. El equipo podrá orientarte sobre esto.",
  "NICE_Socioambiental_No me contactaron todavía": "Si ya completaste etapas previas hace más de 4 semanas y no fuiste contactado, registrá una consulta. Es posible que haya un retraso administrativo. El equipo verificará tu situación y se comunicará contigo.",
  "NICE_Socioambiental_No veo mi resultado": "Los resultados socioambientales se cargan dentro de 10 a 15 días de la entrevista. Si no aparecen después de este tiempo, podés consultar en el portal. El profesional entrevistador será contactado para agilizar.",
  "NICE_Socioambiental_Tengo una consulta sobre mi turno": "El turno socioambiental se coordina directamente con el equipo profesional. Si no fue confirmado aún, registrá una consulta con tu disponibilidad para que te asignen una fecha.",
  
  // ENTREVISTA
  "NICE_Entrevista_¿Cuándo tengo la entrevista?": "La entrevista se realiza después de completar todas las evaluaciones anteriores (médica, odontológica, atlética, socioambiental). Recibirás notificación con fecha y hora aproximadamente 2 semanas antes. Es obligatoria y no se reprograman sin justificación.",
  "NICE_Entrevista_Ya hice la entrevista y no veo el resultado": "Los resultados de entrevista se publican dentro de 10 a 20 días. Si ya pasó este tiempo, podés consultar en el portal o registrar una solicitud. El evaluador estará verificando la información.",
  "NICE_Entrevista_Tengo una consulta sobre mi turno": "Verificá el turno en el portal. La entrevista es presencial y obligatoria. Presentate con DNI y 10 minutos de anticipación. Si necesitás reprogramar, debes justificar con documentación (certificado médico, etc.) dentro de 48 horas.",
  "NICE_Entrevista_¿Qué tengo que llevar a la entrevista?": "Llevá tu DNI original, papeles de identificación personal, y cualquier documentación que consideres relevante (certificados, recomendaciones, etc.). La entrevista es informal pero evaluativa. Sé honesto y coherente en tus respuestas.",
  
  // DOCUMENTACIÓN
  "NICE_Documentación_¿Puedo enviar documentación por mail?": "No, la documentación debe cargarse obligatoriamente en el portal del ISSP en la sección 'Documentación'. No se aceptan envíos por correo ni presenciales para las etapas finales. Si tienes problemas técnicos, registrá una consulta.",
  "NICE_Documentación_¿Qué documentación tengo que presentar?": "Debes presentar: Certificado de Egreso o acta de egreso del secundario, DNI (copia frente y dorso), comprobante de domicilio actual, y certificados de evaluaciones completadas en el proceso. Algunos podrían ser adicionales según circunstancias.",
  "NICE_Documentación_¿Qué documento del secundario tengo que presentar?": "Es obligatorio presentar el Certificado de Egreso o Diploma oficial del secundario firmado por la institución. Si aún estás cursando el último año, presenta una constancia de cursada actual. Una vez egreses, debés cargar el certificado definitivo.",
  "NICE_Documentación_Cargué o presenté un documento incorrecto": "Si cargaste un documento incorrecto, podés reemplazarlo directamente en el portal en la misma sección. El sistema permite modificaciones hasta que el equipo lo revise. Si ya fue revisado, registrá una consulta indicando el error.",
  "NICE_Documentación_¿Mi documentación está completa?": "Podés verificar el estado de tu documentación en el portal. Si falta algo, te lo indicará en rojo. Completá los faltantes dentro de 30 días. Si no lo haces, tu proceso se suspende hasta que cargues todo.",
  "NICE_Documentación_No puedo cargar documentación": "Si tienes problemas técnicos para cargar, probá con otro navegador o dispositivo. Asegúrate de tener archivos en PDF o JPG. Si persiste el problema, contactanos registrando una consulta detallando el error.",
  
  // EXAMEN INTELECTUAL
  "NICE_Examen Intelectual_¿Cuándo tengo el Examen Intelectual?": "El Examen Intelectual se realiza en una fecha definida y se notifica con anticipación. Todos los aspirantes examinados en el mismo período rinden el mismo día. Recibirás convocatoria oficial 15 días antes con fecha, hora y lugar.",
  "NICE_Examen Intelectual_¿Cómo veo el resultado?": "Los resultados se publican en el portal dentro de 20 a 30 días después del examen. Puedes consultarlos accediendo con tu DNI. Si ya pasó este plazo y no ves resultado, registrá una consulta.",
  "NICE_Examen Intelectual_Tengo una consulta sobre mi turno": "El turno del Examen Intelectual es único y no se puede cambiar. Si no pudiste asistir, justificá con documentación (certificado médico, etc.) dentro de 7 días. Se te asignará un nuevo turno en la próxima fecha de examen.",
  "NICE_Examen Intelectual_No veo mi resultado": "Si completaste el examen hace más de 30 días y no ves resultado, podés consultar en el portal o registrar una solicitud. El equipo de evaluación verificará si tu examen fue procesado correctamente.",
  
  // ENTREVISTA FINAL
  "NICE_Entrevista Final_Ya hice la Entrevista Final pero no aparece en el sistema": "Los resultados de Entrevista Final se cargan en 10 a 15 días. Si ya pasó este tiempo, podés consultar en el portal. Si aún no aparece, registrá una consulta con la fecha en que realizaste la entrevista.",
  "NICE_Entrevista Final_¿Tengo que volver a hacer la Entrevista Final?": "No, la Entrevista Final se realiza una sola vez. Si ya la realizaste, espera a que se cargue el resultado en el sistema (máximo 15 días). Solo tendrías que repetirla si obtuvieras NAT, lo cual es raro en esta etapa.",
  "NICE_Entrevista Final_¿Cuál es el paso siguiente?": "Después de la Entrevista Final, ingresa el período de Cierre donde se consolidan todos los resultados. El equipo de Selección e Ingreso emitirá la resolución final en un plazo de 30 días. Espera la notificación oficial.",
  "NICE_Entrevista Final_Tengo una consulta sobre mi turno": "Verificá el turno en el portal. La Entrevista Final es presencial. Presentate con DNI y toda tu documentación original como respaldo. Si no recibiste turno, registrá una consulta.",
  
  // CIERRE
  "NICE_Cierre_¿Cómo sé si finalicé el proceso?": "Finaliza el proceso cuando recibes una Resolución Oficial del ISSP indicando tu resultado final (Ingresante o No Ingresante). Se notifica por correo oficial y aparece en el portal. Podés descargar la resolución como documento legal.",
  "NICE_Cierre_¿Estoy en lista de espera?": "La lista de espera se publica en caso de que el número de Ingresantes aprobados sea menor a los lugares disponibles. Si estás en lista de espera, recibirás notificación oficial. Las incorporaciones se hacen en orden de calificación.",
  "NICE_Cierre_¿Cuándo me van a convocar?": "La convocatoria oficial se realiza una vez completada la Resolución Final, aproximadamente 30 a 45 días después de terminar todas las etapas. Te notificaremos por correo oficial y en el portal. Asegúrate de tener datos actualizados.",
  "NICE_Cierre_¿Cuál es el paso siguiente?": "Si eres Ingresante, recibirás instrucciones sobre trámites de matrícula y inicio de actividades. Si no ingresaste, podrás consultar si es posible presentarte en próximas convocatorias. Registrá una consulta si tienes dudas sobre tu resultado."
};

function makeTicket() {
  const now = new Date();
  const year = now.getFullYear();
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `SI-${year}-${rand}`;
}

export default function Home() {
  const [project, setProject] = useState("NICE");
  const [form, setForm] = useState({
    name: "",
    dni: "",
    email: "",
    email2: "",
    phone: ""
  });
  const [stage, setStage] = useState("Laboratorio");
  const [question, setQuestion] = useState("");
  const [customMode, setCustomMode] = useState(false);
  const [customQuery, setCustomQuery] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const questions = useMemo(() => FAQS[stage] || [], [stage]);

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function chooseStage(value) {
    setStage(value);
    setQuestion("");
    setCustomMode(false);
    setCustomQuery("");
    setResult(null);
    setError("");
  }

  function chooseQuestion(value) {
    setQuestion(value);
    setCustomMode(false);
    setCustomQuery("");
    setResult(null);
    setError("");
  }

  function chooseCustom() {
    setQuestion("");
    setCustomMode(true);
    setResult(null);
    setError("");
  }

  async function submit(e) {
    e.preventDefault();
    setError("");

    if (!form.name.trim() || !form.dni.trim() || !form.email.trim() || !form.email2.trim() || !form.phone.trim()) {
      setError("Completá todos los datos del aspirante.");
      return;
    }
    if (form.email.trim().toLowerCase() !== form.email2.trim().toLowerCase()) {
      setError("Los correos electrónicos no coinciden.");
      return;
    }
    if (!question && !customMode) {
      setError("Seleccioná una consulta o elegí la opción de consulta libre.");
      return;
    }
    if (customMode && !customQuery.trim()) {
      setError("Escribí brevemente tu consulta.");
      return;
    }

    const ticket = makeTicket();
    const payload = {
      ticket,
      proyecto: project,
      nombre: form.name,
      dni: form.dni,
      email: form.email,
      telefono: form.phone,
      etapa: stage,
      consulta: customMode ? customQuery : question
    };

    setSending(true);
    try {
      const endpoint = process.env.NEXT_PUBLIC_FORMSPREE_ENDPOINT;

      if (endpoint) {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error("No se pudo registrar la consulta.");
      }

      // Generar key: Proyecto_Etapa_Pregunta
      const respuestaKey = `${project}_${stage}_${question}`;
      const respuesta = RESPUESTAS[respuestaKey] 
        || "Tu consulta quedó registrada. El equipo de Selección e Ingreso podrá revisarla con los datos informados.";

      setResult({
        ticket,
        answer: !customMode ? respuesta : "Tu consulta quedó registrada. El equipo de Selección e Ingreso podrá revisarla con los datos informados."
      });
    } catch (err) {
      setError("No pudimos registrar la consulta. Intentá nuevamente en unos minutos.");
    } finally {
      setSending(false);
    }
  }

  function resetQuestion() {
    setQuestion("");
    setCustomMode(false);
    setCustomQuery("");
    setResult(null);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="page">
      <header className="hero">
        <div style={{display: "flex", alignItems: "center", justifyContent: "center", gap: "16px", marginBottom: "16px"}}>
          <svg width="48" height="48" viewBox="0 0 48 48" style={{minWidth: "48px"}}>
            <circle cx="24" cy="24" r="22" fill="none" stroke="#ffffff" strokeWidth="2"/>
            <path d="M24 10 L30 18 L30 32 Q24 35 18 32 L18 18 Z" fill="#ffffff" opacity="0.9"/>
            <circle cx="24" cy="20" r="2" fill="#003d7a"/>
          </svg>
          <div style={{textAlign: "left"}}>
            <div style={{fontSize: "20px", fontWeight: "700", color: "#ffffff", letterSpacing: "1px"}}>ISSP</div>
            <div style={{fontSize: "11px", color: "rgba(255,255,255,0.85)", fontWeight: "500", marginTop: "2px"}}>INSTITUCIÓN PÚBLICA</div>
          </div>
        </div>
        <h1>Formulario de Consultas</h1>
        <p>Departamento de Selección e Ingreso</p>
      </header>

      <form onSubmit={submit} className="formWrap">
        <section className="card">
          <h2>1. Proyecto</h2>
          <label>¿A qué proceso corresponde tu consulta?</label>
          <select value={project} onChange={(e) => setProject(e.target.value)}>
            <option>NICE</option>
            <option>Policía</option>
            <option>Bomberos</option>
          </select>
        </section>

        <section className="card">
          <h2>2. Datos del aspirante</h2>

          <div className="twoCols">
            <div>
              <label>Apellido y nombre</label>
              <input
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="Ingresá apellido y nombre"
              />
            </div>
            <div>
              <label>DNI</label>
              <input
                value={form.dni}
                onChange={(e) => updateField("dni", e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                placeholder="Sin puntos"
              />
            </div>
          </div>

          <label>Correo electrónico</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => updateField("email", e.target.value)}
            placeholder="nombre@correo.com"
          />

          <label>Repetir correo electrónico</label>
          <input
            type="email"
            value={form.email2}
            onChange={(e) => updateField("email2", e.target.value)}
            placeholder="Repetí el correo"
          />

          <label>Teléfono celular</label>
          <input
            value={form.phone}
            onChange={(e) => updateField("phone", e.target.value)}
            inputMode="tel"
            placeholder="Ej.: 11 1234 5678"
          />
        </section>

        <section className="card">
          <h2>3. Etapa del proceso</h2>
          <p className="helper">Tocá una etapa. Debajo aparecerán solamente sus preguntas.</p>

          <div className="stageList">
            {STAGES.map((item) => (
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

          <div className="divider" />

          <h3>Preguntas de {stage}</h3>

          <div className="questionList">
            {questions.map((item) => (
              <button
                type="button"
                key={item}
                className={`optionButton ${question === item ? "selected" : ""}`}
                onClick={() => chooseQuestion(item)}
              >
                {item}
              </button>
            ))}

            <button
              type="button"
              className={`optionButton dashed ${customMode ? "selected" : ""}`}
              onClick={chooseCustom}
            >
              No encuentro mi consulta entre estas opciones
            </button>
          </div>

          {customMode && (
            <div className="customQuery">
              <label>Escribí brevemente tu consulta</label>
              <textarea
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
                placeholder="Contanos qué necesitás consultar."
                rows={5}
              />
            </div>
          )}
        </section>

        <section className="card">
          <h2>4. Envío</h2>
          <p className="helper">
            Al enviar, tu consulta queda registrada. Si existe una respuesta automática para la opción elegida, aparecerá acá abajo.
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

              <button type="button" className="secondaryButton" onClick={resetQuestion}>
                ¿Tenés otra consulta? Hacer otra pregunta
              </button>
            </>
          )}
        </section>
      </form>

      <footer>
        <div style={{textAlign: "center", padding: "20px", color: "var(--muted)", fontSize: "12px", borderTop: "1px solid #e0e0e0"}}>
          Instituto Superior de Seguridad Pública (ISSP) · Departamento de Selección e Ingreso<br/>
          © {new Date().getFullYear()} Todos los derechos reservados
        </div>
      </footer>
    </main>
  );
}
