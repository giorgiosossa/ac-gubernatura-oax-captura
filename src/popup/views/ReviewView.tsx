// popup/views/ReviewView.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Pantalla 2: muestra los datos extraídos por la IA en una lista editable.
// El usuario puede corregir cualquier campo antes de rellenar.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Wand2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ExtractedData } from "../services/extractData"

// Mapeo de campos extraídos → selectores del formulario
// Esto conecta los datos de la IA con los campos del filler
export const FIELD_MAP: {
    key: keyof ExtractedData
    label: string
    section: "personal" | "documento" | "peticion"
    type?: "textarea"
}[] = [
    // ── Datos personales ──
    { key: "curp",             label: "CURP",             section: "personal" },
    { key: "nombre",           label: "Nombre",           section: "personal" },
    { key: "apellido_paterno", label: "Apellido Paterno", section: "personal" },
    { key: "apellido_materno", label: "Apellido Materno", section: "personal" },
    { key: "genero",           label: "Género",           section: "personal" },
    { key: "edad",             label: "Edad",             section: "personal" },
    { key: "profesion",        label: "Profesión",        section: "personal" },
    { key: "ocupacion",        label: "Ocupación",        section: "personal" },
    { key: "correo_personal",  label: "Correo Personal",  section: "personal" },
    { key: "telefono",         label: "Teléfono",         section: "personal" },
    { key: "celular",          label: "Celular",          section: "personal" },
    { key: "cargo",            label: "Cargo",            section: "personal" },
    { key: "municipio",        label: "Municipio",        section: "personal" },
    { key: "localidad",        label: "Localidad",        section: "personal" },
    { key: "colonia",          label: "Colonia",          section: "personal" },
    { key: "calle",            label: "Calle",            section: "personal" },
    { key: "numero_exterior",  label: "Núm. Exterior",    section: "personal" },
    { key: "numero_interior",  label: "Núm. Interior",    section: "personal" },
    // ── Documento (modal) ──
    { key: "fecha_documento",  label: "Fecha Documento",  section: "documento" },
    { key: "fecha_recepcion",  label: "Fecha Recepción",  section: "documento" },
    { key: "dirigido_a",       label: "Dirigido A",       section: "documento" },
    { key: "municipio_modal",  label: "Municipio",        section: "documento" },
    { key: "localidad_modal",  label: "Localidad",        section: "documento" },
    // ── Petición ──
    { key: "clasificacion",    label: "Clasificación (1-5)", section: "peticion" },
    { key: "requiere",         label: "¿Qué requiere?",   section: "peticion" },
    { key: "descripcion",      label: "Descripción",      section: "peticion", type: "textarea" },
]

const SECTION_LABELS = {
    personal:  "👤 Datos personales",
    documento: "📄 Modal documento",
    peticion:  "📋 Petición",
}

const SECTION_COLORS = {
    personal:  "bg-blue-50 text-blue-700 border-blue-200",
    documento: "bg-amber-50 text-amber-700 border-amber-200",
    peticion:  "bg-purple-50 text-purple-700 border-purple-200",
}

interface Props {
    data: ExtractedData
    onBack: () => void
    onFill: (data: ExtractedData) => void
}

export function ReviewView({ data, onBack, onFill }: Props) {
    const [edited, setEdited] = useState<ExtractedData>({ ...data })

    const handleChange = (key: keyof ExtractedData, value: string) => {
        setEdited((prev) => ({ ...prev, [key]: value }))
    }

    // Agrupar campos por sección
    const sections = (["personal", "documento", "peticion"] as const)

    return (
        <div className="flex flex-col gap-4">

            {/* Info banner */}
            <div className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                ✨ La IA extrajo los siguientes datos. Revisa y corrige si es necesario antes de rellenar.
            </div>

            {/* Campos agrupados por sección */}
            {sections.map((section) => {
                const fields = FIELD_MAP.filter((f) => f.section === section)
                const hasValues = fields.some((f) => edited[f.key])

                return (
                    <div key={section} className="flex flex-col gap-2">
                        {/* Header de sección */}
                        <div className={cn(
                            "flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-semibold",
                            SECTION_COLORS[section]
                        )}>
                            {SECTION_LABELS[section]}
                            {!hasValues && (
                                <Badge variant="outline" className="ml-auto text-[10px] py-0">
                                    sin datos
                                </Badge>
                            )}
                        </div>

                        {/* Campos */}
                        <div className="flex flex-col gap-2 pl-1">
                            {fields.map((field) => (
                                <div key={field.key} className="flex flex-col gap-1">
                                    <label className="text-xs font-medium text-muted-foreground">
                                        {field.label}
                                    </label>
                                    {field.type === "textarea" ? (
                                        <Textarea
                                            value={edited[field.key] || ""}
                                            onChange={(e) => handleChange(field.key, e.target.value)}
                                            className="text-xs min-h-[60px] resize-none"
                                            placeholder="Sin datos extraídos"
                                        />
                                    ) : (
                                        <Input
                                            value={edited[field.key] || ""}
                                            onChange={(e) => handleChange(field.key, e.target.value)}
                                            className={cn(
                                                "text-xs h-8",
                                                !edited[field.key] && "border-dashed text-muted-foreground"
                                            )}
                                            placeholder="Sin datos extraídos"
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )
            })}

            {/* Advertencias de matching */}
            {data._warnings && data._warnings.length > 0 && (
                <div className="flex flex-col gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                    <p className="text-xs font-semibold text-amber-700">⚠ Advertencias del catálogo:</p>
                    {data._warnings.map((w, i) => (
                        <p key={i} className="text-xs text-amber-600">• {w}</p>
                    ))}
                </div>
            )}

            {/* Acciones */}
            <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={onBack} className="gap-1.5">
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Volver
                </Button>
                <Button size="sm" className="flex-1 gap-1.5" onClick={() => onFill(edited)}>
                    <Wand2 className="h-3.5 w-3.5" />
                    Rellenar formulario
                </Button>
            </div>

        </div>
    )
}