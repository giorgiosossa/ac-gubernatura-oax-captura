// Normaliza texto: quita tildes y pasa a minúsculas
function normalize(str: string): string {
    return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
}

// ─── Rellena un <input> normal con eventos nativos ────────────────────────────
function fillInput(el: HTMLInputElement, value: string): void {
    const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
    )?.set
    nativeSetter?.call(el, value)
    el.dispatchEvent(new Event("input",  { bubbles: true }))
    el.dispatchEvent(new Event("change", { bubbles: true }))
    el.dispatchEvent(new Event("blur",   { bubbles: true }))
}

// ─── Espera a que un selector aparezca en el DOM ──────────────────────────────
function waitForElement(selector: string, timeout = 5000): Promise<HTMLElement | null> {
    return new Promise((resolve) => {
        const existing = document.querySelector(selector) as HTMLElement | null
        if (existing) return resolve(existing)

        const observer = new MutationObserver(() => {
            const el = document.querySelector(selector) as HTMLElement | null
            if (el) {
                observer.disconnect()
                resolve(el)
            }
        })
        observer.observe(document.body, { childList: true, subtree: true })
        setTimeout(() => { observer.disconnect(); resolve(null) }, timeout)
    })
}

// ─── Rellena un p-autocomplete-dd (dropdown mode) de PrimeNG ─────────────────
async function fillAutocomplete(
    formControlName: string,
    searchText: string
): Promise<{ success: boolean; detail: string }> {

    // 1. Encuentra el botón dropdown — casteado a HTMLButtonElement para .click()
    const dropdownBtn = document.querySelector(
        `p-autocomplete[formcontrolname='${formControlName}'] button.p-autocomplete-dropdown`
    ) as HTMLButtonElement | null

    if (!dropdownBtn) {
        return {
            success: false,
            detail: `No se encontró el botón dropdown de "${formControlName}"`,
        }
    }

    // 2. Cierra cualquier panel abierto primero
    document.body.click()
    await new Promise((r) => setTimeout(r, 150))

    // 3. Click en el botón para abrir el panel
    dropdownBtn.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }))
    dropdownBtn.click()

    // 4. Espera a que aparezca ul.p-autocomplete-items — retorna HTMLElement
    const panel = await waitForElement("ul.p-autocomplete-items", 4000)

    if (!panel) {
        return {
            success: false,
            detail: `El panel no apareció para "${formControlName}"`,
        }
    }

    // 5. Busca los li — casteados a HTMLElement para .click()
    const items = Array.from(
        panel.querySelectorAll("li.p-autocomplete-item")
    ) as HTMLElement[]

    console.log(
        `[FormFiller] "${formControlName}" — opciones:`,
        items.map((li) => li.getAttribute("aria-label") || li.textContent?.trim())
    )

    const exactMatch = items.find((li) => {
        const label = li.getAttribute("aria-label") || li.textContent || ""
        return normalize(label) === normalize(searchText)
    })

    const partialMatch = items.find((li) => {
        const label = li.getAttribute("aria-label") || li.textContent || ""
        return normalize(label).includes(normalize(searchText))
    })

    const match = exactMatch || partialMatch

    if (!match) {
        return {
            success: false,
            detail: `No se encontró "${searchText}" en las opciones`,
        }
    }

    // 6. Click en la opción — ya es HTMLElement, .click() disponible
    match.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }))
    match.dispatchEvent(new MouseEvent("mouseup",   { bubbles: true }))
    match.click()

    const selectedText = match.getAttribute("aria-label") || match.textContent?.trim()

    return {
        success: true,
        detail: `Seleccionó: "${selectedText}"`,
    }
}

// ─── Espera a que localidad se habilite (pierde la clase p-disabled) ──────────
function waitForAutocompleteEnabled(
    formControlName: string,
    timeout = 7000
): Promise<HTMLElement | null> {
    const selector = `p-autocomplete[formcontrolname='${formControlName}'] div.p-autocomplete`
    return new Promise((resolve) => {
        const el = document.querySelector(selector) as HTMLElement | null
        if (el && !el.classList.contains("p-disabled")) return resolve(el)

        const observer = new MutationObserver(() => {
            const el = document.querySelector(selector) as HTMLElement | null
            if (el && !el.classList.contains("p-disabled")) {
                observer.disconnect()
                resolve(el)
            }
        })
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["class"],
        })
        setTimeout(() => { observer.disconnect(); resolve(null) }, timeout)
    })
}

// ─── Listener principal ───────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action !== "FILL_FIELDS") return

    const data: Record<string, string> = message.data

    ;(async () => {
        const results: { label: string; success: boolean; detail?: string }[] = []

        // ── 1. Inputs normales ────────────────────────────────────────────────────
        const inputFields = [
            { selector: "#nombre",          label: "Nombre" },
            { selector: "#apellidoPaterno", label: "Apellido Paterno" },
            { selector: "#apellidoMaterno", label: "Apellido Materno" },
            { selector: "#correoPersonal",  label: "Correo Personal" },
            { selector: "#telefono",        label: "Teléfono" },
            { selector: "#celular",         label: "Celular" },
            { selector: "#cargo",           label: "Cargo" },
        ]

        for (const field of inputFields) {
            const value = data[field.selector]
            if (!value) continue

            const el = document.querySelector(field.selector) as HTMLInputElement | null
            if (!el) {
                results.push({ label: field.label, success: false, detail: "Elemento no encontrado" })
                continue
            }

            fillInput(el, value)
            results.push({ label: field.label, success: true })
        }

        // ── 2. Género ─────────────────────────────────────────────────────────────
        if (data["genero"]) {
            const result = await fillAutocomplete("genero", data["genero"])
            results.push({ label: "Género", ...result })
            await new Promise((r) => setTimeout(r, 300))
        }

        // ── 3. Municipio ──────────────────────────────────────────────────────────
        if (data["municipio"]) {
            const result = await fillAutocomplete("municipio", data["municipio"])
            results.push({ label: "Municipio", ...result })

            // ── 4. Localidad (espera a que municipio habilite el campo) ───────────
            if (result.success && data["localidad"]) {
                console.log("[FormFiller] Esperando que localidad se habilite...")

                const localidadReady = await waitForAutocompleteEnabled("localidad", 7000)

                if (!localidadReady) {
                    results.push({
                        label: "Localidad",
                        success: false,
                        detail: "No se habilitó después de seleccionar municipio",
                    })
                } else {
                    await new Promise((r) => setTimeout(r, 500))
                    const localResult = await fillAutocomplete("localidad", data["localidad"])
                    results.push({ label: "Localidad", ...localResult })
                }
            }
        }

        sendResponse({ success: true, results })
    })()

    return true
})