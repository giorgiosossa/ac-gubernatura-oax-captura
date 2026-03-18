import { FieldRow } from "../components/FieldRow"
import type { FieldDef } from "../types"

const SECTION_MAIN: FieldDef[] = [
    { selector: "#curp",            label: "CURP",             type: "input" },
    { selector: "#nombre",          label: "Nombre",           type: "input" },
    { selector: "#apellidoPaterno", label: "Apellido Paterno", type: "input" },
    { selector: "#apellidoMaterno", label: "Apellido Materno", type: "input" },
    { selector: "genero",           label: "Género",           type: "autocomplete" },
    { selector: "#edad",            label: "Edad",             type: "input" },
    { selector: "#profesion",       label: "Profesión",        type: "input" },
    { selector: "ocupacion",        label: "Ocupación",        type: "autocomplete" },
    { selector: "#correoPersonal",  label: "Correo Personal",  type: "input" },
    { selector: "#telefono",        label: "Teléfono",         type: "input" },
    { selector: "#celular",         label: "Celular",          type: "input" },
    { selector: "#cargo",           label: "Cargo",            type: "input" },
    { selector: "municipio",        label: "Municipio",        type: "autocomplete" },
    { selector: "localidad",        label: "Localidad",        type: "autocomplete-dependent" },
    { selector: "#colonia",         label: "Colonia",          type: "input" },
    { selector: "#calle",           label: "Calle",            type: "input" },
    { selector: "#numeroExterior",  label: "Número Exterior",  type: "input" },
    { selector: "#numeroInterior",  label: "Número Interior",  type: "input" },
]

const SECTION_MODAL: FieldDef[] = [
    { selector: "fechaDoc",        label: "Fecha Documento",   type: "calendar" },
    { selector: "fechaRecep",      label: "Fecha Recepción",   type: "calendar" },
    { selector: "#dirigidoA",      label: "Dirigido A",        type: "input" },
    { selector: "modal_municipio", label: "Municipio (modal)", type: "autocomplete-search" },
    { selector: "modal_localidad", label: "Localidad (modal)", type: "autocomplete-search" },
]

export const SOLICITUD_FIELDS = [...SECTION_MAIN, ...SECTION_MODAL]
export const SOLICITUD_SECTIONS = { main: SECTION_MAIN, modal: SECTION_MODAL }

interface Props {
    section: "main" | "modal"
    values: Record<string, string>
    onChange: (selector: string, value: string) => void
}

// El componente solo renderiza los campos del section activo
// Los tabs viven en App.tsx para estar siempre visibles sobre el scroll
export function StepSolicitud({ section, values, onChange }: Props) {
    const fields = section === "main" ? SECTION_MAIN : SECTION_MODAL
    return (
        <div className="flex flex-col gap-3">
            {fields.map((field) => (
                <FieldRow
                    key={field.selector}
                    field={field}
                    value={values[field.selector] || ""}
                    onChange={onChange}
                />
            ))}
        </div>
    )
}