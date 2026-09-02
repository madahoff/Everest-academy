"use client"

import * as React from "react"
import { Check, ChevronDown, Search, X } from "lucide-react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export interface MultiSelectOption {
    value: string
    label: string
    /** Précision affichée en gris à droite (statut, tarif, effectif...). */
    hint?: string
}

interface MultiSelectProps {
    options: MultiSelectOption[]
    selected: string[]
    onChange: (values: string[]) => void
    /** Libellé du bouton quand rien n'est coché. */
    placeholder: string
    /** Titre du panneau. */
    title?: string
    searchPlaceholder?: string
    /** Bloc libre en tête du panneau — le Pack Premium y prend place. */
    header?: React.ReactNode
    /** Bloc libre en pied du panneau. */
    footer?: React.ReactNode
    /**
     * Consultée avant de DÉCOCHER une option. Retourner `false` annule le clic —
     * c'est ainsi qu'un retrait d'accès payé demande confirmation.
     */
    onBeforeDeselect?: (value: string) => boolean
    /** Rendu personnalisé du bouton, à la place du décompte par défaut. */
    renderTrigger?: (selected: string[]) => React.ReactNode
    disabled?: boolean
    align?: "start" | "center" | "end"
    className?: string
    triggerClassName?: string
    contentClassName?: string
}

/**
 * Liste à choix multiples : un bouton, un panneau à cocher, une recherche et deux
 * raccourcis « tout / rien ». Sert aux trois usages de l'annuaire — filtrer, éditer
 * les accès d'une ligne, et viser une action groupée — pour qu'ils se manipulent
 * exactement de la même façon.
 */
export function MultiSelect({
    options,
    selected,
    onChange,
    placeholder,
    title,
    searchPlaceholder = "Rechercher...",
    header,
    footer,
    onBeforeDeselect,
    renderTrigger,
    disabled,
    align = "start",
    className,
    triggerClassName,
    contentClassName,
}: MultiSelectProps) {
    const [open, setOpen] = React.useState(false)
    const [query, setQuery] = React.useState("")

    const selectedSet = React.useMemo(() => new Set(selected), [selected])

    const visible = React.useMemo(() => {
        const q = query.trim().toLowerCase()
        if (!q) return options
        return options.filter((o) => o.label.toLowerCase().includes(q) || o.hint?.toLowerCase().includes(q))
    }, [options, query])

    const toggle = (value: string) => {
        if (selectedSet.has(value)) {
            if (onBeforeDeselect && !onBeforeDeselect(value)) return
            onChange(selected.filter((v) => v !== value))
        } else {
            onChange([...selected, value])
        }
    }

    /** « Tout sélectionner » porte sur ce qui est VISIBLE : filtrer puis tout cocher
     *  est le geste qui donne l'accès à une famille de cours d'un seul clic. */
    const selectAllVisible = () => {
        const merged = new Set(selected)
        for (const option of visible) merged.add(option.value)
        onChange([...merged])
    }

    const clearAll = () => {
        if (onBeforeDeselect) {
            const refused = selected.filter((value) => !onBeforeDeselect(value))
            if (refused.length > 0) {
                onChange(refused)
                return
            }
        }
        onChange([])
    }

    const allVisibleSelected = visible.length > 0 && visible.every((o) => selectedSet.has(o.value))

    return (
        <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    disabled={disabled}
                    className={cn(
                        "flex items-center justify-between gap-3 border border-gray-200 bg-white px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.15em] transition-all hover:border-[#050505] disabled:cursor-not-allowed disabled:opacity-40",
                        open && "border-[#2563EB]",
                        triggerClassName,
                        className,
                    )}
                >
                    {renderTrigger ? (
                        renderTrigger(selected)
                    ) : (
                        <span className={cn("truncate", selected.length === 0 && "text-gray-400")}>
                            {selected.length === 0 ? placeholder : `${placeholder} · ${selected.length}`}
                        </span>
                    )}
                    <ChevronDown className="h-3 w-3 shrink-0 text-gray-400" />
                </button>
            </PopoverTrigger>

            <PopoverContent
                align={align}
                className={cn("w-80 rounded-none border-gray-200 p-0 shadow-xl", contentClassName)}
            >
                {title && (
                    <div className="border-b border-gray-100 px-4 py-3 text-[9px] font-black uppercase tracking-[0.2em] text-[#050505]">
                        {title}
                    </div>
                )}

                {header && <div className="border-b border-gray-100">{header}</div>}

                <div className="relative border-b border-gray-100">
                    <Search className="absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-300" />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={searchPlaceholder}
                        className="w-full bg-white px-9 py-3 text-[10px] font-bold tracking-widest outline-none placeholder:text-gray-300"
                    />
                    {query && (
                        <button
                            type="button"
                            onClick={() => setQuery("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-[#050505]"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    )}
                </div>

                <div className="flex items-center justify-between border-b border-gray-100 bg-[#F9FAFB] px-4 py-2">
                    <button
                        type="button"
                        onClick={selectAllVisible}
                        disabled={allVisibleSelected}
                        className="text-[9px] font-black uppercase tracking-[0.2em] text-[#2563EB] hover:underline disabled:text-gray-300 disabled:no-underline"
                    >
                        Tout sélectionner{query ? " (filtré)" : ""}
                    </button>
                    <button
                        type="button"
                        onClick={clearAll}
                        disabled={selected.length === 0}
                        className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 hover:text-red-500 disabled:text-gray-200"
                    >
                        Tout retirer
                    </button>
                </div>

                <div className="max-h-64 overflow-y-auto">
                    {visible.length === 0 && (
                        <p className="px-4 py-6 text-center text-[10px] font-bold uppercase tracking-widest text-gray-300">
                            Aucun résultat
                        </p>
                    )}

                    {visible.map((option) => {
                        const checked = selectedSet.has(option.value)
                        return (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => toggle(option.value)}
                                className="flex w-full items-center gap-3 border-b border-gray-50 px-4 py-3 text-left transition-colors hover:bg-gray-50"
                            >
                                <span
                                    className={cn(
                                        "flex h-4 w-4 shrink-0 items-center justify-center border transition-colors",
                                        checked ? "border-[#2563EB] bg-[#2563EB] text-white" : "border-gray-300",
                                    )}
                                >
                                    {checked && <Check className="h-3 w-3" />}
                                </span>
                                <span className="flex-1 truncate text-[11px] font-bold tracking-tight">{option.label}</span>
                                {option.hint && (
                                    <span className="shrink-0 text-[9px] font-bold uppercase tracking-widest text-gray-300">
                                        {option.hint}
                                    </span>
                                )}
                            </button>
                        )
                    })}
                </div>

                {footer && <div className="border-t border-gray-100">{footer}</div>}
            </PopoverContent>
        </Popover>
    )
}
