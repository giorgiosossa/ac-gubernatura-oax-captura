// popup/steps/StepSolicitud.tsx

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
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

interface Props {
    values: Record<string, string>
    onChange: (selector: string, value: string) => void
}

export function StepSolicitud({ values, onChange }: Props) {
    return (
        <Tabs defaultValue="main">
            <TabsList>
                <TabsTrigger value="main">Datos personales</TabsTrigger>
                <TabsTrigger value="modal">Modal doc.</TabsTrigger>
            </TabsList>

            <TabsContent value="main" className="flex flex-col gap-3">
                {SECTION_MAIN.map((field) => (
                    <FieldRow
                        key={field.selector}
                        field={field}
                        value={values[field.selector] || ""}
                        onChange={onChange}
                    />
                ))}
            </TabsContent>

            <TabsContent value="modal" className="flex flex-col gap-3">
                {SECTION_MODAL.map((field) => (
                    <FieldRow
                        key={field.selector}
                        field={field}
                        value={values[field.selector] || ""}
                        onChange={onChange}
                    />
                ))}
            </TabsContent>
        </Tabs>
    )
}