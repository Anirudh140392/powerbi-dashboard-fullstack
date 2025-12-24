import React, { useMemo, useState } from "react";

/**
 * KpiFilterPanel.jsx
 * - Left rail: Keywords / SKUs / Cities / Platforms / KPI rules
 * - Right: Excel-style filter list (search, multi-select, select-all, pagination, top/bottom N)
 * - KPI rules: AND/OR groups, nested subgroups, operators incl regex
 *
 * Notes:
 * - This is pure JSX (no TS types).
 * - Tailwind classes used for styling.
 */

const SECTION_LABELS = [
  { id: "keywords", label: "Keywords" },
  { id: "brands", label: "Brands" },
  { id: "categories", label: "Categories" },
  { id: "skus", label: "SKUs" },
  { id: "weekendFlag", label: "Weekend Flag" },
  { id: "cities", label: "Cities" },
  { id: "platforms", label: "Platforms" },
  { id: "kpiRules", label: "KPI rules" },
];

const makeId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function KpiFilterPanel({
  keywords,
  brands,
  categories,
  skus,
  cities,
  platforms,
  kpiFields,
  onKeywordChange,
  onBrandChange,
  onCategoryChange,
  onSkuChange,
  onWeekendChange,
  onCityChange,
  onPlatformChange,
  onRulesChange,
  onSectionChange, // Generic handler: (sectionId, values) => void
  pageSize = 50,
  sectionConfig = SECTION_LABELS,
}) {
  const [activeSection, setActiveSection] = useState(sectionConfig[0]?.id || "keywords");

  // Ensure activeSection is valid (if config changes)
  useMemo(() => {
    if (!sectionConfig.find(s => s.id === activeSection)) {
      setActiveSection(sectionConfig[0]?.id || "");
    }
  }, [sectionConfig, activeSection]);

  return (
    <div className="flex h-full gap-6 text-slate-900">
      {/* Left navigation rail */}
      <div className="flex w-64 flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="px-4 py-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Filters
        </div>
        <nav className="flex-1 space-y-1 px-2 pb-2 overflow-y-auto">
          {sectionConfig.map((section) => {
            const isActive = section.id === activeSection;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={[
                  "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition",
                  isActive
                    ? "bg-sky-50 text-sky-700 border border-sky-200"
                    : "text-slate-700 hover:bg-slate-100",
                ].join(" ")}
              >
                <span>{section.label}</span>
                {isActive ? (
                  <span className="rounded-full bg-sky-600 px-2 text-[10px] font-semibold text-white">
                    Active
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Right content area */}
      <div className="flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        {sectionConfig.map(section => {
          if (activeSection !== section.id) return null;

          // Legacy mappings
          if (section.id === "keywords" && keywords) {
            return (
              <MultiSelectSection
                key="keywords"
                title={section.label + " filter"}
                description="Search and select keywords to filter the hierarchy."
                options={keywords}
                pageSize={pageSize}
                onChange={onKeywordChange}
              />
            );
          }
          if (section.id === "brands" && brands) {
            return (
              <MultiSelectSection
                key="brands"
                title={section.label + " filter"}
                description="Filter by specific items."
                options={brands}
                pageSize={pageSize}
                onChange={onBrandChange}
              />
            );
          }
          if (section.id === "categories" && categories) {
            return (
              <MultiSelectSection
                key="categories"
                title={section.label + " filter"}
                description="Filter by specific groups."
                options={categories}
                pageSize={pageSize}
                onChange={onCategoryChange}
              />
            );
          }
          if (section.id === "skus" && skus) {
            return (
              <MultiSelectSection
                key="skus"
                title={section.label + " filter"}
                description="Filter on specific SKUs within the selected hierarchy."
                options={skus}
                pageSize={pageSize}
                onChange={onSkuChange}
              />
            );
          }
          if (section.id === "weekendFlag") {
            const opts = [
              { id: "Weekend", label: "Weekend" },
              { id: "Weekday", label: "Weekday" },
            ];

            return (
              <MultiSelectSection
                key="weekendFlag"
                title={section.label + " filter"}
                description="Choose weekend or weekday data."
                options={opts}
                pageSize={pageSize}
                onChange={(vals) => {
                  if (onWeekendChange) onWeekendChange(vals || []);
                }}
              />
            );
          }
          if (section.id === "cities" && cities) {
            return (
              <MultiSelectSection
                key="cities"
                title={section.label + " filter"}
                description="Limit data to one or more cities."
                options={cities}
                pageSize={pageSize}
                onChange={onCityChange}
              />
            );
          }
          if (section.id === "platforms" && platforms) {
            return (
              <MultiSelectSection
                key="platforms"
                title={section.label + " filter"}
                description="Choose which platforms to keep in the view."
                options={platforms}
                pageSize={pageSize}
                onChange={onPlatformChange}
              />
            );
          }
          if (section.id === "kpiRules") {
            return <KpiRuleBuilder key="kpiRules" fields={kpiFields} onRulesChange={onRulesChange} />;
          }

          // Dynamic / New sections
          if (section.options) {
            return (
              <MultiSelectSection
                key={section.id}
                title={section.label + " filter"}
                description={`Filter by ${section.label.toLowerCase()}.`}
                options={section.options}
                pageSize={pageSize}
                onChange={(vals) => {
                  console.log(section.id, vals);
                  if (onRulesChange) onRulesChange(prev => ({ ...prev, [section.id]: vals }));
                  if (onSectionChange) onSectionChange(section.id, vals);
                }}
              />
            );
          }
          return <div key={section.id} className="p-4 text-slate-400">Section content not configured.</div>;
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Excel-style multi-select: search + select all + pagination + top/bottom */
/* ------------------------------------------------------------------ */

function MultiSelectSection({ title, description, options, onChange, pageSize }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(() => new Set());
  const [filterMode, setFilterMode] = useState("list"); // list | top | bottom
  const [topN, setTopN] = useState(10);

  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => (opt.label || "").toLowerCase().includes(q));
  }, [options, search]);

  const filtered = useMemo(() => {
    if (!(filterMode === "top" || filterMode === "bottom") || searched.length === 0)
      return searched;

    const withValue = searched.filter((o) => typeof o.value === "number");
    if (withValue.length === 0) return searched;

    const sorted = [...withValue].sort((a, b) => (a.value ?? 0) - (b.value ?? 0));
    if (filterMode === "top") sorted.reverse();

    return sorted.slice(0, Math.max(1, topN));
  }, [searched, filterMode, topN]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const notify = (setValues) => {
    if (onChange) onChange(Array.from(setValues));
  };

  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      notify(next);
      return next;
    });
  };

  const toggleSelectAllOnPage = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected =
        pageItems.length > 0 && pageItems.every((opt) => next.has(opt.id));
      if (allSelected) pageItems.forEach((opt) => next.delete(opt.id));
      else pageItems.forEach((opt) => next.add(opt.id));
      notify(next);
      return next;
    });
  };

  const selectAllFiltered = () => {
    const next = new Set();
    filtered.forEach((opt) => next.add(opt.id));
    setSelected(next);
    notify(next);
  };

  const clearAll = () => {
    const empty = new Set();
    setSelected(empty);
    notify(empty);
  };

  const pageBadge = `${selected.size} selected`;

  return (
    <div className="flex h-full flex-col">
      <header className="mb-2 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
        <div className="rounded-full border border-slate-200 px-3 py-1 text-[11px] text-slate-600">
          {pageBadge}
        </div>
      </header>

      {/* Mode toggle (All / Top N / Bottom N) - Only show for large lists */}
      {options.length >= 15 && (
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500">Mode:</span>
          <button
            type="button"
            onClick={() => {
              setFilterMode("list");
              setPage(1);
            }}
            className={`rounded-full border px-3 py-1 ${filterMode === "list"
              ? "border-sky-500 bg-sky-50 text-sky-700"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => {
              setFilterMode("top");
              setPage(1);
            }}
            className={`rounded-full border px-3 py-1 ${filterMode === "top"
              ? "border-sky-500 bg-sky-50 text-sky-700"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
          >
            Top
          </button>
          <button
            type="button"
            onClick={() => {
              setFilterMode("bottom");
              setPage(1);
            }}
            className={`rounded-full border px-3 py-1 ${filterMode === "bottom"
              ? "border-sky-500 bg-sky-50 text-sky-700"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
          >
            Bottom
          </button>

          {(filterMode === "top" || filterMode === "bottom") && (
            <div className="flex items-center gap-1">
              <span className="text-slate-500">N =</span>
              <input
                type="number"
                min={1}
                max={999}
                value={topN}
                onChange={(e) => setTopN(Number(e.target.value) || 10)}
                className="h-7 w-16 rounded-md border border-slate-200 px-2 text-xs"
              />
              <span className="text-slate-400">(by value)</span>
            </div>
          )}
        </div>
      )}

      {/* Search & Actions - Simplify for small lists */}
      <div className="mb-2 flex items-center gap-2">
        {options.length >= 15 && (
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search..."
            className="h-8 flex-1 rounded-lg border border-slate-200 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        )}
        <button
          type="button"
          onClick={selectAllFiltered}
          className="h-8 rounded-lg border border-slate-200 px-2 text-xs text-slate-700 hover:bg-slate-100 ml-auto"
        >
          Select all
        </button>
        <button
          type="button"
          onClick={clearAll}
          className="h-8 rounded-lg border border-slate-200 px-2 text-xs text-slate-500 hover:bg-slate-50"
        >
          Clear
        </button>
      </div>

      {options.length >= 15 && (
        <div className="mb-1 flex items-center justify-between border-b border-slate-100 pb-2 text-xs">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-sky-600"
              checked={pageItems.length > 0 && pageItems.every((opt) => selected.has(opt.id))}
              onChange={toggleSelectAllOnPage}
            />
            <span>Select all on page</span>
          </label>
          <span className="text-slate-400">
            Page {page} of {totalPages}
          </span>
        </div>
      )}

      <div className="flex-1 rounded-lg border border-slate-100 bg-slate-50/60 overflow-y-auto min-h-[400px]">
        {pageItems.map((opt) => (
          <label
            key={opt.id}
            className="flex cursor-pointer items-center justify-between border-b border-slate-100 px-3 py-2 text-sm hover:bg-slate-100/80"
          >
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 accent-sky-600"
                checked={selected.has(opt.id)}
                onChange={() => toggleOne(opt.id)}
              />
              <span className="font-medium">{opt.label}</span>
            </div>
            <div className="flex items-center gap-2">
              {typeof opt.value === "number" && (
                <span className="rounded-full bg-slate-900/5 px-2 py-0.5 text-[10px] text-slate-500">
                  {opt.value.toLocaleString()}
                </span>
              )}
              {opt.meta ? (
                <span className="text-[11px] text-slate-400">{opt.meta}</span>
              ) : null}
            </div>
          </label>
        ))}

        {pageItems.length === 0 && (
          <div className="p-4 text-center text-xs text-slate-400">
            No options match this search.
          </div>
        )}
      </div>

      {options.length >= 15 && (
        <footer className="mt-2 flex items-center justify-between text-xs text-slate-500">
          <div>
            {filtered.length} of {options.length} options
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* KPI rule builder                                                    */
/* ------------------------------------------------------------------ */

function KpiRuleBuilder({ fields, onRulesChange }) {
  const [root, setRoot] = useState(() => ({
    id: makeId(),
    logicalOp: "AND",
    children: [
      {
        id: makeId(),
        fieldId: fields?.[0]?.id ?? "",
        operator: ">",
        value: "",
      },
    ],
  }));

  const updateRoot = (updater) => {
    setRoot((prev) => {
      const next = updater(prev);
      if (onRulesChange) onRulesChange(next);
      return next;
    });
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">KPI rule builder</h2>
          <p className="text-sm text-slate-500">
            Build advanced KPI logic with nested groups, all/any, and regex support.
          </p>
        </div>
        <button
          type="button"
          className="rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
          onClick={() =>
            updateRoot(() => ({
              id: makeId(),
              logicalOp: "AND",
              children: [],
            }))
          }
        >
          Clear all
        </button>
      </header>

      <div className="flex-1 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
        <RuleGroupEditor
          group={root}
          fields={fields}
          isRoot
          onChange={(g) => updateRoot(() => g)}
        />
      </div>

      <footer className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
        <span>
          Use the resulting tree to generate SQL / GraphQL / engine rules on the backend.
        </span>
      </footer>
    </div>
  );
}

function RuleGroupEditor({ group, fields, isRoot, onChange }) {
  const updateGroup = (partial) => onChange({ ...group, ...partial });

  const updateChild = (index, child) => {
    const next = [...group.children];
    next[index] = child;
    updateGroup({ children: next });
  };

  const removeChild = (index) => {
    const next = group.children.filter((_, i) => i !== index);
    updateGroup({ children: next });
  };

  const addCondition = () => {
    const newCond = {
      id: makeId(),
      fieldId: fields?.[0]?.id ?? "",
      operator: ">",
      value: "",
    };
    updateGroup({ children: [...group.children, newCond] });
  };

  const addSubgroup = () => {
    const newGroup = {
      id: makeId(),
      logicalOp: "AND",
      children: [],
    };
    updateGroup({ children: [...group.children, newGroup] });
  };

  const isGroupNode = (node) => node && Array.isArray(node.children);

  return (
    <div className="mb-3 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {!isRoot && (
            <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">
              Group
            </span>
          )}
          <span className="text-slate-500">Match</span>
          <select
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
            value={group.logicalOp}
            onChange={(e) =>
              updateGroup({ logicalOp: e.target.value === "OR" ? "OR" : "AND" })
            }
          >
            <option value="AND">all conditions (AND)</option>
            <option value="OR">any condition (OR)</option>
          </select>
        </div>

        {!isRoot && (
          <button
            type="button"
            onClick={() => onChange(group)}
            className="text-[11px] text-slate-400 hover:text-red-500"
          >
            Remove group
          </button>
        )}
      </div>

      <div className="space-y-2">
        {group.children.map((child, index) => {
          const key = child.id;

          if (isGroupNode(child)) {
            return (
              <div key={key} className="border-l-2 border-dashed border-slate-200 pl-2">
                <RuleGroupEditor
                  group={child}
                  fields={fields}
                  onChange={(updated) => updateChild(index, updated)}
                />
                <button
                  type="button"
                  className="mt-1 text-[11px] text-slate-400 hover:text-red-500"
                  onClick={() => removeChild(index)}
                >
                  Remove group
                </button>
              </div>
            );
          }

          return (
            <RuleConditionRow
              key={key}
              condition={child}
              fields={fields}
              onChange={(updated) => updateChild(index, updated)}
              onRemove={() => removeChild(index)}
            />
          );
        })}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={addCondition}
          className="rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50"
        >
          + Add condition
        </button>
        <button
          type="button"
          onClick={addSubgroup}
          className="rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50"
        >
          + Add subgroup
        </button>
      </div>
    </div>
  );
}

function RuleConditionRow({ condition, fields, onChange, onRemove }) {
  const field = fields.find((f) => f.id === condition.fieldId) || fields[0];

  const numericOperators = [">", ">=", "<", "<=", "=", "!=", "between"];
  const stringOperators = [
    "contains",
    "doesNotContain",
    "startsWith",
    "endsWith",
    "=",
    "!=",
    "regex",
  ];

  const operators = field?.type === "number" ? numericOperators : stringOperators;

  const handleChange = (partial) => onChange({ ...condition, ...partial });

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
      <span className="text-slate-500">Where</span>

      <select
        className="min-w-[140px] rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
        value={condition.fieldId}
        onChange={(e) => handleChange({ fieldId: e.target.value })}
      >
        {fields.map((f) => (
          <option key={f.id} value={f.id}>
            {f.label}
          </option>
        ))}
      </select>

      <select
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
        value={condition.operator}
        onChange={(e) => handleChange({ operator: e.target.value })}
      >
        {operators.map((op) => (
          <option key={op} value={op}>
            {operatorLabel(op)}
          </option>
        ))}
      </select>

      {condition.operator === "between" ? (
        <>
          <input
            type="number"
            className="w-24 rounded-md border border-slate-300 px-2 py-1 text-xs"
            value={condition.value}
            onChange={(e) => handleChange({ value: e.target.value })}
            placeholder="Min"
          />
          <span className="text-slate-500">and</span>
          <input
            type="number"
            className="w-24 rounded-md border border-slate-300 px-2 py-1 text-xs"
            value={condition.valueTo ?? ""}
            onChange={(e) => handleChange({ valueTo: e.target.value })}
            placeholder="Max"
          />
        </>
      ) : (
        <input
          type={field?.type === "number" && condition.operator !== "regex" ? "number" : "text"}
          className="w-40 rounded-md border border-slate-300 px-2 py-1 text-xs"
          value={condition.value}
          onChange={(e) => handleChange({ value: e.target.value })}
          placeholder={
            condition.operator === "regex"
              ? "Regex pattern"
              : field?.type === "number"
                ? "Value"
                : "Text"
          }
        />
      )}

      <button
        type="button"
        onClick={onRemove}
        className="ml-auto text-[11px] text-slate-400 hover:text-red-500"
      >
        Remove
      </button>
    </div>
  );
}

function operatorLabel(op) {
  switch (op) {
    case ">":
      return "greater than";
    case ">=":
      return "greater or equal";
    case "<":
      return "less than";
    case "<=":
      return "less or equal";
    case "=":
      return "is";
    case "!=":
      return "is not";
    case "between":
      return "between";
    case "contains":
      return "contains";
    case "doesNotContain":
      return "does not contain";
    case "startsWith":
      return "starts with";
    case "endsWith":
      return "ends with";
    case "regex":
      return "matches regex";
    default:
      return op;
  }
}

/* ------------------------------------------------------------------ */
/* Demo wrapper so you can preview quickly                              */
/* ------------------------------------------------------------------ */

const mockKeywords = [
  { id: "kw_generic", label: "generic ice cream", meta: "48.3% volume", value: 12000 },
  { id: "kw_delivery", label: "ice cream delivery", meta: "3.8% volume", value: 5400 },
  { id: "kw_cone", label: "cone ice cream", meta: "2.9% volume", value: 4200 },
  { id: "kw_cornetto", label: "cornetto", meta: "brand", value: 11000 },
  { id: "kw_competitor", label: "amul ice cream", meta: "competitor", value: 9000 },
  { id: "kw_family", label: "family pack ice cream", meta: "niche", value: 3000 },
  { id: "kw_kulfi", label: "kulfi", meta: "regional", value: 3500 },
  { id: "kw_cup", label: "cup ice cream", meta: "format", value: 2700 },
  { id: "kw_sundae", label: "sundae", meta: "format", value: 1900 },
  { id: "kw_choco", label: "chocolate ice cream", meta: "flavour", value: 10000 },
];

const mockSkus = [
  { id: "sku_cd_105", label: "Cornetto Double Chocolate 105 ml", meta: "SKU", value: 5200 },
  { id: "sku_kw_van_90", label: "Kwality Walls Vanilla 90 ml", meta: "SKU", value: 4700 },
  { id: "sku_kw_cone", label: "Kwality Walls Cone 105 ml", meta: "SKU", value: 6100 },
];

const mockCities = [
  { id: "city_delhi", label: "Delhi NCR", meta: "Metro", value: 15000 },
  { id: "city_mumbai", label: "Mumbai", meta: "Metro", value: 16000 },
  { id: "city_blr", label: "Bangalore", meta: "Metro", value: 14000 },
  { id: "city_pune", label: "Pune", meta: "Tier 1", value: 8000 },
  { id: "city_jaipur", label: "Jaipur", meta: "Tier 2", value: 6000 },
];

const mockPlatforms = [
  { id: "plat_blinkit", label: "Blinkit", meta: "q‑commerce" },
  { id: "plat_zepto", label: "Zepto", meta: "q‑commerce" },
  { id: "plat_instamart", label: "Swiggy Instamart", meta: "q‑commerce" },
  { id: "plat_bb", label: "BigBasket", meta: "e‑grocery" },
];

const mockKpiFields = [
  { id: "catImpShare", label: "Cat Imp Share %", type: "number" },
  { id: "adSov", label: "Ad SOV %", type: "number" },
  { id: "orgSov", label: "Organic SOV %", type: "number" },
  { id: "overallSov", label: "Overall SOV %", type: "number" },
  { id: "adPos", label: "Ad position", type: "number" },
  { id: "orgPos", label: "Organic position", type: "number" },
];

export default function DemoKpiFilterPanel() {
  const [debug, setDebug] = useState("");

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="w-[1100px] max-w-full">
        <KpiFilterPanel
          keywords={mockKeywords}
          skus={mockSkus}
          cities={mockCities}
          platforms={mockPlatforms}
          kpiFields={mockKpiFields}
          onKeywordChange={(ids) => setDebug(`Keywords: ${ids.join(", ")}`)}
          onRulesChange={(tree) =>
            setDebug(`Rule tree updated. Size ~${JSON.stringify(tree).length} chars`)
          }
        />
        <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-white p-2 text-[11px] text-slate-500">
          {debug || "Interact with filters / KPI rules to see debug text here."}
        </div>
      </div>
    </div>
  );
}
