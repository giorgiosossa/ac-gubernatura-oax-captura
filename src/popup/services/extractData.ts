// popup/services/extractData.ts
// ─────────────────────────────────────────────────────────────────────────────
// Llama a OpenAI GPT-4o Vision para extraer datos del documento,
// luego valida municipios y localidades contra el catálogo oficial.
// ─────────────────────────────────────────────────────────────────────────────

import { matchGeo } from "./catalogoMatcher"

export interface ExtractedData {
    curp:               string
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
    municipio:          string   // nombre exacto del catálogo o ""
    localidad:          string   // nombre exacto del catálogo o ""
    colonia:            string
    calle:              string
    numero_exterior:    string
    numero_interior:    string
    fecha_documento:    string
    fecha_recepcion:    string
    dirigido_a:         string
    municipio_modal:    string   // nombre exacto del catálogo o ""
    localidad_modal:    string   // nombre exacto del catálogo o ""
    clasificacion:      string
    requiere:           string
    descripcion:        string
    // Advertencias de matching (no van al formulario)
    _warnings:          string[]
}

const PROMPT = `
Analiza cuidadosamente la imagen proporcionada del documento.

Extrae los siguientes campos y devuélvelos EXCLUSIVAMENTE en formato JSON, sin explicaciones, sin texto adicional, sin encabezados y sin comentarios.

Si un dato no es visible o no existe, deja el valor como una cadena vacía "".

Estructura JSON obligatoria:

{
  "curp": "",
  "nombre": "",
  "apellido_paterno": "",
  "apellido_materno": "",
  "genero": "",
  "edad": "",
  "profesion": "",
  "ocupacion": "",
  "correo_personal": "",
  "telefono": "",
  "celular": "",
  "cargo": "",
  "municipio": "",
  "localidad": "",
  "colonia": "",
  "calle": "",
  "numero_exterior": "",
  "numero_interior": "",
  "fecha_documento": "",
  "fecha_recepcion": "",
  "dirigido_a": "",
  "municipio_modal": "",
  "localidad_modal": "",
  "clasificacion": "",
  "requiere": "",
  "descripcion": ""
}

Reglas de extracción:

1. Nombre del remitente: persona que firma o aparece como quien envía.
   Separar en nombre(s), apellido paterno y apellido materno.

2. Género: inferirlo a partir del nombre si no se indica explícitamente.
   Usar únicamente "Hombre" o "Mujer".

3. Edad: número en string, ej: "45".

4. Profesión: título o profesión académica.

5. Ocupación: puesto o rol actual. Ej: "Presidente Municipal", "Agente Municipal".

6. Cargo: cargo institucional si aplica.

7. Email: buscar patrones con @ y dominio.

8. Teléfono / Celular: números telefónicos visibles. Eliminar espacios extras.

9. Municipio y Localidad: nombre exacto como aparece en el documento.

10. Colonia, Calle, Número Exterior, Número Interior: dirección del remitente.

11. Fecha de documento: fecha de elaboración o firma. Formato DD/MM/YYYY.

12. Fecha de recepción: fecha de recibido o sellada. Formato DD/MM/YYYY.

13. Dirigido a: si aparece como "Lic. Salomón Jara Cruz", "C. Salomón Jara Cruz" u otra variante,
    normalizar SIEMPRE a: "Ing. Salomón Jara Cruz"

14. Municipio modal y Localidad modal: municipio y localidad de donde se emite la petición.

15. Clasificación: elegir SOLO el número según el contexto:
    1 = Infraestructura, 2 = Bienestar Social, 3 = Salud, 4 = Educación, 5 = Seguridad

16. Requiere: frase corta de lo que solicita (máx. 50 caracteres).

17. Descripción: resumen de la petición principal (máx. 200 caracteres).

Formato de salida:
- Únicamente el JSON válido.
- Sin comentarios ni textos externos.
- Sin comas al final, sin bloques de código.
`

export async function extractDataFromImage(base64Image: string): Promise<ExtractedData> {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY

    if (!apiKey) {
        throw new Error("VITE_OPENAI_API_KEY no está configurada en el archivo .env")
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: "gpt-4o",
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: PROMPT },
                        { type: "image_url", image_url: { url: base64Image, detail: "high" } },
                    ],
                },
            ],
            max_tokens: 1000,
            temperature: 0.2,
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

    // ── Validar municipio y localidad contra el catálogo ──────────────────────
    const geoMain = matchGeo(raw.municipio || "", raw.localidad || "")
    const geoModal = matchGeo(raw.municipio_modal || "", raw.localidad_modal || "")

    // Municipio principal
    if (raw.municipio) {
        if (!geoMain.municipio?.found) {
            warnings.push(`Municipio "${raw.municipio}" no encontrado en el catálogo`)
            raw.municipio = ""
        } else {
            if (geoMain.municipio.warning) warnings.push(geoMain.municipio.warning)
            raw.municipio = geoMain.municipio.nombre
        }
    }

    // Localidad principal
    if (raw.localidad) {
        if (!geoMain.localidad?.found) {
            warnings.push(`Localidad "${raw.localidad}" no encontrada en el catálogo`)
            raw.localidad = ""
        } else {
            if (geoMain.localidad.warning) warnings.push(geoMain.localidad.warning)
            raw.localidad = geoMain.localidad.nombre
        }
    }

    // Municipio modal
    if (raw.municipio_modal) {
        if (!geoModal.municipio?.found) {
            warnings.push(`Municipio (modal) "${raw.municipio_modal}" no encontrado en el catálogo`)
            raw.municipio_modal = ""
        } else {
            if (geoModal.municipio.warning) warnings.push(geoModal.municipio.warning)
            raw.municipio_modal = geoModal.municipio.nombre
        }
    }

    // Localidad modal
    if (raw.localidad_modal) {
        if (!geoModal.localidad?.found) {
            warnings.push(`Localidad (modal) "${raw.localidad_modal}" no encontrada en el catálogo`)
            raw.localidad_modal = ""
        } else {
            if (geoModal.localidad.warning) warnings.push(geoModal.localidad.warning)
            raw.localidad_modal = geoModal.localidad.nombre
        }
    }

    return { ...raw, _warnings: warnings } as ExtractedData
}