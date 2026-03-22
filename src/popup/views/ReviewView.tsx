import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ExtractedData } from "../services/extractData"

interface FieldItem {
    label: string
    value: string
    empty?: boolean
    warning?: boolean
}

function buildFields(data: ExtractedData): { section: string; fields: FieldItem[] }[] {
    return [
        {
            section: "Persona",
            fields: [
                { label: "Nombre",          value: [data.nombre, data.apellido_paterno, data.apellido_materno].filter(Boolean).join(" ") },
                { label: "Género",          value: data.genero },
                { label: "Edad",            value: data.edad },
                { label: "Profesión",       value: data.profesion },
                { label: "Ocupación",       value: data.ocupacion,
                    warning: !data.ocupacion && !!data.cargo },
                { label: "Cargo",           value: data.cargo },
                { label: "Correo",          value: data.correo_personal },
                { label: "Teléfono",        value: data.telefono || data.celular },
            ].filter(f => f.value || f.warning),
        },
        {
            section: "Ubicación",
            fields: [
                { label: "Municipio",  value: data.municipio },
                { label: "Localidad",  value: data.localidad },
                { label: "Colonia",    value: data.colonia },
                { label: "Calle",      value: data.calle },
            ].filter(f => f.value),
        },
        {
            section: "Documento",
            fields: [
                { label: "Fecha doc.",  value: data.fecha_documento },
                { label: "Fecha rec.",  value: data.fecha_recepcion },
                { label: "Dirigido a", value: data.dirigido_a },
                { label: "Municipio",  value: data.municipio_modal },
                { label: "Localidad",  value: data.localidad_modal },
            ].filter(f => f.value),
        },
        {
            section: "Petición",
            fields: [
                { label: "Clasificación", value: data.clasificacion },
                { label: "Requiere",      value: data.requiere },
                { label: "Descripción",   value: data.descripcion },
            ].filter(f => f.value),
        },
    ].filter(s => s.fields.length > 0)
}

interface Props {
    data: ExtractedData
    filling: boolean
    onBack: () => void
    onFill: (data: ExtractedData) => void
}

export function ReviewView({ data, filling, onBack, onFill }: Props) {
    const sections = buildFields(data)
    const hasWarnings = data._warnings && data._warnings.length > 0

    return (
        <div className="flex flex-col gap-5">

            {/* Advertencias */}
            {hasWarnings && (
                <div className="rounded-xl bg-amber-50 px-4 py-3 flex flex-col gap-1">
                    <p className="text-xs font-semibold text-amber-700 mb-0.5">
                        Echa un ojo a estos campos antes de enviarlos
                    </p>
                    {data._warnings.map((w, i) => (
                        <p key={i} className="text-xs text-amber-600 leading-relaxed">
                            {w}
                        </p>
                    ))}
                </div>
            )}

            {/* Campos por sección */}
            {sections.map((section) => (
                <div key={section.section} className="flex flex-col gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        {section.section}
                    </p>
                    <div className="rounded-xl bg-muted/40 overflow-hidden">
                        {section.fields.map((field, i) => (
                            <div
                                key={field.label}
                                className={cn(
                                    "flex items-start justify-between gap-4 px-4 py-2.5",
                                    i !== section.fields.length - 1 && "border-b border-border/40"
                                )}
                            >
                <span className="text-xs text-muted-foreground shrink-0 pt-px">
                  {field.label}
                </span>
                                <span className={cn(
                                    "text-xs text-right leading-relaxed",
                                    !field.value
                                        ? "text-muted-foreground italic"
                                        : field.warning
                                            ? "text-amber-600"
                                            : "text-foreground font-medium"
                                )}>
                  {field.value || "—"}
                </span>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            {/* Nota ocupación movida a cargo */}
            {!data.ocupacion && data.cargo && (
                <p className="text-xs text-muted-foreground px-1">
                    Ocupación no encontrada en el catálogo — valor guardado en Cargo.
                </p>
            )}

            {/* Acciones */}
            <div className="flex gap-2 pt-1">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onBack}
                    disabled={filling}
                    className="text-muted-foreground hover:text-foreground"
                >
                    Volver
                </Button>
                <Button
                    size="sm"
                    className="flex-1 h-9 rounded-xl"
                    onClick={() => onFill(data)}
                    disabled={filling}
                >
                    {filling ? (
                        <span className="flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Rellenando...
            </span>
                    ) : "Rellenar formulario"}
                </Button>
            </div>

        </div>
    )
}