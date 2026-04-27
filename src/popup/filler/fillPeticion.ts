// filler/fillPeticion.ts

export function fillPeticion(
    data: Record<string, any>
): Promise<{ success: boolean; results: { label: string; success: boolean; detail?: string }[] }> {

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

    function fillTextarea(el: HTMLTextAreaElement, value: string): void {
        el.focus()
        el.dispatchEvent(new Event("focus", { bubbles: true }))
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set
        nativeSetter?.call(el, value)
        el.dispatchEvent(new Event("input",  { bubbles: true }))
        el.dispatchEvent(new Event("change", { bubbles: true }))
        el.dispatchEvent(new Event("blur",   { bubbles: true }))
        el.dispatchEvent(new FocusEvent("focusout", { bubbles: true }))
    }

    function fillSelectNative(selector: string, value: string): { success: boolean; detail: string } {
        const el = document.querySelector(selector) as HTMLSelectElement | null
        if (!el) return { success: false, detail: `Select no encontrado: ${selector}` }
        const option = Array.from(el.options).find((o) => o.value === value)
        if (!option) return {
            success: false,
            detail: `Value "${value}" no existe. Opciones: ${Array.from(el.options).map((o) => `${o.value}=${o.text}`).join(", ")}`,
        }
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set
        nativeSetter?.call(el, value)
        el.dispatchEvent(new Event("change", { bubbles: true }))
        el.dispatchEvent(new Event("blur",   { bubbles: true }))
        return { success: true, detail: `Seleccionó: "${option.text}"` }
    }

    async function fillPDropdown(
        dropdownId: string,
        searchText: string,
        label: string
    ): Promise<{ success: boolean; detail: string }> {
        if (!searchText) return { success: false, detail: "Sin valor" }

        const dropdown = document.querySelector(`#${dropdownId}.p-dropdown`) as HTMLElement | null
            ?? document.querySelector(`#${dropdownId}`) as HTMLElement | null

        if (!dropdown) return { success: false, detail: `#${dropdownId}.p-dropdown no encontrado` }

        dropdown.click()
        await new Promise(r => setTimeout(r, 400))

        const panel = document.querySelector(".p-dropdown-panel .p-dropdown-items") as HTMLElement | null
        if (!panel) {
            document.body.click()
            return { success: false, detail: `Panel del dropdown #${dropdownId} no apareció` }
        }

        const allItems = Array.from(
            document.querySelectorAll(".p-dropdown-panel .p-dropdown-item, .p-dropdown-panel li")
        ) as HTMLElement[]

        if (allItems.length === 0) return { success: false, detail: "No hay opciones en el panel" }

        const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
        const normSearch = normalize(searchText)

        const match =
            allItems.find(el => normalize(el.textContent || "") === normSearch) ||
            allItems.find(el => normalize(el.textContent || "").includes(normSearch)) ||
            allItems.find(el => normSearch.includes(normalize(el.textContent || "").replace(/\s+/g, " ")))

        if (!match) {
            document.body.click()
            return {
                success: false,
                detail: `"${searchText}" no encontrado. Opciones: ${allItems.slice(0, 5).map(e => e.textContent?.trim()).join(", ")}`,
            }
        }

        match.click()
        await new Promise(r => setTimeout(r, 300))

        return { success: true, detail: `Seleccionó: "${match.textContent?.trim()}"` }
    }

    function waitForDropdownEnabled(dropdownId: string, timeout = 6000): Promise<boolean> {
        return new Promise((resolve) => {
            const selector = `#${dropdownId}.p-dropdown`

            const check = () => {
                const el = document.querySelector(selector) ?? document.querySelector(`#${dropdownId}`)
                return el && !el.classList.contains("p-disabled") && !el.closest(".p-disabled")
            }

            if (check()) return resolve(true)

            const observer = new MutationObserver(() => {
                if (check()) {
                    observer.disconnect()
                    resolve(true)
                }
            })
            observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] })
            setTimeout(() => { observer.disconnect(); resolve(false) }, timeout)
        })
    }

    return (async () => {
        const results: { label: string; success: boolean; detail?: string }[] = []
        console.log("[FormFiller] Petición — data:", JSON.stringify(data))

        // ── Clasificación ─────────────────────────────────────────────────────────
        if (data["#clasificacion"]) {
            results.push({ label: "Clasificación", ...fillSelectNative("#clasificacion", data["#clasificacion"]) })
        }

        // ── Prioridad (siempre NORMAL) ────────────────────────────────────────────
        const priorEnabled = await waitForDropdownEnabled("prioridad", 5000)
        if (!priorEnabled) {
            results.push({ label: "Prioridad", success: false, detail: "Dropdown no habilitado" })
        } else {
            const priorResult = await fillPDropdown("prioridad", "NORMAL", "Prioridad")
            results.push({ label: "Prioridad", ...priorResult })
        }

        // ── Programa → Subprograma → Proyecto ─────────────────────────────────────
        if (data["programa"]) {
            console.log("[FormFiller] → Programa:", data["programa"])

            const progEnabled = await waitForDropdownEnabled("programa", 5000)
            if (!progEnabled) {
                results.push({ label: "Programa", success: false, detail: "Dropdown no habilitado" })
            } else {
                const progResult = await fillPDropdown("programa", data["programa"], "Programa")
                results.push({ label: "Programa", ...progResult })

                if (progResult.success && data["subprograma"]) {
                    console.log("[FormFiller] → Subprograma:", data["subprograma"])

                    const subEnabled = await waitForDropdownEnabled("subprograma", 6000)
                    if (!subEnabled) {
                        results.push({ label: "Subprograma", success: false, detail: "No se habilitó tras seleccionar programa" })
                    } else {
                        await new Promise(r => setTimeout(r, 300))
                        const subResult = await fillPDropdown("subprograma", data["subprograma"], "Subprograma")
                        results.push({ label: "Subprograma", ...subResult })

                        if (subResult.success && data["proyecto"]) {
                            console.log("[FormFiller] → Proyecto:", data["proyecto"])

                            const proyEnabled = await waitForDropdownEnabled("proyecto", 6000)
                            if (!proyEnabled) {
                                results.push({ label: "Proyecto", success: false, detail: "No se habilitó tras seleccionar subprograma" })
                            } else {
                                await new Promise(r => setTimeout(r, 300))
                                const proyResult = await fillPDropdown("proyecto", data["proyecto"], "Proyecto")
                                results.push({ label: "Proyecto", ...proyResult })
                            }
                        }
                    }
                }
            }
        }

        // ── ¿Qué requiere? ────────────────────────────────────────────────────────
        if (data["#requiere"]) {
            const el = await waitForElement("#requiere") as HTMLInputElement | null
            if (!el) {
                results.push({ label: "¿Qué requiere?", success: false, detail: "#requiere no encontrado" })
            } else {
                fillInputAngular(el, data["#requiere"])
                results.push({ label: "¿Qué requiere?", success: true })
            }
        }

        // ── Descripción ───────────────────────────────────────────────────────────
        if (data["#descripcion"]) {
            const el = await waitForElement("#descripcion") as HTMLTextAreaElement | null
            if (!el) {
                results.push({ label: "Descripción", success: false, detail: "#descripcion no encontrado" })
            } else {
                fillTextarea(el, data["#descripcion"])
                results.push({ label: "Descripción", success: true })
            }
        }

        return { success: true, results }
    })()
}