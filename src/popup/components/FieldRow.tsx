// popup/components/FieldRow.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Renderiza un campo del formulario con su label, badge de tipo e input.
// Reutilizado por StepSolicitud y StepPeticion.
// ─────────────────────────────────────────────────────────────────────────────

import { Input } from "@/components/ui/input"
import { Badge, type BadgeProps } from "@/components/ui/badge"
import type { FieldDef } from "../types"

interface FieldRowProps {
    field: FieldDef
    value: string
    onChange: (selector: string, value: string) => void
}

function getBadgeVariant(type: string): BadgeProps["variant"] {
    if (type === "input" || type === "textarea") return "input"
    if (type === "calendar")                     return "calendar"
    if (type === "select-native")                return "select"
    return "autocomplete"
}

function getPlaceholder(type: string): string {
    if (type === "calendar")              return "DD/MM/YYYY"
    if (type.includes("autocomplete"))   return "Texto a buscar..."
    if (type === "select-native")        return "Número de opción (1–5)"
    return "Valor a rellenar..."
}

export function FieldRow({ field, value, onChange }: FieldRowProps) {
    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground">{field.label}</span>
                <Badge variant={getBadgeVariant(field.type)}>{field.type}</Badge>
                {field.type === "autocomplete-dependent" && (
                    <span className="text-xs text-amber-500">⚠ depende de municipio</span>
                )}
            </div>
            <Input
                type="text"
                placeholder={getPlaceholder(field.type)}
                value={value}
                onChange={(e) => onChange(field.selector, e.target.value)}
            />
        </div>
    )
}