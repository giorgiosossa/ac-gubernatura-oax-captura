import { matchGeo, matchOcupacion } from "./catalogoMatcher"

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
    clasificacion:      string
    requiere:           string
    descripcion:        string
    _warnings:          string[]
}

const PROMPT = `Extrae datos del documento. Responde SOLO con JSON válido, sin texto extra ni bloques de código.

PRIORIDAD GLOBAL: Si hay texto subrayado/resaltado, tiene prioridad sobre cualquier otro texto similar.

JSON requerido:
{"nombre":"","apellido_paterno":"","apellido_materno":"","genero":"","edad":"","profesion":"","ocupacion":"","cargo":"","correo_personal":"","telefono":"","celular":"","municipio":"","localidad":"","colonia":"","calle":"","numero_exterior":"","numero_interior":"","fecha_documento":"","fecha_recepcion":"","dirigido_a":"","clasificacion":"","requiere":"","descripcion":""}

Reglas:
- nombre/apellidos: quien firma o envía; si hay varios, el subrayado/resaltado
- genero: solo "Hombre" o "Mujer" (inferir del nombre)
- edad: solo número ej "45"
- ocupacion: puesto actual ej "Presidente Municipal", "Agente Municipal", "Profesor"
- cargo: cargo institucional explícito; si no hay, dejar vacío
- TELÉFONOS — criterio de prioridad (de mayor a menor):
  1. Número subrayado (cualquier tipo)
  2. Número subrayado y manuscrito
  3. Número subrayado y a computadora
  4. Primer número encontrado
  El número con mayor prioridad va en "telefono", el siguiente en "celular". Si solo hay uno, solo llenar "telefono".
- fechas: formato DD/MM/YYYY; si hay varias, la subrayada/resaltada
- dirigido_a: normalizar SIEMPRE a "Ing. Salomón Jara Cruz" sin importar cómo aparezca
- municipio/localidad: nombre exacto del documento; si hay varios, el subrayado
- clasificacion: 1=Infraestructura 2=Bienestar Social 3=Salud 4=Educación 5=Seguridad
- requiere: máx 50 caracteres, frase concreta
- descripcion: iniciar SIEMPRE con "su apoyo con " + qué se solicita + para qué comunidad/lugar; máx 200 caracteres`

export async function extractDataFromImage(base64Image: string): Promise<ExtractedData> {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY
    if (!apiKey) throw new Error("VITE_OPENAI_API_KEY no está configurada en el archivo .env")

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: "gpt-4o",
            messages: [{
                role: "user",
                content: [
                    { type: "text", text: PROMPT },
                    { type: "image_url", image_url: { url: base64Image, detail: "high" } },
                ],
            }],
            max_tokens: 600,
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

    // Validar municipios y localidades
    // Un solo match — municipio/localidad del modal son los mismos que los de la solicitud
    const geoMain = matchGeo(raw.municipio || "", raw.localidad || "")

    if (raw.municipio) {
        if (!geoMain.municipio?.found) { warnings.push(`Municipio "${raw.municipio}" no encontrado`); raw.municipio = "" }
        else { if (geoMain.municipio.warning) warnings.push(geoMain.municipio.warning); raw.municipio = geoMain.municipio.nombre }
    }
    if (raw.localidad) {
        if (!geoMain.localidad?.found) { warnings.push(`Localidad "${raw.localidad}" no encontrada`); raw.localidad = "" }
        else { if (geoMain.localidad.warning) warnings.push(geoMain.localidad.warning); raw.localidad = geoMain.localidad.nombre }
    }

    // Reutilizar directamente para el modal
    raw.municipio_modal = raw.municipio
    raw.localidad_modal = raw.localidad

    // Validar ocupación — si no matchea, mover a cargo
    if (raw.ocupacion) {
        const ocupResult = matchOcupacion(raw.ocupacion)
        if (!ocupResult.found) {
            warnings.push(`Ocupación "${raw.ocupacion}" no encontrada — guardada en Cargo`)
            if (!raw.cargo) raw.cargo = raw.ocupacion
            raw.ocupacion = ""
        } else {
            raw.ocupacion = ocupResult.nombre
        }
    }

    // Asegurar prefijo en descripción
    if (raw.descripcion && !raw.descripcion.toLowerCase().startsWith("su apoyo con")) {
        raw.descripcion = `su apoyo con ${raw.descripcion}`
        if (raw.descripcion.length > 200) raw.descripcion = raw.descripcion.substring(0, 197) + "..."
    }

    return { ...raw, _warnings: warnings } as ExtractedData
}