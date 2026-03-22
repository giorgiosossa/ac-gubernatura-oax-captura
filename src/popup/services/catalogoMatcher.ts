// popup/services/catalogoMatcher.ts
// ─────────────────────────────────────────────────────────────────────────────
// Matching fuzzy de municipios y localidades contra el catálogo oficial.
// Estrategia:
//   1. Normaliza texto (sin tildes, minúsculas, sin espacios extra)
//   2. Busca coincidencia exacta
//   3. Si no hay, busca si el catálogo contiene el texto de la IA o viceversa
//   4. Si no hay, calcula similitud por bigramas (Dice coefficient)
//   5. Si la similitud < umbral (0.4), retorna null (no encontrado)
// ─────────────────────────────────────────────────────────────────────────────

import catalogoRaw from "./catalogoOaxaca.json"

export interface MunicipioEntry {
    id: number
    nombre: string
    localidades: LocalidadEntry[]
}

export interface LocalidadEntry {
    id: number
    nombre: string
}

export interface MatchResult {
    found: boolean
    nombre: string      // nombre exacto del catálogo (para el autocomplete)
    id: number
    score: number       // 0-1, qué tan buena fue la coincidencia
    warning?: string    // mensaje si fue aproximado
}

const catalogo = catalogoRaw as MunicipioEntry[]

// ── Normalización ─────────────────────────────────────────────────────────────

function normalize(str: string): string {
    return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " ")
}

// ── Similitud por bigramas (Dice coefficient) ─────────────────────────────────

function bigrams(str: string): Set<string> {
    const s = new Set<string>()
    for (let i = 0; i < str.length - 1; i++) {
        s.add(str.slice(i, i + 2))
    }
    return s
}

function diceSimilarity(a: string, b: string): number {
    if (a === b) return 1
    if (a.length < 2 || b.length < 2) return 0
    const biA = bigrams(a)
    const biB = bigrams(b)
    let intersection = 0
    biA.forEach((bg) => { if (biB.has(bg)) intersection++ })
    return (2 * intersection) / (biA.size + biB.size)
}

// ── Matching principal ────────────────────────────────────────────────────────

const THRESHOLD = 0.4  // similitud mínima para aceptar como match

export function matchMunicipio(input: string): MatchResult | null {
    if (!input || input.trim() === "") return null

    const normalized = normalize(input)

    let bestMatch: MunicipioEntry | null = null
    let bestScore = 0

    for (const m of catalogo) {
        const mNorm = normalize(m.nombre)

        // Exacta
        if (mNorm === normalized) {
            return { found: true, nombre: m.nombre, id: m.id, score: 1 }
        }

        // Contención
        if (mNorm.includes(normalized) || normalized.includes(mNorm)) {
            const score = 0.85
            if (score > bestScore) { bestScore = score; bestMatch = m }
            continue
        }

        // Bigramas
        const score = diceSimilarity(normalized, mNorm)
        if (score > bestScore) { bestScore = score; bestMatch = m }
    }

    if (!bestMatch || bestScore < THRESHOLD) {
        return { found: false, nombre: "", id: 0, score: bestScore }
    }

    return {
        found: true,
        nombre: bestMatch.nombre,
        id: bestMatch.id,
        score: bestScore,
        warning: bestScore < 0.85
            ? `Aproximado: "${bestMatch.nombre}" (${Math.round(bestScore * 100)}% similitud)`
            : undefined,
    }
}

export function matchLocalidad(input: string, municipioId?: number): MatchResult | null {
    if (!input || input.trim() === "") return null

    const normalized = normalize(input)

    // Si tenemos municipioId, buscar solo en ese municipio primero
    const municipio = municipioId
        ? catalogo.find((m) => m.id === municipioId)
        : null

    const searchPool: { localidad: LocalidadEntry; municipioNombre: string }[] = []

    if (municipio) {
        // Buscar primero en el municipio específico
        municipio.localidades.forEach((loc) =>
            searchPool.push({ localidad: loc, municipioNombre: municipio.nombre })
        )
    } else {
        // Buscar en todos los municipios
        catalogo.forEach((m) =>
            m.localidades.forEach((loc) =>
                searchPool.push({ localidad: loc, municipioNombre: m.nombre })
            )
        )
    }

    let bestEntry: { localidad: LocalidadEntry; municipioNombre: string } | null = null
    let bestScore = 0

    for (const entry of searchPool) {
        const locNorm = normalize(entry.localidad.nombre)

        if (locNorm === normalized) {
            return {
                found: true,
                nombre: entry.localidad.nombre,
                id: entry.localidad.id,
                score: 1,
            }
        }

        if (locNorm.includes(normalized) || normalized.includes(locNorm)) {
            const score = 0.85
            if (score > bestScore) { bestScore = score; bestEntry = entry }
            continue
        }

        const score = diceSimilarity(normalized, locNorm)
        if (score > bestScore) { bestScore = score; bestEntry = entry }
    }

    // Si no encontró en el municipio específico, buscar en todos
    if ((!bestEntry || bestScore < THRESHOLD) && municipioId) {
        return matchLocalidad(input)  // retry sin municipioId
    }

    if (!bestEntry || bestScore < THRESHOLD) {
        return { found: false, nombre: "", id: 0, score: bestScore }
    }

    return {
        found: true,
        nombre: bestEntry.localidad.nombre,
        id: bestEntry.localidad.id,
        score: bestScore,
        warning: bestScore < 0.85
            ? `Aproximado: "${bestEntry.localidad.nombre}" (${Math.round(bestScore * 100)}% similitud)`
            : undefined,
    }
}

// ── Helper para procesar ambos campos con intercambio si similitud < 95% ──────

export interface GeoMatchResult {
    municipio: MatchResult | null
    localidad: MatchResult | null
}

// Obtiene el score real de un match (sin umbral de corte)
function rawMunicipioScore(input: string): { match: typeof catalogo[0] | null; score: number } {
    if (!input || input.trim() === "") return { match: null, score: 0 }
    const normalized = normalize(input)
    let bestMatch: typeof catalogo[0] | null = null
    let bestScore = 0
    for (const m of catalogo) {
        const mNorm = normalize(m.nombre)
        if (mNorm === normalized) return { match: m, score: 1 }
        if (mNorm.includes(normalized) || normalized.includes(mNorm)) {
            if (0.85 > bestScore) { bestScore = 0.85; bestMatch = m }
            continue
        }
        const score = diceSimilarity(normalized, mNorm)
        if (score > bestScore) { bestScore = score; bestMatch = m }
    }
    return { match: bestMatch, score: bestScore }
}

const SWAP_THRESHOLD = 0.95  // si el municipio no llega al 95%, intentar con localidad

export function matchGeo(municipioInput: string, localidadInput: string): GeoMatchResult {
    // Intento normal
    const municipioResult = matchMunicipio(municipioInput)
    const localidadResult = matchLocalidad(
        localidadInput,
        municipioResult?.found ? municipioResult.id : undefined
    )

    // Si municipio ya tiene >= 95% de similitud, no hace falta intercambiar
    const municipioScore = rawMunicipioScore(municipioInput).score
    if (municipioScore >= SWAP_THRESHOLD) {
        return { municipio: municipioResult, localidad: localidadResult }
    }

    // Intentar con los valores intercambiados
    const swappedMunicipioScore = rawMunicipioScore(localidadInput).score

    if (swappedMunicipioScore > municipioScore) {
        // El campo localidad matchea mejor como municipio — intercambiar
        const swappedMunicipio = matchMunicipio(localidadInput)
        const swappedLocalidad = matchLocalidad(
            municipioInput,
            swappedMunicipio?.found ? swappedMunicipio.id : undefined
        )

        // Agregar nota de que se intercambiaron
        if (swappedMunicipio?.found) {
            swappedMunicipio.warning = [
                swappedMunicipio.warning,
                `Campos municipio/localidad intercambiados (${Math.round(swappedMunicipioScore * 100)}% vs ${Math.round(municipioScore * 100)}%)`
            ].filter(Boolean).join(" — ")
        }

        return { municipio: swappedMunicipio, localidad: swappedLocalidad }
    }

    // El intercambio no mejoró — usar resultado original
    return { municipio: municipioResult, localidad: localidadResult }
}

// ── Matching de ocupaciones ───────────────────────────────────────────────────

const OCUPACIONES = [
    { id: 64, nombre: "AGENTE DE POLICÍA" },
    { id: 63, nombre: "AGENTE MUNICIPAL" },
    { id: 1,  nombre: "AGRICULTOR" },
    { id: 49, nombre: "ALBAÑIL" },
    { id: 25, nombre: "AMA DE CASA" },
    { id: 7,  nombre: "APICULTOR" },
    { id: 18, nombre: "ARTESANO" },
    { id: 26, nombre: "ARTISTA" },
    { id: 24, nombre: "ASEADOR DE CALZADO" },
    { id: 33, nombre: "AUTORIDAD COMUNAL" },
    { id: 32, nombre: "AUTORIDAD EJIDAL" },
    { id: 17, nombre: "AUXILIAR DE SALUD" },
    { id: 2,  nombre: "CAMPESINO" },
    { id: 22, nombre: "CARPINTERO" },
    { id: 13, nombre: "CHOFER" },
    { id: 19, nombre: "COMERCIANTE AMBULANTE Y ESTABLECIDO" },
    { id: 9,  nombre: "COMUNERO" },
    { id: 27, nombre: "DEPORTISTA" },
    { id: 36, nombre: "DESEMPLEADO" },
    { id: 31, nombre: "DIPUTADO" },
    { id: 55, nombre: "DIRECTOR (A) DE ESCUELA" },
    { id: 28, nombre: "DIRIGENTE DE ORGANIZACION" },
    { id: 3,  nombre: "EJIDATARIO" },
    { id: 16, nombre: "EMPLEADO" },
    { id: 20, nombre: "EMPRESARIO E INVERSIONISTA" },
    { id: 60, nombre: "ENCARGADO (A)" },
    { id: 51, nombre: "ESTATAL" },
    { id: 23, nombre: "ESTILISTA" },
    { id: 29, nombre: "ESTUDIANTE" },
    { id: 52, nombre: "FEDERAL" },
    { id: 4,  nombre: "GANADERO" },
    { id: 45, nombre: "GESTOR COMUNITARIO" },
    { id: 8,  nombre: "GRANJERO" },
    { id: 41, nombre: "INTEGRANTE DE ASOCIACIÓN" },
    { id: 47, nombre: "INTEGRANTE DE BANDA DE MÚSICA" },
    { id: 38, nombre: "INTEGRANTE DE COMITE" },
    { id: 43, nombre: "INTEGRANTE DE GRUPO" },
    { id: 44, nombre: "INTEGRANTE DE PARTIDOS POLÍTICO" },
    { id: 40, nombre: "INTEGRANTE DE PATRONATO" },
    { id: 37, nombre: "INTEGRANTE DE SOCIEDAD" },
    { id: 58, nombre: "INTEGRANTE DEL COMITE DE PADRES DE FAMILIA" },
    { id: 5,  nombre: "JORNALERO" },
    { id: 30, nombre: "JUBILADO Y PENSIONADO" },
    { id: 10, nombre: "LANCHERO" },
    { id: 46, nombre: "LOCUTOR" },
    { id: 50, nombre: "MARINO" },
    { id: 11, nombre: "OBRERO" },
    { id: 12, nombre: "OFICINISTA" },
    { id: 54, nombre: "ORGANISMOS DESCENTRALIZADOS" },
    { id: 61, nombre: "PADRES DE FAMILIA" },
    { id: 42, nombre: "PARROCO (CLERO)" },
    { id: 39, nombre: "PERIODISTA" },
    { id: 6,  nombre: "PESCADOR" },
    { id: 48, nombre: "POLICIA" },
    { id: 35, nombre: "PRESIDENTE DE COLONIA" },
    { id: 53, nombre: "PRESIDENTE MUNICIPAL" },
    { id: 14, nombre: "PROFESIONISTA" },
    { id: 56, nombre: "PROFESOR" },
    { id: 57, nombre: "RECTOR" },
    { id: 34, nombre: "SENADOR" },
    { id: 59, nombre: "SUBDIRECTOR (A)" },
    { id: 62, nombre: "SUPERVISOR DE ZONA ESCOLAR" },
    { id: 15, nombre: "TAXISTA" },
    { id: 21, nombre: "VENDEDOR Y COMISIONISTA" },
]

export interface OcupacionMatchResult {
    found: boolean
    nombre: string   // nombre exacto del catálogo
    id: number
    original: string // lo que detectó la IA (para usarlo como cargo si no encontró)
}

export function matchOcupacion(input: string): OcupacionMatchResult {
    const original = input
    if (!input || input.trim() === "") {
        return { found: false, nombre: "", id: 0, original }
    }

    const normalized = normalize(input)

    let bestMatch: typeof OCUPACIONES[0] | null = null
    let bestScore = 0

    for (const o of OCUPACIONES) {
        const oNorm = normalize(o.nombre)

        if (oNorm === normalized) {
            return { found: true, nombre: o.nombre, id: o.id, original }
        }

        if (oNorm.includes(normalized) || normalized.includes(oNorm)) {
            const score = 0.85
            if (score > bestScore) { bestScore = score; bestMatch = o }
            continue
        }

        const score = diceSimilarity(normalized, oNorm)
        if (score > bestScore) { bestScore = score; bestMatch = o }
    }

    // Umbral más alto para ocupaciones — queremos estar muy seguros
    const OCUPACION_THRESHOLD = 0.55

    if (!bestMatch || bestScore < OCUPACION_THRESHOLD) {
        return { found: false, nombre: "", id: 0, original }
    }

    return { found: true, nombre: bestMatch.nombre, id: bestMatch.id, original }
}