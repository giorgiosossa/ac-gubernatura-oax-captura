// filler/fillPeticion.ts
// ─────────────────────────────────────────────────────────────────────────────
// Función que se inyecta en la página via chrome.scripting.executeScript.
// Rellena el formulario de agregar petición (paso 2).
//
// IMPORTANTE: esta función no puede referenciar imports externos —
// todo el código que necesita debe estar definido dentro de ella misma.
// ─────────────────────────────────────────────────────────────────────────────

export function fillPeticion(
    data: Record<string, string>
): Promise<{ success: boolean; results: { label: string; success: boolean; detail?: string }[] }> {

    // ── Helpers ────────────────────────────────────────────────────────────────

    function waitForElement(selector: string, timeout = 3000): Promise<HTMLElement | null> {
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

    // ── Ejecución ──────────────────────────────────────────────────────────────

    return (async () => {
        const results: { label: string; success: boolean; detail?: string }[] = []
        console.log("[FormFiller] Petición — data recibida:", JSON.stringify(data))

        // Clasificación — <select> nativo, value numérico (1–5)
        if (data["#clasificacion"]) {
            results.push({ label: "Clasificación", ...fillSelectNative("#clasificacion", data["#clasificacion"]) })
        }

        // ¿Qué requiere? — input con validadores Angular
        if (data["#requiere"]) {
            const el = await waitForElement("#requiere") as HTMLInputElement | null
            if (!el) {
                results.push({ label: "¿Qué requiere?", success: false, detail: "#requiere no encontrado" })
            } else {
                fillInputAngular(el, data["#requiere"])
                results.push({ label: "¿Qué requiere?", success: true })
            }
        }

        // Descripción — textarea con validadores Angular
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