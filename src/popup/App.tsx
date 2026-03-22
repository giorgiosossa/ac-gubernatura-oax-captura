import { useState, useEffect } from "react"
import { detectStep, type PageStep, type FillResult } from "./types"
import { UploadView } from "./views/UploadView"
import { ReviewView } from "./views/ReviewView"
import { ResultsView } from "./views/ResultsView"
import { fillSolicitud } from "./filler/fillSolicitud"
import { fillPeticion } from "./filler/fillPeticion"
import { cn } from "@/lib/utils"
import type { ExtractedData } from "./services/extractData"

function mapExtractedToValues(data: ExtractedData): Record<string, string> {
    return {
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
        "fechaDoc":         data.fecha_documento,
        "fechaRecep":       data.fecha_recepcion,
        "#dirigidoA":       data.dirigido_a,
        "modal_municipio":  data.municipio_modal,
        "modal_localidad":  data.localidad_modal,
        "#clasificacion":   data.clasificacion,
        "#requiere":        data.requiere,
        "#descripcion":     data.descripcion,
    }
}

type AppView = "upload" | "review" | "results"

export default function App() {
    const [view, setView]               = useState<AppView>("upload")
    const [currentStep, setCurrentStep] = useState<PageStep>("unknown")
    const [extractedData, setExtractedData] = useState<ExtractedData | null>(null)
    const [results, setResults]         = useState<FillResult[]>([])
    const [filling, setFilling]         = useState(false)
    const [lastData, setLastData]       = useState<ExtractedData | null>(null)

    useEffect(() => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const url = tabs[0]?.url || ""
            setCurrentStep(detectStep(url))
        })
        // Cargar último escaneo desde storage para persistir entre sesiones del popup
        chrome.storage.local.get("lastExtractedData", (stored: { lastExtractedData?: ExtractedData }) => {
            if (stored.lastExtractedData) {
                setLastData(stored.lastExtractedData)
            }
        })
    }, [])

    const handleExtracted = (data: ExtractedData) => {
        setExtractedData(data)
        setLastData(data)
        chrome.storage.local.set({ lastExtractedData: data })
        setView("review")
    }

    const handleFill = async (data: ExtractedData) => {
        setFilling(true)
        const mapped = mapExtractedToValues(data)

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (!tab.id) { setFilling(false); return }

        const fillerFn = currentStep === "step2" ? fillPeticion : fillSolicitud

        const injectionResults = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: fillerFn,
            args: [mapped],
        })

        const response = injectionResults?.[0]?.result as
            | { success: boolean; results: FillResult[] }
            | undefined

        setFilling(false)

        if (!response) {
            setResults([{ label: "Error", success: false, detail: "No se obtuvo respuesta" }])
        } else {
            setResults(response.results)
        }

        setView("results")
    }

    const stepLabel =
        currentStep === "step1" ? "Solicitud"
            : currentStep === "step2" ? "Petición"
                : "—"

    const stepColor =
        currentStep === "step1" ? "text-emerald-600"
            : currentStep === "step2" ? "text-amber-500"
                : "text-muted-foreground"

    const viewTitle =
        view === "upload"  ? "Nuevo registro"
            : view === "review"  ? "Datos encontrados"
                : "Resultados"

    return (
        <div className="w-[400px] h-[580px] flex flex-col bg-background">

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
                <div>
                    <h1 className="text-sm font-semibold text-foreground tracking-tight">
                        Atención Ciudadana de Gubernatura
                    </h1>
                    <p className="text-xs text-muted-foreground mt-0.5">{viewTitle}</p>
                </div>
                <span className={cn("text-xs font-medium", stepColor)}>
          {stepLabel}
        </span>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 pb-5">
                {view === "upload" && (
                    <UploadView
                        onExtracted={handleExtracted}
                        lastData={lastData}
                        onViewLast={() => { setExtractedData(lastData); setView("review") }}
                    />
                )}
                {view === "review" && extractedData && (
                    <ReviewView
                        data={extractedData}
                        filling={filling}
                        onBack={() => setView("upload")}
                        onFill={handleFill}
                    />
                )}
                {view === "results" && (
                    <ResultsView
                        results={results}
                        onReset={() => { setView("upload"); setExtractedData(null); setResults([]) }}
                    />
                )}
            </div>

            {/* Footer */}
            <div className="shrink-0 pb-3 text-center">
                <p className="text-[10px] text-muted-foreground/50">
                    Desarrollado por: Jorge Eduardo Sosa Perera
                </p>
            </div>
        </div>
    )
}