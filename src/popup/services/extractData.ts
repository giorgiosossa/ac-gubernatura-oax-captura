import { matchGeo, matchOcupacion } from "./catalogoMatcher"
import { matchPrograma, getCatalogoParaPrompt } from "./Programamatcher"

export interface ExtractedData {
    nombre:             string
    apellido_paterno:   string
    apellido_materno:   string
    genero:             string
    edad:               string
    profesion:          string
    ocupacion:          string
    correo_personal:    string
    telefono:           string
    celular:            string
    cargo:              string
    municipio:          string
    localidad:          string
    colonia:            string
    calle:              string
    numero_exterior:    string
    numero_interior:    string
    fecha_documento:    string
    fecha_recepcion:    string
    dirigido_a:         string
    municipio_modal:    string
    localidad_modal:    string
    contactos: {
        nombre:           string
        apellido_paterno: string
        apellido_materno: string
        correo:           string
        telefono:         string
        comentario:       string
    }[]
    clasificacion:      string
    programa:           string
    subprograma:        string
    proyecto:           string
    requiere:           string
    descripcion:        string
    _warnings:          string[]
}

// ── Construir prompt dinámicamente, inyectando el catálogo real ───────────────
// Así la IA solo puede elegir valores que existen en el catálogo.

function buildPrompt(): string {
    const catalogoTexto = getCatalogoParaPrompt()

    return `Extrae datos del documento. Responde SOLO con JSON válido, sin texto extra ni bloques de código.

PRIORIDAD GLOBAL: Si hay texto subrayado/resaltado, tiene prioridad sobre cualquier otro texto similar.

JSON requerido:
{"nombre":"","apellido_paterno":"","apellido_materno":"","genero":"","edad":"","profesion":"","ocupacion":"","cargo":"","correo_personal":"","telefono":"","celular":"","municipio":"","localidad":"","colonia":"","calle":"","numero_exterior":"","numero_interior":"","fecha_documento":"","fecha_recepcion":"","dirigido_a":"","contactos":[],"clasificacion":"","programa":"","subprograma":"","proyecto":"","requiere":"","descripcion":""}

Reglas:
- nombre/apellidos: quien firma o envía; si hay varios, el subrayado/resaltado. Ignorar prefijos como Sr., Sra., C., Dr., Dra., Lic., Ing., Mtro., Prof.
- genero: solo "Hombre" o "Mujer" (inferir del nombre)
- edad: solo número ej "45"
- ocupacion: puesto actual ej "Presidente Municipal", "Agente Municipal", "Profesor"
- cargo: SIEMPRE llenar — cargo institucional explícito o repetir el valor de ocupacion si no hay otro
- TELÉFONOS — criterio de prioridad (de mayor a menor):
  1. Número subrayado (cualquier tipo)
  2. Número subrayado y manuscrito
  3. Número subrayado y a computadora
  4. Primer número encontrado
  El número con mayor prioridad va en "telefono", el siguiente en "celular". Si solo hay uno, solo llenar "telefono".
- fechas: formato DD/MM/YYYY; si hay varias, la subrayada/resaltada
- dirigido_a: normalizar SIEMPRE a "Ing. Salomón Jara Cruz" sin importar cómo aparezca
- municipio/localidad: nombre exacto del documento; si hay varios, el subrayado
- contactos: personas adicionales mencionadas (representantes, testigos, acompañantes). SOLO incluir si están explícitamente mencionadas, subrayadas o escritas a mano. Si no hay, dejar []. No duplicar al remitente principal. Ignorar prefijos en nombres. Cada objeto: {"nombre":"","apellido_paterno":"","apellido_materno":"","correo":"","telefono":"","comentario":""}. En comentario escribir el rol (ej: "Representante", "Testigo").
- clasificacion: 1=Infraestructura 2=Bienestar Social 3=Salud 4=Educación 5=Seguridad

CATÁLOGO DE PROGRAMAS (programa | subprograma | proyecto):
DEBES elegir EXACTAMENTE de esta lista. Copia el texto tal como aparece.
Si ninguna opción aplica, deja los tres campos vacíos ("").
${catalogoTexto}

- programa/subprograma/proyecto: analiza el contenido de la petición y elige la combinación más adecuada del catálogo de arriba. Copia el texto EXACTO de la columna correspondiente. Si la petición trata de pavimentación, elige la fila de pavimentación. Si trata de agua potable, elige la fila de agua potable. Etc.
- requiere: máx 60 caracteres, frase concreta
- descripcion: iniciar SIEMPRE con "su apoyo con " seguido de redacción en tercera persona clara y explícita y detallada (Identificar exactamente que es lo que se solicita en el documento). Si hay varias peticiones separarlas con ;. Incluir qué se solicita, para qué comunidad/lugar 
(añadir CLAVE escolar si es que el documento lo contiene ), si llegara a tener varias peticiones, resumirlas lo mas posible y 
describir la lista de peticiones. Formato normal (no MAYÚSCULAS). Máx 700 caracteres. 
No debe haber . final, (Nombres propios escribir de personas o ciudades escribirlos con la primera 
letra en mayúscula)`
}

export async function extractDataFromImage(base64Image: string): Promise<ExtractedData> {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY
    if (!apiKey) throw new Error("VITE_OPENAI_API_KEY no está configurada en el archivo .env")

    // El prompt se construye en tiempo de ejecución para incluir el catálogo actual
    const PROMPT = buildPrompt()

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: "gpt-5.4-mini",
            messages: [{
                role: "user",
                content: [
                    { type: "text", text: PROMPT },
                    { type: "image_url", image_url: { url: base64Image, detail: "high" } },
                ],
            }],
           // max_completion_tokens: 800,
            temperature: 0.1,
        }),
    })

    if (!response.ok) {
        const err = await response.json()
        throw new Error(err?.error?.message || `OpenAI error: ${response.status}`)
    }

    const data = await response.json()
    let content = data?.choices?.[0]?.message?.content as string

    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
    content = content.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]")

    const raw = JSON.parse(content)
    const warnings: string[] = []

    // Limpiar prefijos del nombre
    const PREFIJOS = /^(sr\.?|sra\.?|c\.?|dr\.?|dra\.?|lic\.?|ing\.?|mtro\.?|mtra\.?|prof\.?|arq\.?|don|doña)(\s+|$)/i
    if (raw.nombre)           raw.nombre           = raw.nombre.replace(PREFIJOS, "").trim()
    if (raw.apellido_paterno) raw.apellido_paterno = raw.apellido_paterno.replace(PREFIJOS, "").trim()
    if (raw.apellido_materno) raw.apellido_materno = raw.apellido_materno.replace(PREFIJOS, "").trim()

    // Limpiar prefijos en contactos también
    if (Array.isArray(raw.contactos)) {
        raw.contactos = raw.contactos.map((c: any) => ({
            ...c,
            nombre:           (c.nombre           || "").replace(PREFIJOS, "").trim(),
            apellido_paterno: (c.apellido_paterno  || "").replace(PREFIJOS, "").trim(),
            apellido_materno: (c.apellido_materno  || "").replace(PREFIJOS, "").trim(),
        }))
    } else {
        raw.contactos = []
    }

    // Validar municipio y localidad contra catálogo
    const geoMain = matchGeo(raw.municipio || "", raw.localidad || "")

    if (raw.municipio) {
        if (!geoMain.municipio?.found) { warnings.push(`Municipio "${raw.municipio}" no encontrado`); raw.municipio = "" }
        else { if (geoMain.municipio.warning) warnings.push(geoMain.municipio.warning); raw.municipio = geoMain.municipio.nombre }
    }
    if (raw.localidad) {
        if (!geoMain.localidad?.found) { warnings.push(`Localidad "${raw.localidad}" no encontrada`); raw.localidad = "" }
        else { if (geoMain.localidad.warning) warnings.push(geoMain.localidad.warning); raw.localidad = geoMain.localidad.nombre }
    }

    // Reutilizar para el modal
    raw.municipio_modal = raw.municipio
    raw.localidad_modal = raw.localidad

    // Validar ocupación
    if (raw.ocupacion) {
        const ocupResult = matchOcupacion(raw.ocupacion)
        if (!ocupResult.found) {
            warnings.push(`Ocupación "${raw.ocupacion}" no encontrada — guardada en Cargo`)
            if (!raw.cargo) raw.cargo = raw.ocupacion
            raw.ocupacion = ""
        } else {
            raw.ocupacion = ocupResult.nombre
            if (!raw.cargo) raw.cargo = ocupResult.nombre
        }
    }

    // Garantizar cargo siempre con valor
    if (!raw.cargo && raw.ocupacion) raw.cargo = raw.ocupacion

    // ── Validar programa/subprograma/proyecto contra catálogo ────────────────────
    // Aunque la IA ya eligió del catálogo, el matcher hace un fuzzy-match de
    // seguridad por si la IA copió el texto con alguna variación menor.
    // También convierte nombres → IDs para el formulario.
    const progResult = matchPrograma(
        raw.programa     || "",
        raw.subprograma  || "",
        raw.proyecto     || "",
        raw.descripcion  || ""
    )
    if (progResult.found) {
        raw.programa    = progResult.programa?.nombre    || ""
        raw.subprograma = progResult.subprograma?.nombre || ""
        raw.proyecto    = progResult.proyecto?.nombre    || ""
        progResult.warnings.forEach(w => warnings.push(w))
    } else {
        warnings.push(`Programa no identificado — se dejará vacío para selección manual`)
        raw.programa    = ""
        raw.subprograma = ""
        raw.proyecto    = ""
    }

    // Asegurar prefijo en descripción
    if (raw.descripcion && !raw.descripcion.toLowerCase().startsWith("su apoyo con")) {
        raw.descripcion = `su apoyo con ${raw.descripcion}`
    }
    if (raw.descripcion && raw.descripcion.length > 250) {
        raw.descripcion = raw.descripcion.substring(0, 247) + "..."
    }

    // Normalizar mayúsculas en descripción y requiere
    function normalizarMayusculas(text: string): string {
        return text.replace(/\b([A-ZÁÉÍÓÚÜÑ]{2,})\b/g, (word: string) => {
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        })
    }
    if (raw.descripcion) raw.descripcion = normalizarMayusculas(raw.descripcion)
    if (raw.requiere)    raw.requiere    = normalizarMayusculas(raw.requiere)

    return { ...raw, _warnings: warnings } as ExtractedData
}