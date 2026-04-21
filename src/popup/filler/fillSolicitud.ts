// filler/fillSolicitud.ts
// ─────────────────────────────────────────────────────────────────────────────
// Función que se inyecta en la página via chrome.scripting.executeScript.
// Rellena el formulario de solicitud personal (paso 1) y el modal de documento.
//
// IMPORTANTE: esta función no puede referenciar imports externos —
// todo el código que necesita debe estar definido dentro de ella misma,
// ya que executeScript la serializa y la ejecuta en el contexto de la página.
// ─────────────────────────────────────────────────────────────────────────────

export function fillSolicitud(
    data: Record<string, string>
): Promise<{ success: boolean; results: { label: string; success: boolean; detail?: string }[] }> {

    // ── Helpers (definidos dentro porque executeScript no puede usar imports) ──

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

    function fillInputAngular(el: HTMLInputElement, value: string): void {
        el.focus()
        el.dispatchEvent(new Event("focus", { bubbles: true }))
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set
        nativeSetter?.call(el, value)
        el.dispatchEvent(new Event("input",  { bubbles: true }))
        el.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }))
        el.dispatchEvent(new KeyboardEvent("keyup",   { bubbles: true }))
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

    function waitForAutocompleteEnabled(formControlName: string, timeout = 7000): Promise<HTMLElement | null> {
        const selector = `p-autocomplete[formcontrolname='${formControlName}'] div.p-autocomplete`
        return new Promise((resolve) => {
            const el = document.querySelector(selector) as HTMLElement | null
            if (el && !el.classList.contains("p-disabled")) return resolve(el)
            const observer = new MutationObserver(() => {
                const el = document.querySelector(selector) as HTMLElement | null
                if (el && !el.classList.contains("p-disabled")) { observer.disconnect(); resolve(el) }
            })
            observer.observe(document.body, {
                childList: true, subtree: true,
                attributes: true, attributeFilter: ["class"],
            })
            setTimeout(() => { observer.disconnect(); resolve(null) }, timeout)
        })
    }

    async function fillAutocompleteDropdown(
        formControlName: string,
        searchText: string
    ): Promise<{ success: boolean; detail: string }> {
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

    async function fillAutocompleteSearch(
        input: HTMLInputElement,
        searchText: string
    ): Promise<{ success: boolean; detail: string }> {
        input.focus()
        fillInput(input, searchText)
        const panel = await waitForElement(
            "p-overlay ul, .p-autocomplete-panel ul, ul.p-autocomplete-items",
            4000
        )
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

    async function fillCalendar(
        calendarBtnSelector: string,
        dateStr: string
    ): Promise<{ success: boolean; detail: string }> {
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

        const monthNamesEs = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"]
        const monthNamesEn = ["january","february","march","april","may","june","july","august","september","october","november","december"]

        for (let i = 0; i < 24; i++) {
            const monthEl = panel.querySelector(".p-datepicker-month") as HTMLElement | null
            const yearEl  = panel.querySelector(".p-datepicker-year")  as HTMLElement | null
            if (!monthEl || !yearEl) break
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

        const dayCells = Array.from(
            panel.querySelectorAll("table tbody td:not(.p-datepicker-other-month) span")
        ) as HTMLElement[]
        const dayCell = dayCells.find((span) => parseInt(span.textContent || "0", 10) === targetDay)
        if (!dayCell) return { success: false, detail: `Día ${targetDay} no encontrado` }

        dayCell.click()
        return { success: true, detail: `Fecha seleccionada: "${dateStr}"` }
    }

    // ── Ejecución ──────────────────────────────────────────────────────────────

    return (async () => {
        const results: { label: string; success: boolean; detail?: string }[] = []
        console.log("[FormFiller] data recibida:", JSON.stringify(data))

        // ── 1. Inputs normales ──────────────────────────────────────────────────
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

        // ── 2. Autocompletes principales ────────────────────────────────────────
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

        // ── 3. Contactos adicionales ─────────────────────────────────────────────
        const contactos = data["_contactos"]
        if (Array.isArray(contactos) && contactos.length > 0) {
            for (let i = 0; i < contactos.length; i++) {
                const contacto = contactos[i]

                // Validar que tenga al menos nombre, apellido y teléfono
                const tieneNombre   = !!(contacto.nombre         && contacto.nombre.trim())
                const tieneApellido = !!(contacto.apellido_paterno && contacto.apellido_paterno.trim())
                const tieneTelefono = !!(contacto.telefono        && contacto.telefono.trim())

                if (!tieneNombre || !tieneApellido || !tieneTelefono) {
                    results.push({
                        label: `Contacto ${i + 1}`,
                        success: false,
                        detail: `Saltado — faltan campos obligatorios (nombre, apellido o teléfono)`,
                    })
                    continue
                }

                console.log(`[FormFiller] Agregando contacto ${i + 1}:`, contacto)

                // Click en botón "Agregar contacto" — dentro del fieldset de contacto adicional
                const btnAgregar = document.querySelector(
                    "fieldset legend ~ div p-button[label='Agregar contacto'] button, p-button[label='Agregar contacto'] button"
                ) as HTMLElement | null

                if (!btnAgregar) {
                    results.push({ label: `Contacto ${i + 1}`, success: false, detail: "Botón 'Agregar contacto' no encontrado" })
                    continue
                }

                btnAgregar.click()

                // Esperar que aparezca el modal de contacto
                const modalContacto = await waitForElement("#nombreC", 5000)
                if (!modalContacto) {
                    results.push({ label: `Contacto ${i + 1}`, success: false, detail: "Modal de contacto no apareció" })
                    continue
                }

                await new Promise((r) => setTimeout(r, 400))

                // Rellenar campos del modal
                const contactFields = [
                    { selector: "#nombreC",          value: contacto.nombre           || "" },
                    { selector: "#apellidoPaternoC", value: contacto.apellido_paterno || "" },
                    { selector: "#apellidoMaternoC", value: contacto.apellido_materno || "" },
                    { selector: "#correoPersonalC",  value: contacto.correo           || "" },
                    { selector: "#telefonoC",        value: contacto.telefono         || "" },
                    { selector: "#comentario",       value: contacto.comentario       || "" },
                ]

                for (const cf of contactFields) {
                    if (!cf.value) continue
                    const el = document.querySelector(cf.selector) as HTMLInputElement | null
                    if (!el) continue
                    fillInputAngular(el, cf.value)
                }

                await new Promise((r) => setTimeout(r, 300))

                // Click en botón "Agregar" — dentro de app-dialog-contacto-adicional
                // para no confundir con el botón guardar del formulario principal
                const btnGuardar = document.querySelector(
                    "app-dialog-contacto-adicional button.btn.btn-primary.w-100"
                ) as HTMLElement | null

                if (!btnGuardar) {
                    results.push({ label: `Contacto ${i + 1}`, success: false, detail: "Botón guardar no encontrado" })
                    continue
                }

                btnGuardar.click()

                // Esperar que aparezca el modal de éxito (ngb-modal-window)
                await new Promise<void>((resolve) => {
                    const observer = new MutationObserver(() => {
                        if (document.querySelector("ngb-modal-window")) {
                            observer.disconnect()
                            resolve()
                        }
                    })
                    observer.observe(document.body, { childList: true, subtree: true })
                    setTimeout(() => { observer.disconnect(); resolve() }, 5000)
                })

                // Buscar específicamente el botón "Aceptar" en el modal-footer (no la X del header)
                const btnAceptar = document.querySelector(
                    "ngb-modal-window .modal-footer button.btn.btn-primary.ng-star-inserted"
                ) as HTMLElement | null

                if (btnAceptar) {
                    btnAceptar.click()
                }

                // Esperar a que ngb-modal-window desaparezca del DOM ANTES de continuar
                await new Promise<void>((resolve) => {
                    // Si ya no existe, resolver inmediatamente
                    if (!document.querySelector("ngb-modal-window")) {
                        resolve()
                        return
                    }
                    const observer = new MutationObserver(() => {
                        if (!document.querySelector("ngb-modal-window")) {
                            observer.disconnect()
                            resolve()
                        }
                    })
                    observer.observe(document.body, { childList: true, subtree: true })
                    setTimeout(() => { observer.disconnect(); resolve() }, 6000)
                })

                // Pausa adicional para que Angular actualice el DOM tras cerrar el modal
                await new Promise((r) => setTimeout(r, 400))

                results.push({
                    label: `Contacto ${i + 1}`,
                    success: true,
                    detail: [contacto.nombre, contacto.apellido_paterno].filter(Boolean).join(" "),
                })
            }
        }

        // ── 4. Modal "Agregar documento" ────────────────────────────────────────
        const shouldFillModal = [
            data["fechaDoc"], data["fechaRecep"],
            data["#dirigidoA"], data["modal_municipio"], data["modal_localidad"],
        ].some((v) => v && v.trim() !== "")

        if (shouldFillModal) {
            const modalBtn = document.querySelector(
                "fieldset:nth-of-type(4) span.p-button-label"
            ) as HTMLElement | null

            if (!modalBtn) {
                results.push({ label: "Modal", success: false, detail: "Botón no encontrado" })
            } else {
                modalBtn.click()
                const modal = await waitForElement("p-dynamicdialog", 5000)

                if (!modal) {
                    results.push({ label: "Modal", success: false, detail: "El modal no apareció" })
                } else {
                    results.push({ label: "Modal", success: true, detail: "Abierto correctamente" })
                    await new Promise((r) => setTimeout(r, 500))
                    console.log("[FormFiller] ✅ Modal abierto")

                    // Fecha Documento
                    if (data["fechaDoc"]) {
                        console.log("[FormFiller] → fechaDoc:", data["fechaDoc"])
                        try {
                            const r = await fillCalendar(
                                "p-dynamicdialog form > div:nth-of-type(1) > div:nth-of-type(2) button",
                                data["fechaDoc"]
                            )
                            console.log("[FormFiller] fechaDoc resultado:", r)
                            results.push({ label: "Fecha Documento", ...r })
                        } catch (e) {
                            console.error("[FormFiller] fechaDoc excepción:", e)
                            results.push({ label: "Fecha Documento", success: false, detail: String(e) })
                        }
                        await new Promise((r) => setTimeout(r, 300))
                    }

                    // Fecha Recepción
                    if (data["fechaRecep"]) {
                        console.log("[FormFiller] → fechaRecep:", data["fechaRecep"])
                        try {
                            const r = await fillCalendar(
                                "p-dynamicdialog form > div:nth-of-type(1) > div:nth-of-type(3) button",
                                data["fechaRecep"]
                            )
                            console.log("[FormFiller] fechaRecep resultado:", r)
                            results.push({ label: "Fecha Recepción", ...r })
                        } catch (e) {
                            console.error("[FormFiller] fechaRecep excepción:", e)
                            results.push({ label: "Fecha Recepción", success: false, detail: String(e) })
                        }
                        await new Promise((r) => setTimeout(r, 300))
                    }

                    // Dirigido A
                    console.log("[FormFiller] → llegué a dirigidoA, valor:", data["#dirigidoA"])
                    if (data["#dirigidoA"]) {
                        console.log("[FormFiller] Buscando #dirigidoA...")
                        const el = await waitForElement("#dirigidoA", 6000) as HTMLInputElement | null
                        if (!el) {
                            console.log("[FormFiller] #dirigidoA NO encontrado después de 6s")
                            results.push({ label: "Dirigido A", success: false, detail: "#dirigidoA no apareció" })
                        } else {
                            console.log("[FormFiller] #dirigidoA encontrado:", el)
                            fillInputAngular(el, data["#dirigidoA"])
                            console.log("[FormFiller] valor final en DOM:", el.value)
                            results.push({ label: "Dirigido A", success: true, detail: `DOM value: "${el.value}"` })
                        }
                    }

                    // Municipio modal
                    if (data["modal_municipio"]) {
                        const input = modal.querySelector(
                            "div:nth-of-type(3) > div:nth-of-type(1) p-autocomplete input"
                        ) as HTMLInputElement | null
                        if (!input) {
                            results.push({ label: "Municipio (modal)", success: false, detail: "Input no encontrado" })
                        } else {
                            results.push({ label: "Municipio (modal)", ...await fillAutocompleteSearch(input, data["modal_municipio"]) })
                            await new Promise((r) => setTimeout(r, 500))
                        }
                    }

                    // Localidad modal
                    if (data["modal_localidad"]) {
                        const input = modal.querySelector(
                            "div:nth-of-type(4) > div:nth-of-type(1) p-autocomplete input"
                        ) as HTMLInputElement | null
                        if (!input) {
                            results.push({ label: "Localidad (modal)", success: false, detail: "Input no encontrado" })
                        } else {
                            results.push({ label: "Localidad (modal)", ...await fillAutocompleteSearch(input, data["modal_localidad"]) })
                        }
                    }
                }
            }
        }

        return { success: true, results }
    })()
}