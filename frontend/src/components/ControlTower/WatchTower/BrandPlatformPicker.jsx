import { useState } from 'react'
import { ChevronDown, Columns3 } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover'

export default function BrandPlatformPicker({ options, selected, combinedLabel, onApply }) {
    const [open, setOpen] = useState(false)
    const [draft, setDraft] = useState([])
    const summary = selected.length > 1 ? `${selected.length} platforms` : selected[0] || combinedLabel

    return (
        <Popover open={open} onOpenChange={next => {
            if (next) setDraft(selected)
            setOpen(next)
        }}>
            <PopoverTrigger asChild>
                <button type="button" aria-label={`Compare platforms, ${summary}`}
                    className="inline-flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                    <Columns3 size={14} />{summary}<ChevronDown size={14} />
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" aria-label="Compare platforms" className="w-64 rounded-xl border-slate-200 bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                    <strong className="text-sm text-slate-900">Compare platforms</strong>
                    {options.length > 1 && <button type="button" className="text-xs font-medium text-blue-700" onClick={() => setDraft(options)}>Select all</button>}
                </div>
                <div className="max-h-60 overflow-y-auto">
                    {options.map(platform => (
                        <label key={platform} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm text-slate-700 hover:bg-slate-50">
                            <input type="checkbox" className="accent-blue-600" checked={draft.includes(platform)}
                                onChange={event => setDraft(event.target.checked ? [...draft, platform] : draft.filter(p => p !== platform))} />
                            {platform}
                        </label>
                    ))}
                    {options.length === 0 && <p className="text-xs text-slate-500">No platforms available for these filters.</p>}
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-3">
                    <button type="button" className="text-xs font-medium text-slate-600 hover:text-blue-700" onClick={() => { onApply([]); setOpen(false) }}>Combined view</button>
                    <button type="button" disabled={!draft.length} className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                        onClick={() => { onApply(options.filter(p => draft.includes(p))); setOpen(false) }}>Apply</button>
                </div>
            </PopoverContent>
        </Popover>
    )
}
