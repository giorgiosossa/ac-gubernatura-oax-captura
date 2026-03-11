// popup/App.tsx

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { detectStep, type PageStep, type FillResult } from "./types"
import { StepSolicitud, SOLICITUD_FIELDS } from "./steps/StepSolicitud"
import { StepPeticion, PETICION_FIELDS } from "./steps/StepPeticion"
import { fillSolicitud } from "./filler/fillSolicitud"
import { fillPeticion } from "./filler/fillPeticion"
import { cn } from "@/lib/utils"

const ALL_FIELDS = [...SOLICITUD_FIELDS, ...PETICION_FIELDS]

const DEFAULT_VALUES: Record<string, string> = Object.fromEntries(
    ALL_FIELDS.map((f) => [f.selector, ""])
)

export default function App() {
    const [values, setValues]           = useState<Record<string, string>>(DEFAULT_VALUES)
    const [results, setResults]         = useState<FillResult[]>([])
    const [status, setStatus]           = useState<"idle" | "filling" | "done" | "error">("idle")
    const [currentStep, setCurrentStep] = useState<PageStep>("unknown")

    useEffect(() => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const url = tabs[0]?.url || ""
            setCurrentStep(detectStep(url))
        })
        chrome.storage.local.get("formValues", (data: { formValues?: Record<string, string> }) => {
            if (data.formValues) setValues(data.formValues)
        })
    }, [])

    const handleChange = (selector: string, value: string) => {
        setValues((prev) => ({ ...prev, [selector]: value }))
    }

    const handleSave = () => {
        chrome.storage.local.set({ formValues: values }, () => {
            setResults([{ label: "Guardado", success: true, detail: "Datos guardados ✓" }])
            setTimeout(() => setResults([]), 2000)
        })
    }

    const handleClear = () => {
        setValues(Object.fromEntries(ALL_FIELDS.map((f) => [f.selector, ""])))
        chrome.storage.local.remove("formValues")
        setResults([])
        setStatus("idle")
    }

    const handleFill = async () => {
        setStatus("filling")
        setResults([])

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (!tab.id) return
        await chrome.storage.local.set({ formValues: values })

        const fillerFn = currentStep === "step2" ? fillPeticion : fillSolicitud

        const injectionResults = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: fillerFn,
            args: [values],
        })

        const response = injectionResults?.[0]?.result as
            | { success: boolean; results: FillResult[] }
            | undefined

        if (!response) {
            setStatus("error")
            setResults([{ label: "Error", success: false, detail: "No se obtuvo respuesta" }])
            return
        }

        setResults(response.results)
        setStatus(response.results.every((r) => r.success) ? "done" : "error")
    }

    const stepLabel =
        currentStep === "step1" ? "🟢 Solicitud"
            : currentStep === "step2" ? "🟡 Petición"
                : "⚪ Sin detectar"

    return (
        <div className="w-[420px] max-h-[600px] overflow-y-auto bg-background p-4 flex flex-col gap-4">

            {/* Header */}
            <div className="flex items-center gap-3 pb-3 border-b">
                <span className="text-2xl">🧩</span>
                <div className="flex-1">
                    <h2 className="text-sm font-bold text-foreground">Form Filler</h2>
                    <p className="text-xs text-muted-foreground">Rellena el formulario automáticamente</p>
                </div>
                <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full font-medium whitespace-nowrap">
          {stepLabel}
        </span>
            </div>

            {/* Step content */}
            {currentStep === "step2" ? (
                <StepPeticion values={values} onChange={handleChange} />
            ) : (
                <StepSolicitud values={values} onChange={handleChange} />
            )}

            {/* Acciones */}
            <div className="flex gap-2 pt-3 border-t">
                <Button variant="outline" size="sm" onClick={handleSave}>
                    💾 Guardar
                </Button>
                <Button variant="outline" size="sm" onClick={handleClear}
                        className="text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/60"
                >
                    🗑 Limpiar
                </Button>
                <Button
                    size="sm"
                    className="flex-1"
                    onClick={handleFill}
                    disabled={status === "filling"}
                >
                    {status === "filling" ? "⏳ Rellenando..." : "🚀 Rellenar"}
                </Button>
            </div>

            {/* Resultados */}
            {results.length > 0 && (
                <div className="rounded-lg border bg-card p-3 flex flex-col gap-1">
                    <p className="text-xs font-semibold text-foreground mb-1">Resultados:</p>
                    {results.map((r, i) => (
                        <div key={i} className="flex items-baseline gap-1.5 text-xs">
                            <span>{r.success ? "✅" : "❌"}</span>
                            <span className={cn("font-semibold", r.success ? "text-emerald-700" : "text-destructive")}>
                {r.label}
              </span>
                            {r.detail && (
                                <span className="text-muted-foreground truncate">— {r.detail}</span>
                            )}
                        </div>
                    ))}
                </div>
            )}

        </div>
    )
}