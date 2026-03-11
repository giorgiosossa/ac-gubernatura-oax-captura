// popup/steps/StepPeticion.tsx

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { FieldDef } from "../types"

const CLASIFICACION_OPTIONS = [
    { value: "1", label: "Infraestructura" },
    { value: "2", label: "Bienestar Social" },
    { value: "3", label: "Salud" },
    { value: "4", label: "Educación" },
    { value: "5", label: "Seguridad" },
]

export const PETICION_FIELDS: FieldDef[] = [
    { selector: "#clasificacion", label: "Clasificación",  type: "select-native" },
    { selector: "#requiere",      label: "¿Qué requiere?", type: "input" },
    { selector: "#descripcion",   label: "Descripción",    type: "textarea" },
]

interface Props {
    values: Record<string, string>
    onChange: (selector: string, value: string) => void
}

export function StepPeticion({ values, onChange }: Props) {
    return (
        <div className="flex flex-col gap-4">

            {/* Clasificación */}
            <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">Clasificación</span>
                    <Badge variant="select">select-native</Badge>
                </div>

                {/* Opciones clickeables */}
                <div className="flex flex-col gap-1">
                    {CLASIFICACION_OPTIONS.map((o) => {
                        const isSelected = values["#clasificacion"] === o.value
                        return (
                            <button
                                key={o.value}
                                onClick={() => onChange("#clasificacion", o.value)}
                                className={cn(
                                    "flex items-center gap-2 rounded-md px-3 py-1.5 text-xs text-left transition-colors",
                                    isSelected
                                        ? "bg-primary text-primary-foreground font-semibold"
                                        : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                )}
                            >
                <span className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold",
                    isSelected ? "border-primary-foreground" : "border-muted-foreground"
                )}>
                  {o.value}
                </span>
                                {o.label}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* ¿Qué requiere? */}
            <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">¿Qué requiere?</span>
                    <Badge variant="input">input</Badge>
                </div>
                <Input
                    placeholder="Valor a rellenar..."
                    value={values["#requiere"] || ""}
                    onChange={(e) => onChange("#requiere", e.target.value)}
                />
            </div>

            {/* Descripción */}
            <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">Descripción</span>
                    <Badge variant="input">textarea</Badge>
                </div>
                <Textarea
                    placeholder="Descripción de la petición..."
                    value={values["#descripcion"] || ""}
                    onChange={(e) => onChange("#descripcion", e.target.value)}
                />
            </div>

        </div>
    )
}