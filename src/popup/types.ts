// popup/types.ts

export interface FillResult {
    label: string
    success: boolean
    detail?: string
}

export type PageStep = "step1" | "step2" | "unknown"

export interface FieldDef {
    selector: string
    label: string
    type: string
}

export function detectStep(url: string): PageStep {
    // URL 1: https://siac.oaxaca.gob.mx/request/evento/426/tipo/individual
    if (url.includes("/request/evento/")) return "step1"
    // URL 2: https://siac.oaxaca.gob.mx/request/7605/peticion/add
    if (url.includes("/peticion/add")) return "step2"
    return "unknown"
}