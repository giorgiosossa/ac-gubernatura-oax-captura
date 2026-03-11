import { useState, useEffect } from "react"

interface FillResult {
    label: string
    success: boolean
    detail?: string
}

// ─── Paso 1: URL tipo /request/evento/*/tipo/individual ───────────────────────
const SECTION_MAIN = [
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

const SECTION_MODAL = [
    { selector: "fechaDoc",        label: "Fecha Documento",   type: "calendar" },
    { selector: "fechaRecep",      label: "Fecha Recepción",   type: "calendar" },
    { selector: "#dirigidoA",      label: "Dirigido A",        type: "input" },
    { selector: "modal_municipio", label: "Municipio (modal)", type: "autocomplete-search" },
    { selector: "modal_localidad", label: "Localidad (modal)", type: "autocomplete-search" },
]

// ─── Paso 2: URL tipo /peticiones/*/agregar ───────────────────────────────────
const SECTION_PETICION = [
    { selector: "#clasificacion",  label: "Clasificación",     type: "select-native" },
    { selector: "#requiere",       label: "¿Qué requiere?",    type: "input" },
    { selector: "#descripcion",    label: "Descripción",       type: "textarea" },
]

const ALL_FIELDS = [...SECTION_MAIN, ...SECTION_MODAL, ...SECTION_PETICION]

const DEFAULT_VALUES: Record<string, string> = Object.fromEntries(
    ALL_FIELDS.map((f) => [f.selector, ""])
)

// ─── Detecta en qué paso está el usuario según la URL ────────────────────────
type PageStep = "step1" | "step2" | "unknown"

function detectStep(url: string): PageStep {
    // URL 1: https://siac.oaxaca.gob.mx/request/evento/426/tipo/individual
    if (url.includes("/request/evento/")) return "step1"
    // URL 2: https://siac.oaxaca.gob.mx/request/7605/peticion/add
    if (url.includes("/peticion/add")) return "step2"
    return "unknown"
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function App() {
    const [values, setValues]           = useState<Record<string, string>>(DEFAULT_VALUES)
    const [results, setResults]         = useState<FillResult[]>([])
    const [status, setStatus]           = useState<"idle" | "filling" | "done" | "error">("idle")
    const [openSection, setOpenSection] = useState<"main" | "modal" | "peticion">("main")
    const [currentStep, setCurrentStep] = useState<PageStep>("unknown")
    const [currentUrl, setCurrentUrl]   = useState("")

    useEffect(() => {
        // Detecta la URL activa al abrir el popup
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const url = tabs[0]?.url || ""
            setCurrentUrl(url)
            const step = detectStep(url)
            setCurrentStep(step)
            // Cambia el tab activo según la URL detectada
            if (step === "step2") setOpenSection("peticion")
            else setOpenSection("main")
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
            setResults([{ label: "Guardado", success: true, detail: "Datos guardados" }])
            setTimeout(() => setResults([]), 2000)
        })
    }

    const handleFill = async () => {
        setStatus("filling")
        setResults([])
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (!tab.id) return
        await chrome.storage.local.set({ formValues: values })

        const injectionResults = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: fillFormInPage,
            args: [values, currentStep],
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
    }

    const handleClear = () => {
        setValues(Object.fromEntries(ALL_FIELDS.map((f) => [f.selector, ""])))
        chrome.storage.local.remove("formValues")
        setResults([])
        setStatus("idle")
    }

    const renderFields = (fields: typeof SECTION_MAIN) =>
        fields.map((field) => (
            <div key={field.selector} style={s.fieldRow}>
                <div style={s.labelRow}>
                    <span style={s.labelText}>{field.label}</span>
                    <span style={
                        field.type === "input" || field.type === "textarea" ? s.badgeInput
                            : field.type === "calendar" ? s.badgeCalendar
                                : field.type === "select-native" ? s.badgeSelect
                                    : s.badgeAuto
                    }>
            {field.type}
          </span>
                    {field.type === "autocomplete-dependent" && (
                        <span style={s.hint}>⚠ depende de municipio</span>
                    )}
                </div>
                <input
                    style={s.input}
                    type="text"
                    placeholder={
                        field.type === "calendar" ? "DD/MM/YYYY"
                            : field.type === "select-native" ? "Número de opción (1, 2, 3...)"
                                : field.type.includes("autocomplete") ? "Texto a buscar..."
                                    : "Valor a rellenar..."
                    }
                    value={values[field.selector] || ""}
                    onChange={(e) => handleChange(field.selector, e.target.value)}
                />
            </div>
        ))

    // Badge de estado de la URL detectada
    const stepLabel =
        currentStep === "step1" ? "🟢 Formulario personal"
            : currentStep === "step2" ? "🟡 Agregar petición"
                : "⚪ URL no reconocida"

    return (
        <div style={s.container}>
            {/* Header */}
            <div style={s.header}>
                <span style={{ fontSize: 26 }}>🧩</span>
                <div style={{ flex: 1 }}>
                    <h2 style={s.title}>Form Filler</h2>
                    <p style={s.subtitle}>Rellena el formulario automáticamente</p>
                </div>
                {/* Indicador de paso detectado */}
                <span style={s.stepBadge}>{stepLabel}</span>
            </div>

            {/* Tabs — solo muestra los tabs relevantes según el paso */}
            <div style={s.tabs}>
                {currentStep !== "step2" && (
                    <>
                        <button style={openSection === "main"  ? s.tabActive : s.tabInactive} onClick={() => setOpenSection("main")}>
                            Datos personales
                        </button>
                        <button style={openSection === "modal" ? s.tabActive : s.tabInactive} onClick={() => setOpenSection("modal")}>
                            Modal doc.
                        </button>
                    </>
                )}
                {currentStep !== "step1" && (
                    <button style={openSection === "peticion" ? s.tabActive : s.tabInactive} onClick={() => setOpenSection("peticion")}>
                        Petición
                    </button>
                )}
            </div>

            {/* Campos */}
            <div style={s.fieldsContainer}>
                {openSection === "main"     && renderFields(SECTION_MAIN)}
                {openSection === "modal"    && renderFields(SECTION_MODAL)}
                {openSection === "peticion" && renderFields(SECTION_PETICION)}
            </div>

            {/* Botones */}
            <div style={s.actions}>
                <button style={s.btnSecondary} onClick={handleSave}>💾 Guardar</button>
                <button style={s.btnDanger}    onClick={handleClear}>🗑 Limpiar</button>
                <button
                    style={status === "filling" ? s.btnDisabled : s.btnPrimary}
                    onClick={handleFill}
                    disabled={status === "filling"}
                >
                    {status === "filling" ? "⏳ Rellenando..." : "🚀 Rellenar"}
                </button>
            </div>

            {/* Resultados */}
            {results.length > 0 && (
                <div style={s.resultsBox}>
                    <p style={s.resultsTitle}>Resultados:</p>
                    {results.map((r, i) => (
                        <div key={i} style={s.resultRow}>
                            <span>{r.success ? "✅" : "❌"}</span>
                            <span style={{ color: r.success ? "#065f46" : "#dc2626", fontWeight: 600 }}>
                {r.label}
              </span>
                            {r.detail && <span style={{ color: "#6b7280" }}>— {r.detail}</span>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

// ─── Función inyectada en la pestaña ─────────────────────────────────────────
function fillFormInPage(
    data: Record<string, string>,
    step: string
): Promise<{ success: boolean; results: { label: string; success: boolean; detail?: string }[] }> {

    function normalize(str: string): string {
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
    }

    function fillInput(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
        const proto = el instanceof HTMLTextAreaElement
            ? window.HTMLTextAreaElement.prototype
            : window.HTMLInputElement.prototype
        const nativeSetter = Object.getOwnPropertyDescriptor(proto, "value")?.set
        nativeSetter?.call(el, value)
        el.dispatchEvent(new Event("input",  { bubbles: true }))
        el.dispatchEvent(new Event("change", { bubbles: true }))
        el.dispatchEvent(new Event("blur",   { bubbles: true }))
        el.dispatchEvent(new FocusEvent("focusout", { bubbles: true }))
    }

    function waitForElement(selector: string, timeout = 5000): Promise<HTMLElement | null> {
        return new Promise((resolve) => {
            const existing = document.querySelector(selector) as HTMLElement | null
            if (existing) return resolve(existing)
            const observer = new MutationObserver(() => {
                const el = document.querySelector(selector) as HTMLElement | null
                if (el) { observer.disconnect(); resolve(el) }
            })
            observer.observe(document.body, { childList: true, subtree: true })
            setTimeout(() => { observer.disconnect(); resolve(null) }, timeout)
        })
    }

    async function fillAutocompleteDropdown(formControlName: string, searchText: string): Promise<{ success: boolean; detail: string }> {
        const btn = document.querySelector(
            `p-autocomplete[formcontrolname='${formControlName}'] button.p-autocomplete-dropdown`
        ) as HTMLButtonElement | null
        if (!btn) return { success: false, detail: `Botón dropdown no encontrado: "${formControlName}"` }
        document.body.click()
        await new Promise((r) => setTimeout(r, 200))
        btn.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }))
        btn.click()
        const panel = await waitForElement("ul.p-autocomplete-items", 4000)
        if (!panel) return { success: false, detail: `Panel no apareció: "${formControlName}"` }
        const items = Array.from(panel.querySelectorAll("li.p-autocomplete-item")) as HTMLElement[]
        const match =
            items.find((li) => normalize(li.getAttribute("aria-label") || li.textContent || "") === normalize(searchText)) ||
            items.find((li) => normalize(li.getAttribute("aria-label") || li.textContent || "").includes(normalize(searchText)))
        if (!match) return { success: false, detail: `"${searchText}" no encontrado` }
        match.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }))
        match.dispatchEvent(new MouseEvent("mouseup",   { bubbles: true }))
        match.click()
        return { success: true, detail: `Seleccionó: "${match.getAttribute("aria-label") || match.textContent?.trim()}"` }
    }

    async function fillAutocompleteSearch(input: HTMLInputElement, searchText: string): Promise<{ success: boolean; detail: string }> {
        input.focus()
        fillInput(input, searchText)
        const panel = await waitForElement("p-overlay ul, .p-autocomplete-panel ul, ul.p-autocomplete-items", 4000)
        if (!panel) return { success: false, detail: "Panel de búsqueda no apareció" }
        const items = Array.from(panel.querySelectorAll("li")) as HTMLElement[]
        const match =
            items.find((li) => normalize(li.textContent || "") === normalize(searchText)) ||
            items.find((li) => normalize(li.textContent || "").includes(normalize(searchText)))
        if (!match) return { success: false, detail: `"${searchText}" no encontrado` }
        match.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }))
        match.dispatchEvent(new MouseEvent("mouseup",   { bubbles: true }))
        match.click()
        return { success: true, detail: `Seleccionó: "${match.textContent?.trim()}"` }
    }

    function waitForAutocompleteEnabled(formControlName: string, timeout = 7000): Promise<HTMLElement | null> {
        const selector = `p-autocomplete[formcontrolname='${formControlName}'] div.p-autocomplete`
        return new Promise((resolve) => {
            const el = document.querySelector(selector) as HTMLElement | null
            if (el && !el.classList.contains("p-disabled")) return resolve(el)
            const observer = new MutationObserver(() => {
                const el = document.querySelector(selector) as HTMLElement | null
                if (el && !el.classList.contains("p-disabled")) { observer.disconnect(); resolve(el) }
            })
            observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] })
            setTimeout(() => { observer.disconnect(); resolve(null) }, timeout)
        })
    }

    async function fillCalendar(calendarBtnSelector: string, dateStr: string): Promise<{ success: boolean; detail: string }> {
        const parts = dateStr.split("/")
        if (parts.length !== 3) return { success: false, detail: `Formato inválido: usa DD/MM/YYYY` }
        const targetDay   = parseInt(parts[0], 10)
        const targetMonth = parseInt(parts[1], 10) - 1
        const targetYear  = parseInt(parts[2], 10)
        if (isNaN(targetDay) || isNaN(targetMonth) || isNaN(targetYear))
            return { success: false, detail: `Fecha inválida: "${dateStr}"` }
        const calBtn = document.querySelector(calendarBtnSelector) as HTMLElement | null
        if (!calBtn) return { success: false, detail: `Botón de calendario no encontrado` }
        calBtn.click()
        const panel = await waitForElement(".p-datepicker", 3000)
        if (!panel) return { success: false, detail: "Panel del calendario no apareció" }
        for (let i = 0; i < 24; i++) {
            const monthEl = panel.querySelector(".p-datepicker-month") as HTMLElement | null
            const yearEl  = panel.querySelector(".p-datepicker-year")  as HTMLElement | null
            if (!monthEl || !yearEl) break
            const monthNamesEs = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"]
            const monthNamesEn = ["january","february","march","april","may","june","july","august","september","october","november","december"]
            const currentMonthText = normalize(monthEl.textContent || "")
            const currentYear = parseInt(yearEl.textContent || "0", 10)
            let resolvedMonth = monthNamesEs.findIndex((m) => currentMonthText.includes(m))
            if (resolvedMonth < 0) resolvedMonth = monthNamesEn.findIndex((m) => currentMonthText.includes(m))
            if (resolvedMonth === targetMonth && currentYear === targetYear) break
            const currentDate = new Date(currentYear, resolvedMonth >= 0 ? resolvedMonth : 0)
            const targetDate  = new Date(targetYear, targetMonth)
            const navBtn = currentDate > targetDate
                ? panel.querySelector(".p-datepicker-prev") as HTMLElement | null
                : panel.querySelector(".p-datepicker-next") as HTMLElement | null
            if (!navBtn) break
            navBtn.click()
            await new Promise((r) => setTimeout(r, 150))
        }
        const dayCells = Array.from(panel.querySelectorAll("table tbody td:not(.p-datepicker-other-month) span")) as HTMLElement[]
        const dayCell  = dayCells.find((span) => parseInt(span.textContent || "0", 10) === targetDay)
        if (!dayCell) return { success: false, detail: `Día ${targetDay} no encontrado` }
        dayCell.click()
        return { success: true, detail: `Fecha seleccionada: "${dateStr}"` }
    }

    // ─── Rellena un <select> nativo asignando el value directamente ──────────
    // Recibe el value numérico (1, 2, 3, 4, 5) — no el texto de la opción
    function fillSelectNative(selector: string, value: string): { success: boolean; detail: string } {
        const el = document.querySelector(selector) as HTMLSelectElement | null
        if (!el) return { success: false, detail: `Select no encontrado: ${selector}` }
        const option = Array.from(el.options).find((o) => o.value === value)
        if (!option) return { success: false, detail: `Value "${value}" no existe. Opciones: ${Array.from(el.options).map(o => o.value + "=" + o.text).join(", ")}` }
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set
        nativeSetter?.call(el, value)
        el.dispatchEvent(new Event("change", { bubbles: true }))
        el.dispatchEvent(new Event("blur",   { bubbles: true }))
        return { success: true, detail: `Seleccionó: "${option.text}"` }
    }

    return (async () => {
        const results: { label: string; success: boolean; detail?: string }[] = []
        console.log("[FormFiller] data recibida:", JSON.stringify(data))

        // ════════════════════════════════════════════════════════════════════════
        // PASO 1 — Formulario personal (/request/evento/*/tipo/individual)
        // ════════════════════════════════════════════════════════════════════════
        if (step === "step1") {

            // Inputs normales
            const inputFields = [
                { selector: "#curp",            label: "CURP" },
                { selector: "#nombre",          label: "Nombre" },
                { selector: "#apellidoPaterno", label: "Apellido Paterno" },
                { selector: "#apellidoMaterno", label: "Apellido Materno" },
                { selector: "#edad",            label: "Edad" },
                { selector: "#profesion",       label: "Profesión" },
                { selector: "#correoPersonal",  label: "Correo Personal" },
                { selector: "#telefono",        label: "Teléfono" },
                { selector: "#celular",         label: "Celular" },
                { selector: "#cargo",           label: "Cargo" },
                { selector: "#colonia",         label: "Colonia" },
                { selector: "#calle",           label: "Calle" },
                { selector: "#numeroExterior",  label: "Número Exterior" },
                { selector: "#numeroInterior",  label: "Número Interior" },
            ]
            for (const field of inputFields) {
                const value = data[field.selector]
                if (!value) continue
                const el = document.querySelector(field.selector) as HTMLInputElement | null
                if (!el) { results.push({ label: field.label, success: false, detail: "No encontrado" }); continue }
                fillInput(el, value)
                results.push({ label: field.label, success: true })
            }

            if (data["genero"]) {
                results.push({ label: "Género", ...await fillAutocompleteDropdown("genero", data["genero"]) })
                await new Promise((r) => setTimeout(r, 300))
            }
            if (data["ocupacion"]) {
                results.push({ label: "Ocupación", ...await fillAutocompleteDropdown("ocupacion", data["ocupacion"]) })
                await new Promise((r) => setTimeout(r, 300))
            }
            if (data["municipio"]) {
                const mResult = await fillAutocompleteDropdown("municipio", data["municipio"])
                results.push({ label: "Municipio", ...mResult })
                if (mResult.success && data["localidad"]) {
                    const ready = await waitForAutocompleteEnabled("localidad", 7000)
                    if (!ready) {
                        results.push({ label: "Localidad", success: false, detail: "No se habilitó tras municipio" })
                    } else {
                        await new Promise((r) => setTimeout(r, 500))
                        results.push({ label: "Localidad", ...await fillAutocompleteDropdown("localidad", data["localidad"]) })
                    }
                }
            }

            // Modal
            const shouldFillModal = [data["fechaDoc"], data["fechaRecep"], data["#dirigidoA"], data["modal_municipio"], data["modal_localidad"]]
                .some((v) => v && v.trim() !== "")

            if (shouldFillModal) {
                const modalBtn = document.querySelector("fieldset:nth-of-type(4) span.p-button-label") as HTMLElement | null
                if (!modalBtn) {
                    results.push({ label: "Modal", success: false, detail: "Botón no encontrado" })
                } else {
                    modalBtn.click()
                    console.log("[FormFiller] ✅ Modal abierto")
                    const modal = await waitForElement("p-dynamicdialog", 5000)
                    if (!modal) {
                        results.push({ label: "Modal", success: false, detail: "El modal no apareció" })
                    } else {
                        results.push({ label: "Modal", success: true, detail: "Abierto correctamente" })
                        await new Promise((r) => setTimeout(r, 500))
                        console.log("[FormFiller] ✅ Modal abierto")

                        if (data["fechaDoc"]) {
                            console.log("[FormFiller] → fechaDoc:", data["fechaDoc"])
                            try {
                                const r = await fillCalendar("p-dynamicdialog form > div:nth-of-type(1) > div:nth-of-type(2) button", data["fechaDoc"])
                                console.log("[FormFiller] fechaDoc resultado:", r)
                                results.push({ label: "Fecha Documento", ...r })
                            } catch(e) {
                                console.error("[FormFiller] fechaDoc excepción:", e)
                                results.push({ label: "Fecha Documento", success: false, detail: String(e) })
                            }
                            await new Promise((r) => setTimeout(r, 300))
                        }

                        if (data["fechaRecep"]) {
                            console.log("[FormFiller] → fechaRecep:", data["fechaRecep"])
                            try {
                                const r = await fillCalendar("p-dynamicdialog form > div:nth-of-type(1) > div:nth-of-type(3) button", data["fechaRecep"])
                                console.log("[FormFiller] fechaRecep resultado:", r)
                                results.push({ label: "Fecha Recepción", ...r })
                            } catch(e) {
                                console.error("[FormFiller] fechaRecep excepción:", e)
                                results.push({ label: "Fecha Recepción", success: false, detail: String(e) })
                            }
                            await new Promise((r) => setTimeout(r, 300))
                        }

                        console.log("[FormFiller] → llegué a dirigidoA, valor:", data["#dirigidoA"])
                        if (data["#dirigidoA"]) {
                            console.log("[FormFiller] Buscando #dirigidoA...")
                            const el = await waitForElement("#dirigidoA", 6000) as HTMLInputElement | null
                            if (!el) {
                                console.log("[FormFiller] #dirigidoA NO encontrado después de 6s")
                                results.push({ label: "Dirigido A", success: false, detail: "#dirigidoA no apareció" })
                            } else {
                                console.log("[FormFiller] #dirigidoA encontrado:", el)
                                el.focus()
                                el.dispatchEvent(new Event("focus", { bubbles: true }))
                                const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set
                                nativeSetter?.call(el, data["#dirigidoA"])
                                console.log("[FormFiller] valor después de setter:", el.value)
                                el.dispatchEvent(new Event("input",  { bubbles: true }))
                                el.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }))
                                el.dispatchEvent(new KeyboardEvent("keyup",   { bubbles: true }))
                                el.dispatchEvent(new Event("change", { bubbles: true }))
                                el.dispatchEvent(new Event("blur",   { bubbles: true }))
                                el.dispatchEvent(new FocusEvent("focusout", { bubbles: true }))
                                console.log("[FormFiller] valor final en DOM:", el.value)
                                results.push({ label: "Dirigido A", success: true, detail: `DOM value: "${el.value}"` })
                            }
                        }

                        if (data["modal_municipio"]) {
                            const input = modal.querySelector("div:nth-of-type(3) > div:nth-of-type(1) p-autocomplete input") as HTMLInputElement | null
                            if (!input) results.push({ label: "Municipio (modal)", success: false, detail: "Input no encontrado" })
                            else {
                                results.push({ label: "Municipio (modal)", ...await fillAutocompleteSearch(input, data["modal_municipio"]) })
                                await new Promise((r) => setTimeout(r, 500))
                            }
                        }
                        if (data["modal_localidad"]) {
                            const input = modal.querySelector("div:nth-of-type(4) > div:nth-of-type(1) p-autocomplete input") as HTMLInputElement | null
                            if (!input) results.push({ label: "Localidad (modal)", success: false, detail: "Input no encontrado" })
                            else results.push({ label: "Localidad (modal)", ...await fillAutocompleteSearch(input, data["modal_localidad"]) })
                        }
                    }
                }
            }
        }

        // ════════════════════════════════════════════════════════════════════════
        // PASO 2 — Agregar petición (/peticiones/*/agregar)
        // ════════════════════════════════════════════════════════════════════════
        if (step === "step2") {

            // Clasificación — <select> nativo con 5 opciones
            if (data["#clasificacion"]) {
                results.push({ label: "Clasificación", ...fillSelectNative("#clasificacion", data["#clasificacion"]) })
            }

            // ¿Qué requiere? — input normal
            if (data["#requiere"]) {
                const el = await waitForElement("#requiere", 3000) as HTMLInputElement | null
                if (!el) {
                    results.push({ label: "¿Qué requiere?", success: false, detail: "#requiere no encontrado" })
                } else {
                    el.focus()
                    el.dispatchEvent(new Event("focus", { bubbles: true }))
                    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set
                    nativeSetter?.call(el, data["#requiere"])
                    el.dispatchEvent(new Event("input",  { bubbles: true }))
                    el.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }))
                    el.dispatchEvent(new KeyboardEvent("keyup",   { bubbles: true }))
                    el.dispatchEvent(new Event("change", { bubbles: true }))
                    el.dispatchEvent(new Event("blur",   { bubbles: true }))
                    el.dispatchEvent(new FocusEvent("focusout", { bubbles: true }))
                    results.push({ label: "¿Qué requiere?", success: true })
                }
            }

            // Descripción — textarea
            if (data["#descripcion"]) {
                const el = await waitForElement("#descripcion", 3000) as HTMLTextAreaElement | null
                if (!el) {
                    results.push({ label: "Descripción", success: false, detail: "#descripcion no encontrado" })
                } else {
                    el.focus()
                    el.dispatchEvent(new Event("focus", { bubbles: true }))
                    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set
                    nativeSetter?.call(el, data["#descripcion"])
                    el.dispatchEvent(new Event("input",  { bubbles: true }))
                    el.dispatchEvent(new Event("change", { bubbles: true }))
                    el.dispatchEvent(new Event("blur",   { bubbles: true }))
                    el.dispatchEvent(new FocusEvent("focusout", { bubbles: true }))
                    results.push({ label: "Descripción", success: true })
                }
            }
        }

        return { success: true, results }
    })()
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
    container:       { width: 420, maxHeight: 600, overflowY: "auto", fontFamily: "'Segoe UI', sans-serif", fontSize: 13, backgroundColor: "#f9fafb", padding: 16, boxSizing: "border-box" },
    header:          { display: "flex", alignItems: "center", gap: 10, marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid #e5e7eb" },
    title:           { margin: 0, fontSize: 15, fontWeight: 700, color: "#111827" },
    subtitle:        { margin: 0, fontSize: 11, color: "#6b7280" },
    stepBadge:       { fontSize: 10, padding: "3px 8px", borderRadius: 10, background: "#f3f4f6", color: "#374151", fontWeight: 500, whiteSpace: "nowrap" as const },
    tabs:            { display: "flex", gap: 6, marginBottom: 12 },
    tabActive:       { flex: 1, padding: "6px 0", background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 11 },
    tabInactive:     { flex: 1, padding: "6px 0", background: "#fff", color: "#374151", border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer", fontSize: 11 },
    fieldsContainer: { display: "flex", flexDirection: "column", gap: 10 },
    fieldRow:        { display: "flex", flexDirection: "column", gap: 3 },
    labelRow:        { display: "flex", alignItems: "center", gap: 6 },
    labelText:       { fontSize: 12, fontWeight: 600, color: "#374151" },
    badgeInput:      { fontSize: 10, padding: "1px 7px", borderRadius: 10, background: "#dbeafe", color: "#1d4ed8", fontWeight: 500 },
    badgeAuto:       { fontSize: 10, padding: "1px 7px", borderRadius: 10, background: "#d1fae5", color: "#065f46", fontWeight: 500 },
    badgeCalendar:   { fontSize: 10, padding: "1px 7px", borderRadius: 10, background: "#fef3c7", color: "#92400e", fontWeight: 500 },
    badgeSelect:     { fontSize: 10, padding: "1px 7px", borderRadius: 10, background: "#ede9fe", color: "#5b21b6", fontWeight: 500 },
    hint:            { fontSize: 10, color: "#f59e0b" },
    input:           { padding: "5px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 12, outline: "none", background: "#fff", width: "100%", boxSizing: "border-box" },
    actions:         { display: "flex", gap: 8, marginTop: 14, paddingTop: 12, borderTop: "1px solid #e5e7eb" },
    btnPrimary:      { flex: 1, padding: "7px 0", background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 12 },
    btnSecondary:    { padding: "7px 12px", background: "#fff", color: "#374151", border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer", fontSize: 12 },
    btnDanger:       { padding: "7px 12px", background: "#fff", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 6, cursor: "pointer", fontSize: 12 },
    btnDisabled:     { flex: 1, padding: "7px 0", background: "#9ca3af", color: "#fff", border: "none", borderRadius: 6, cursor: "not-allowed", fontWeight: 600, fontSize: 12 },
    resultsBox:      { marginTop: 12, padding: 10, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6 },
    resultsTitle:    { margin: "0 0 6px", fontWeight: 600, fontSize: 12, color: "#374151" },
    resultRow:       { display: "flex", alignItems: "baseline", gap: 5, fontSize: 12, marginBottom: 3 },
}