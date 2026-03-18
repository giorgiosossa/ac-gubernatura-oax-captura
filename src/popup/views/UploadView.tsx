// popup/views/UploadView.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Pantalla 1: el usuario arrastra o selecciona una imagen del documento.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useState } from "react"
import { Upload, FileImage, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { extractDataFromImage, type ExtractedData } from "../services/extractData"

interface Props {
    onExtracted: (data: ExtractedData) => void
}

export function UploadView({ onExtracted }: Props) {
    const [dragOver, setDragOver]     = useState(false)
    const [preview, setPreview]       = useState<string>("")
    const [base64, setBase64]         = useState<string>("")
    const [loading, setLoading]       = useState(false)
    const [error, setError]           = useState<string>("")

    const processFile = useCallback((file: File) => {
        if (!file.type.startsWith("image/")) {
            setError("El archivo debe ser una imagen.")
            return
        }
        setError("")
        setPreview(URL.createObjectURL(file))

        const reader = new FileReader()
        reader.onload = (e) => {
            setBase64(e.target?.result as string)
        }
        reader.readAsDataURL(file)
    }, [])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files[0]
        if (file) processFile(file)
    }, [processFile])

    const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
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

    return (
        <div className="flex flex-col gap-4">

            {/* Zona drag & drop */}
            <div
                className={cn(
                    "border-2 border-dashed rounded-lg p-6 cursor-pointer transition-colors flex flex-col items-center gap-3",
                    dragOver
                        ? "border-primary bg-primary/5"
                        : "border-muted-foreground/25 hover:border-muted-foreground/50"
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
                    onChange={handleFileInput}
                />

                {preview ? (
                    <img
                        src={preview}
                        alt="Preview"
                        className="max-h-44 w-full object-contain rounded-md"
                    />
                ) : (
                    <>
                        <Upload className="h-10 w-10 text-muted-foreground" />
                        <div className="text-center">
                            <p className="text-sm font-medium text-foreground">
                                Arrastra el documento aquí
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                o haz click para seleccionar una imagen
                            </p>
                        </div>
                    </>
                )}
            </div>

            {/* Preview filename */}
            {preview && !loading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted rounded-md px-3 py-2">
                    <FileImage className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Imagen lista para analizar</span>
                </div>
            )}

            {/* Error */}
            {error && (
                <p className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">
                    {error}
                </p>
            )}

            {/* Botón analizar */}
            <Button
                onClick={handleAnalyze}
                disabled={!base64 || loading}
                className="w-full gap-2"
            >
                {loading ? (
                    <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Analizando documento...
                    </>
                ) : (
                    <>
                        <FileImage className="h-4 w-4" />
                        Analizar documento
                    </>
                )}
            </Button>

        </div>
    )
}