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

// ── Helper para procesar ambos campos de golpe ────────────────────────────────

export interface GeoMatchResult {
    municipio: MatchResult | null
    localidad: MatchResult | null
}

export function matchGeo(municipioInput: string, localidadInput: string): GeoMatchResult {
    const municipioResult = matchMunicipio(municipioInput)
    const localidadResult = matchLocalidad(
        localidadInput,
        municipioResult?.found ? municipioResult.id : undefined
    )
    return { municipio: municipioResult, localidad: localidadResult }
}