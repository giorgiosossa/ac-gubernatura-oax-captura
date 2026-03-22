// popup/views/ResultsView.tsx

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { FillResult } from "../types"

interface Props {
    results: FillResult[]
    onReset: () => void
}

export function ResultsView({ results, onReset }: Props) {
    const successful = results.filter((r) => r.success)
    const failed     = results.filter((r) => !r.success)

    return (
        <div className="flex flex-col gap-5">

            {/* Resumen */}
            <div className="rounded-xl bg-muted/40 px-4 py-4 flex items-center justify-between">
                <div>
                    <p className="text-sm font-semibold text-foreground">
                        {failed.length === 0 ? "Formulario completado" : "Completado con observaciones"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {successful.length} campos rellenados
                        {failed.length > 0 && `, ${failed.length} con error`}
                    </p>
                </div>
                <div className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold",
                    failed.length === 0
                        ? "bg-emerald-100 text-emerald-600"
                        : "bg-amber-100 text-amber-600"
                )}>
                    {failed.length === 0 ? "✓" : "!"}
                </div>
            </div>

            {/* Campos exitosos */}
            {successful.length > 0 && (
                <div className="flex flex-col gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Rellenados
                    </p>
                    <div className="rounded-xl bg-muted/40 overflow-hidden">
                        {successful.map((r, i) => (
                            <div
                                key={i}
                                className={cn(
                                    "flex items-center justify-between px-4 py-2.5 gap-4",
                                    i !== successful.length - 1 && "border-b border-border/40"
                                )}
                            >
                                <span className="text-xs text-foreground">{r.label}</span>
                                <span className="text-xs text-emerald-600 font-medium shrink-0">Listo</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Campos con error */}
            {failed.length > 0 && (
                <div className="flex flex-col gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        No encontrados
                    </p>
                    <div className="rounded-xl bg-muted/40 overflow-hidden">
                        {failed.map((r, i) => (
                            <div
                                key={i}
                                className={cn(
                                    "flex flex-col px-4 py-2.5 gap-0.5",
                                    i !== failed.length - 1 && "border-b border-border/40"
                                )}
                            >
                                <div className="flex items-center justify-between gap-4">
                                    <span className="text-xs text-foreground">{r.label}</span>
                                    <span className="text-xs text-destructive font-medium shrink-0">Error</span>
                                </div>
                                {r.detail && (
                                    <p className="text-[11px] text-muted-foreground leading-relaxed">{r.detail}</p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Acción */}
            <Button
                variant="ghost"
                size="sm"
                onClick={onReset}
                className="w-full text-muted-foreground hover:text-foreground"
            >
                Analizar otro documento
            </Button>

        </div>
    )
}