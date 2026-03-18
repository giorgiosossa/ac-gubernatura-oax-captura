// popup/App.tsx

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScanLine, FormInput, ArrowLeft } from "lucide-react"
import { detectStep, type PageStep, type FillResult } from "./types"
import { StepSolicitud, SOLICITUD_FIELDS } from "./steps/StepSolicitud"
import { StepPeticion, PETICION_FIELDS } from "./steps/StepPeticion"
import { UploadView } from "./views/UploadView"
import { ReviewView, FIELD_MAP } from "./views/ReviewView"
import { fillSolicitud } from "./filler/fillSolicitud"
import { fillPeticion } from "./filler/fillPeticion"
import { cn } from "@/lib/utils"
import type { ExtractedData } from "./services/extractData"

// ── Mapeo de ExtractedData → selectores del formulario ────────────────────────
// Conecta los campos que devuelve la IA con los keys que usa el filler
function mapExtractedToValues(data: ExtractedData): Record<string, string> {
    return {
        "#curp":            data.curp,
        "#nombre":          data.nombre,
        "#apellidoPaterno": data.apellido_paterno,
        "#apellidoMaterno": data.apellido_materno,
        "genero":           data.genero,
        "#edad":            data.edad,
        "#profesion":       data.profesion,
        "ocupacion":        data.ocupacion,
        "#correoPersonal":  data.correo_personal,
        "#telefono":        data.telefono,
        "#celular":         data.celular,
        "#cargo":           data.cargo,
        "municipio":        data.municipio,
        "localidad":        data.localidad,
        "#colonia":         data.colonia,
        "#calle":           data.calle,
        "#numeroExterior":  data.numero_exterior,
        "#numeroInterior":  data.numero_interior,
        // Modal documento
        "fechaDoc":         data.fecha_documento,
        "fechaRecep":       data.fecha_recepcion,
        "#dirigidoA":       data.dirigido_a,
        "modal_municipio":  data.municipio_modal,
        "modal_localidad":  data.localidad_modal,
        // Petición
        "#clasificacion":   data.clasificacion,
        "#requiere":        data.requiere,
        "#descripcion":     data.descripcion,
    }
}

const ALL_FIELDS = [...SOLICITUD_FIELDS, ...PETICION_FIELDS]

const DEFAULT_VALUES: Record<string, string> = Object.fromEntries(
    ALL_FIELDS.map((f) => [f.selector, ""])
)

type AppView = "manual" | "upload" | "review"

export default function App() {
    const [view, setView]               = useState<AppView>("manual")
    const [values, setValues]           = useState<Record<string, string>>(DEFAULT_VALUES)
    const [results, setResults]         = useState<FillResult[]>([])
    const [status, setStatus]           = useState<"idle" | "filling" | "done" | "error">("idle")
    const [currentStep, setCurrentStep] = useState<PageStep>("unknown")
    const [section, setSection]         = useState<"main" | "modal">("main")
    const [extractedData, setExtractedData] = useState<ExtractedData | null>(null)

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

    const handleFill = async (valuesToFill?: Record<string, string>) => {
        setStatus("filling")
        setResults([])
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (!tab.id) return

        const finalValues = valuesToFill ?? values
        await chrome.storage.local.set({ formValues: finalValues })

        const fillerFn = currentStep === "step2" ? fillPeticion : fillSolicitud

        const injectionResults = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: fillerFn,
            args: [finalValues],
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
        // Volver a vista manual para ver los resultados
        setView("manual")
    }

    // Cuando la IA extrae los datos → ir a revisión
    const handleExtracted = (data: ExtractedData) => {
        setExtractedData(data)
        setView("review")
    }

    // Cuando el usuario confirma la revisión → mapear y rellenar
    const handleReviewFill = (data: ExtractedData) => {
        const mapped = mapExtractedToValues(data)
        setValues(mapped)
        handleFill(mapped)
    }

    const stepLabel =
        currentStep === "step1" ? "Solicitud"
            : currentStep === "step2" ? "Petición"
                : "Sin detectar"

    const stepColor =
        currentStep === "step1" ? "bg-green-100 text-green-700"
            : currentStep === "step2" ? "bg-amber-100 text-amber-700"
                : "bg-muted text-muted-foreground"

    const isStep1 = currentStep !== "step2"

    return (
        <div className="w-[400px] h-[580px] flex flex-col bg-background overflow-hidden">

            {/* ── Header ── */}
            <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
                <span className="text-xl">🧩</span>
                <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-bold text-foreground leading-tight">Form Filler</h2>
                    <p className="text-xs text-muted-foreground leading-tight">Rellena el formulario automáticamente</p>
                </div>
                <span className={cn("text-xs px-2.5 py-1 rounded-full font-medium shrink-0", stepColor)}>
          {stepLabel}
        </span>

                {/* Toggle manual / IA */}
                {view !== "review" && (
                    <Button
                        variant={view === "upload" ? "default" : "outline"}
                        size="sm"
                        className="h-7 px-2 gap-1 text-xs shrink-0"
                        onClick={() => setView(view === "upload" ? "manual" : "upload")}
                    >
                        {view === "upload"
                            ? <><FormInput className="h-3 w-3" /> Manual</>
                            : <><ScanLine className="h-3 w-3" /> IA</>
                        }
                    </Button>
                )}

                {/* Botón volver desde review */}
                {view === "review" && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 gap-1 text-xs shrink-0"
                        onClick={() => setView("upload")}
                    >
                        <ArrowLeft className="h-3 w-3" /> Volver
                    </Button>
                )}
            </div>

            {/* ── Tabs (solo en vista manual step1) ── */}
            {view === "manual" && isStep1 && (
                <div className="px-4 pt-3 shrink-0">
                    <Tabs value={section} onValueChange={(v) => setSection(v as "main" | "modal")}>
                        <TabsList className="w-full grid grid-cols-2">
                            <TabsTrigger value="main" className="text-xs">👤 Datos personales</TabsTrigger>
                            <TabsTrigger value="modal" className="text-xs">📄 Modal doc.</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            )}

            {/* ── Contenido scrolleable ── */}
            <div className="flex-1 overflow-y-auto px-4 py-3">

                {/* Vista upload (IA) */}
                {view === "upload" && (
                    <UploadView onExtracted={handleExtracted} />
                )}

                {/* Vista review */}
                {view === "review" && extractedData && (
                    <ReviewView
                        data={extractedData}
                        onBack={() => setView("upload")}
                        onFill={handleReviewFill}
                    />
                )}

                {/* Vista manual */}
                {view === "manual" && (
                    <>
                        {isStep1 ? (
                            <StepSolicitud section={section} values={values} onChange={handleChange} />
                        ) : (
                            <StepPeticion values={values} onChange={handleChange} />
                        )}
                    </>
                )}

                {/* Resultados */}
                {results.length > 0 && (
                    <div className="mt-3 rounded-lg border bg-card p-3 flex flex-col gap-1">
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

            {/* ── Footer fijo (solo en vista manual) ── */}
            {view === "manual" && (
                <div className="flex gap-2 px-4 py-3 border-t bg-background shrink-0">
                    <Button variant="outline" size="sm" onClick={handleSave} className="gap-1.5">
                        💾 Guardar
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleClear}
                        className="gap-1.5 text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/60 hover:bg-destructive/5"
                    >
                        🗑 Limpiar
                    </Button>
                    <Button
                        size="sm"
                        className="flex-1 gap-1.5"
                        onClick={() => handleFill()}
                        disabled={status === "filling"}
                    >
                        {status === "filling" ? "⏳ Rellenando..." : "🚀 Rellenar"}
                    </Button>
                </div>
            )}

        </div>
    )
}