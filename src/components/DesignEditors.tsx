"use client";

import type { DesignEntity, DesignRelationship, PatternUsage } from "@/domain/submission/StructuredDesignSubmission";

/**
 * Editors for the structured submission. Deliberately plain, form-like rows
 * — the point is capturing design decisions, not a diagram editor (which is
 * explicitly out of scope for this MVP).
 */

const KINDS: DesignEntity["kind"][] = ["class", "abstract-class", "interface"];
const REL_TYPES: DesignRelationship["type"][] = [
  "association",
  "aggregation",
  "composition",
  "inheritance",
  "implements",
  "dependency",
];

const inputClass =
  "w-full border border-line bg-raise px-2.5 py-1.5 text-sm text-paper placeholder:text-faint focus:border-amber/70 focus:outline-none";
const labelClass = "microlabel mb-1 block";
const addButtonClass =
  "w-full border border-dashed border-line-strong py-2.5 font-mono text-xs tracking-[0.12em] text-muted uppercase transition hover:border-amber/60 hover:text-amber";
const removeButtonClass =
  "border border-line px-2.5 py-1.5 font-mono text-xs text-muted transition hover:border-bad/60 hover:text-bad";

export function EntityEditor({
  entities,
  onChange,
  errors,
}: {
  entities: DesignEntity[];
  onChange: (next: DesignEntity[]) => void;
  errors: Map<string, string>;
}) {
  function update(index: number, patch: Partial<DesignEntity>) {
    onChange(entities.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  }

  return (
    <div className="space-y-4">
      {entities.map((entity, index) => {
        const nameError =
          errors.get(`entities.${entity.name}`) ??
          errors.get(`entities.${entity.name}.responsibilities`);
        return (
          <div key={index} className="border border-line bg-panel p-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto]">
              <div>
                <label className={labelClass} htmlFor={`entity-name-${index}`}>Name</label>
                <input
                  id={`entity-name-${index}`}
                  className={`${inputClass} font-mono`}
                  placeholder="ParkingLot"
                  value={entity.name}
                  onChange={(e) => update(index, { name: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor={`entity-kind-${index}`}>Kind</label>
                <select
                  id={`entity-kind-${index}`}
                  className={inputClass}
                  value={entity.kind}
                  onChange={(e) => update(index, { kind: e.target.value as DesignEntity["kind"] })}
                >
                  {KINDS.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => onChange(entities.filter((_, i) => i !== index))}
                  className={removeButtonClass}
                  aria-label={`Remove ${entity.name || "unnamed type"}`}
                >
                  Remove
                </button>
              </div>
            </div>
            {nameError && <p className="mt-2 text-xs text-bad">{nameError}</p>}

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor={`entity-resp-${index}`}>
                  Responsibilities (one per line)
                </label>
                <textarea
                  id={`entity-resp-${index}`}
                  rows={3}
                  className={inputClass}
                  placeholder={"Owns spot allocation\nTracks availability per floor"}
                  value={entity.responsibilities.join("\n")}
                  onChange={(e) =>
                    update(index, {
                      responsibilities: e.target.value.split("\n").map((s) => s.replace(/^-\s*/, "")),
                    })
                  }
                />
              </div>
              <div>
                <label className={labelClass} htmlFor={`entity-methods-${index}`}>
                  Key methods (one per line)
                </label>
                <textarea
                  id={`entity-methods-${index}`}
                  rows={3}
                  className={`${inputClass} font-mono text-[0.8125rem]`}
                  placeholder={"allocateSpot(vehicle): ParkingSpot"}
                  value={entity.keyMethods.join("\n")}
                  onChange={(e) =>
                    update(index, {
                      keyMethods: e.target.value.split("\n").map((s) => s.replace(/^-\s*/, "")),
                    })
                  }
                />
              </div>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor={`entity-extends-${index}`}>Extends (optional)</label>
                <input
                  id={`entity-extends-${index}`}
                  className={`${inputClass} font-mono`}
                  placeholder="Vehicle"
                  value={entity.extends ?? ""}
                  onChange={(e) => update(index, { extends: e.target.value || null })}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor={`entity-impl-${index}`}>Implements (comma separated)</label>
                <input
                  id={`entity-impl-${index}`}
                  className={`${inputClass} font-mono`}
                  placeholder="PricingStrategy"
                  value={entity.implements.join(", ")}
                  onChange={(e) =>
                    update(index, {
                      implements: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                    })
                  }
                />
              </div>
            </div>
          </div>
        );
      })}

      <button
        type="button"
        onClick={() =>
          onChange([...entities, { name: "", kind: "class", responsibilities: [], keyMethods: [], extends: null, implements: [] }])
        }
        className={addButtonClass}
      >
        + Add class / interface
      </button>
    </div>
  );
}

export function RelationshipEditor({
  relationships,
  entities,
  onChange,
  errors,
}: {
  relationships: DesignRelationship[];
  entities: DesignEntity[];
  onChange: (next: DesignRelationship[]) => void;
  errors: Map<string, string>;
}) {
  const names = entities.map((e) => e.name).filter(Boolean);

  function update(index: number, patch: Partial<DesignRelationship>) {
    onChange(relationships.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  return (
    <div className="space-y-3">
      {relationships.map((rel, index) => {
        const err =
          errors.get(`relationships[${index}].from`) ??
          errors.get(`relationships[${index}].to`) ??
          errors.get(`relationships[${index}]`);
        return (
          <div key={index} className="border border-line bg-panel p-4">
            <div className="grid items-end gap-3 sm:grid-cols-[1fr_140px_1fr_auto]">
              <div>
                <label className={labelClass} htmlFor={`rel-from-${index}`}>From</label>
                <input
                  id={`rel-from-${index}`}
                  list={`entity-names-${index}`}
                  className={`${inputClass} font-mono`}
                  value={rel.from}
                  onChange={(e) => update(index, { from: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor={`rel-type-${index}`}>Type</label>
                <select
                  id={`rel-type-${index}`}
                  className={inputClass}
                  value={rel.type}
                  onChange={(e) => update(index, { type: e.target.value as DesignRelationship["type"] })}
                >
                  {REL_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor={`rel-to-${index}`}>To</label>
                <input
                  id={`rel-to-${index}`}
                  list={`entity-names-${index}`}
                  className={`${inputClass} font-mono`}
                  value={rel.to}
                  onChange={(e) => update(index, { to: e.target.value })}
                />
              </div>
              <button
                type="button"
                onClick={() => onChange(relationships.filter((_, i) => i !== index))}
                className={removeButtonClass}
                aria-label={`Remove relationship ${index + 1}`}
              >
                ✕
              </button>
            </div>
            <datalist id={`entity-names-${index}`}>
              {names.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
            <input
              className={`${inputClass} mt-3`}
              placeholder="What does it mean? e.g. ParkingLot owns many ParkingSpots (composition)"
              value={rel.description}
              onChange={(e) => update(index, { description: e.target.value })}
            />
            {err && <p className="mt-2 text-xs text-bad">{err}</p>}
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => onChange([...relationships, { from: "", to: "", type: "association", description: "" }])}
        className={addButtonClass}
      >
        + Add relationship
      </button>
    </div>
  );
}

export function PatternEditor({
  patterns,
  onChange,
  errors,
}: {
  patterns: PatternUsage[];
  onChange: (next: PatternUsage[]) => void;
  errors: Map<string, string>;
}) {
  function update(index: number, patch: Partial<PatternUsage>) {
    onChange(patterns.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  return (
    <div className="space-y-3">
      <p className="border border-line bg-raise p-3 text-xs leading-relaxed text-muted">
        Naming a pattern earns nothing by itself. Each one needs a{" "}
        <span className="text-paper">justification</span>: which problem in{" "}
        <span className="text-paper">this design</span> does it solve?
      </p>

      {patterns.map((pattern, index) => {
        const err = errors.get(`patterns[${index}].justification`);
        return (
          <div key={index} className="border border-line bg-panel p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor={`pat-name-${index}`}>Pattern</label>
                <input
                  id={`pat-name-${index}`}
                  className={`${inputClass} font-mono`}
                  placeholder="Strategy"
                  value={pattern.name}
                  onChange={(e) => update(index, { name: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor={`pat-where-${index}`}>Where it applies</label>
                <input
                  id={`pat-where-${index}`}
                  className={`${inputClass} font-mono`}
                  placeholder="FeeCalculator pricing"
                  value={pattern.where}
                  onChange={(e) => update(index, { where: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-3">
              <label className={labelClass} htmlFor={`pat-why-${index}`}>Why it earns its place</label>
              <textarea
                id={`pat-why-${index}`}
                rows={2}
                className={inputClass}
                placeholder="Pricing varies by vehicle type and duration; strategies let new rules arrive without touching the exit flow."
                value={pattern.justification}
                onChange={(e) => update(index, { justification: e.target.value })}
              />
              {err && <p className="mt-2 text-xs text-bad">{err}</p>}
            </div>
            <button
              type="button"
              onClick={() => onChange(patterns.filter((_, i) => i !== index))}
              className="mt-2 font-mono text-xs text-muted transition hover:text-bad"
            >
              Remove
            </button>
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => onChange([...patterns, { name: "", where: "", justification: "" }])}
        className={addButtonClass}
      >
        + Add pattern usage
      </button>
    </div>
  );
}
