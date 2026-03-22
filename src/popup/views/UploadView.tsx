import { useCallback, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { extractDataFromImage, type ExtractedData } from "../services/extractData"

interface Props {
    onExtracted: (data: ExtractedData) => void
    lastData: ExtractedData | null
    onViewLast: () => void
}

export function UploadView({ onExtracted, lastData, onViewLast }: Props) {
    const [dragOver, setDragOver] = useState(false)
    const [preview, setPreview]   = useState<string>("")
    const [base64, setBase64]     = useState<string>("")
    const [loading, setLoading]   = useState(false)
    const [error, setError]       = useState<string>("")

    const processFile = useCallback((file: File) => {
        if (!file.type.startsWith("image/")) {
            setError("El archivo debe ser una imagen.")
            return
        }
        setError("")
        setPreview(URL.createObjectURL(file))
        const reader = new FileReader()
        reader.onload = (e) => setBase64(e.target?.result as string)
        reader.readAsDataURL(file)
    }, [])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files[0]
        if (file) processFile(file)
    }, [processFile])

    const handleAnalyze = async () => {
        if (!base64) return
        setLoading(true)
        setError("")
        try {
            const data = await extractDataFromImage(base64)
            onExtracted(data)
        } catch (e: any) {
            setError(e.message || "Error al analizar la imagen.")
        } finally {
            setLoading(false)
        }
    }

    // Nombre del último registro para mostrar en el botón
    const lastLabel = lastData
        ? [lastData.nombre, lastData.apellido_paterno].filter(Boolean).join(" ") || "Último escaneo"
        : null

    return (
        <div className="flex flex-col gap-3">

            {/* Drop zone */}
            <div
                className={cn(
                    "relative rounded-2xl border-2 border-dashed transition-all cursor-pointer overflow-hidden aspect-[4/3]",
                    dragOver
                        ? "border-foreground bg-foreground/5"
                        : "border-border hover:border-foreground/30"
                )}
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onClick={() => document.getElementById("fileUpload")?.click()}
            >
                <input
                    id="fileUpload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f) }}
                />

                {preview ? (
                    <img
                        src={preview}
                        alt="Documento"
                        className="w-full h-full object-contain"
                    />
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                            <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                      d="M12 16v-8m0 0-3 3m3-3 3 3M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1" />
                            </svg>
                        </div>
                        <p className="text-sm font-medium text-foreground">Arrastra el documento</p>
                        <p className="text-xs text-muted-foreground">o haz click para seleccionar</p>
                    </div>
                )}
            </div>

            {/* Error */}
            {error && (
                <p className="text-xs text-destructive px-1">{error}</p>
            )}

            {/* Botón analizar */}
            <Button
                onClick={handleAnalyze}
                disabled={!base64 || loading}
                className="w-full h-10 rounded-xl"
                variant={base64 ? "default" : "secondary"}
            >
                {loading ? (
                    <span className="flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Analizando...
          </span>
                ) : "Analizar documento"}
            </Button>

            {/* Botón ver última solicitud */}
            {lastLabel && (
                <button
                    onClick={onViewLast}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors group"
                >
                    <div className="flex flex-col items-start gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Último escaneo
            </span>
                        <span className="text-xs font-medium text-foreground">
              {lastLabel}
            </span>
                    </div>
                    <svg
                        className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors"
                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            )}

        </div>
    )
}