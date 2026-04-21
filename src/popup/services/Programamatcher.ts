// popup/services/programaMatcher.ts
// ─────────────────────────────────────────────────────────────────────────────
// Matching fuzzy de programa, subprograma y proyecto contra el catálogo oficial.
// La IA devuelve texto libre, este módulo lo convierte a IDs exactos.
//
// Estructura real del JSON:
// { id, programa, subprogramas: [{ id, programa: {...}, subprograma, proyectos: [{ id, subprograma: {...}, proyecto }] }] }
// ─────────────────────────────────────────────────────────────────────────────

import catalogoRaw from "./catalogoProgramas.json"

// ── Tipos que reflejan la estructura REAL del JSON ────────────────────────────

interface ProyectoRaw {
    id: number
    subprograma: any
    proyecto: string
}

interface SubprogramaRaw {
    id: number
    programa: any
    subprograma: string
    proyectos: ProyectoRaw[]
}

interface ProgramaRaw {
    id: number
    programa: string
    subprogramas: SubprogramaRaw[]
}

// ── Tipos normalizados internos (con campo "nombre" unificado) ─────────────────

interface ProyectoNorm    { id: number; nombre: string }
interface SubprogramaNorm { id: number; nombre: string; proyectos: ProyectoNorm[] }
interface ProgramaNorm    { id: number; nombre: string; subprogramas: SubprogramaNorm[] }

// ── Normalizar catálogo al formato interno ────────────────────────────────────

function normalizarCatalogo(raw: ProgramaRaw[]): ProgramaNorm[] {
    return raw.map(p => ({
        id: p.id,
        nombre: p.programa,
        subprogramas: (p.subprogramas || []).map(s => ({
            id: s.id,
            nombre: s.subprograma,
            proyectos: (s.proyectos || []).map(pr => ({
                id: pr.id,
                nombre: pr.proyecto,
            })),
        })),
    }))
}

interface CatalogoRaw { programas: ProgramaRaw[] }

const catalogoData = (catalogoRaw as unknown as CatalogoRaw).programas ?? (catalogoRaw as unknown as ProgramaRaw[])
const catalogo: ProgramaNorm[] = normalizarCatalogo(catalogoData)

// ── Exportar lista plana de nombres para el prompt de la IA ───────────────────
// Usar esto en extractDataFromImage.ts para inyectarlo en el PROMPT

export function getCatalogoParaPrompt(): string {
    const lineas: string[] = []
    for (const prog of catalogo) {
        for (const sub of prog.subprogramas) {
            if (sub.proyectos.length === 0) {
                lineas.push(`${prog.nombre} | ${sub.nombre} | -`)
            } else {
                for (const proy of sub.proyectos) {
                    lineas.push(`${prog.nombre} | ${sub.nombre} | ${proy.nombre}`)
                }
            }
        }
    }
    return lineas.join("\n")
}

// ── Normalización de texto ────────────────────────────────────────────────────

function normalize(str: string): string {
    return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " ")
}

// ── Dice coefficient ──────────────────────────────────────────────────────────

function bigrams(s: string): Set<string> {
    const result = new Set<string>()
    for (let i = 0; i < s.length - 1; i++) result.add(s.slice(i, i + 2))
    return result
}

function dice(a: string, b: string): number {
    if (a === b) return 1
    if (a.length < 2 || b.length < 2) return 0
    const ba = bigrams(a), bb = bigrams(b)
    let inter = 0
    ba.forEach((bg) => { if (bb.has(bg)) inter++ })
    return (2 * inter) / (ba.size + bb.size)
}

function bestMatch<T extends { nombre: string }>(
    input: string,
    items: T[],
    threshold = 0.35
): { item: T; score: number } | null {
    if (!input || items.length === 0) return null
    const norm = normalize(input)
    let best: T | null = null
    let bestScore = 0

    for (const item of items) {
        const iNorm = normalize(item.nombre)
        if (iNorm === norm) return { item, score: 1 }
        if (iNorm.includes(norm) || norm.includes(iNorm)) {
            const score = 0.8
            if (score > bestScore) { bestScore = score; best = item }
            continue
        }
        const s = dice(norm, iNorm)
        if (s > bestScore) { bestScore = s; best = item }
    }

    if (!best || bestScore < threshold) return null
    return { item: best, score: bestScore }
}

// ── Resultado del match ───────────────────────────────────────────────────────

export interface ProgramaMatchResult {
    found:        boolean
    programa?:    { id: number; nombre: string }
    subprograma?: { id: number; nombre: string }
    proyecto?:    { id: number; nombre: string }
    warnings:     string[]
}

// ── Match principal ───────────────────────────────────────────────────────────

export function matchPrograma(
    programaInput: string,
    subprogramaInput: string,
    proyectoInput: string,
    descripcionFallback = ""
): ProgramaMatchResult {
    const warnings: string[] = []

    // 1. Buscar programa
    const searchText = programaInput || descripcionFallback
    if (!searchText) {
        return { found: false, warnings: ["Sin texto de búsqueda para programa"] }
    }

    const progMatch = bestMatch(searchText, catalogo)
    if (!progMatch) {
        warnings.push(`Programa "${programaInput}" no encontrado en catálogo`)
        return { found: false, warnings }
    }

    const programa = { id: progMatch.item.id, nombre: progMatch.item.nombre }
    if (progMatch.score < 1) {
        warnings.push(`Programa aproximado: "${progMatch.item.nombre}" (${Math.round(progMatch.score * 100)}%)`)
    }

    // 2. Buscar subprograma dentro del programa encontrado
    const subprogramasValidos = progMatch.item.subprogramas.filter(
        s => s.nombre && s.nombre.trim() !== "" && s.nombre.trim() !== "."
    )

    if (subprogramasValidos.length === 0) {
        return { found: true, programa, warnings }
    }

    const subSearch = subprogramaInput || programaInput || descripcionFallback
    const subMatch = bestMatch(subSearch, subprogramasValidos)

    if (!subMatch) {
        const fallbackSub = subprogramasValidos[0]
        warnings.push(`Subprograma inferido: "${fallbackSub.nombre}"`)
        const subprograma = { id: fallbackSub.id, nombre: fallbackSub.nombre }

        const fallbackProy = fallbackSub.proyectos[0]
        if (!fallbackProy) return { found: true, programa, subprograma, warnings }

        return {
            found: true, programa, subprograma,
            proyecto: { id: fallbackProy.id, nombre: fallbackProy.nombre },
            warnings,
        }
    }

    const subprograma = { id: subMatch.item.id, nombre: subMatch.item.nombre }
    if (subMatch.score < 1) {
        warnings.push(`Subprograma aproximado: "${subMatch.item.nombre}" (${Math.round(subMatch.score * 100)}%)`)
    }

    // 3. Buscar proyecto dentro del subprograma encontrado
    if (subMatch.item.proyectos.length === 0) {
        return { found: true, programa, subprograma, warnings }
    }

    const proySearch = proyectoInput || subprogramaInput || programaInput
    const proyMatch = bestMatch(proySearch, subMatch.item.proyectos)

    if (!proyMatch) {
        const fallbackProy = subMatch.item.proyectos[0]
        warnings.push(`Proyecto inferido: "${fallbackProy.nombre}"`)
        return {
            found: true, programa, subprograma,
            proyecto: { id: fallbackProy.id, nombre: fallbackProy.nombre },
            warnings,
        }
    }

    if (proyMatch.score < 1) {
        warnings.push(`Proyecto aproximado: "${proyMatch.item.nombre}" (${Math.round(proyMatch.score * 100)}%)`)
    }

    return {
        found: true,
        programa,
        subprograma,
        proyecto: { id: proyMatch.item.id, nombre: proyMatch.item.nombre },
        warnings,
    }
}