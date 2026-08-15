import { Prisma } from '@prisma/client';
import { TableSpec } from './merge-plan';

/**
 * Build the merge plan for EVERY table from Prisma's own model metadata.
 *
 * A hand-written list was wrong twice over: it covered a fraction of the
 * schema, and a column named as a string failed only once a live restore
 * reached that table. Derived from the datamodel, the plan cannot name a
 * column that does not exist, and it grows a new table the moment the schema
 * does.
 *
 * WHAT IS DERIVED
 *   order       — parents before children, from the required relations
 *   remap       — every foreign key column, onto the table it points at
 *   nullable    — optional foreign keys, emptied when their target is absent
 *   naturalKey  — the model's declared unique constraint, where it has one
 *   strategy    — 'natural' when a unique constraint exists, else 'id'
 *
 * WHY 'id' IS A SAFE FALLBACK
 * A table with no unique constraint is almost always transactional — a
 * dispatch, an item line, a charge. Those are raised in one system and never
 * in both, so the uuid is a sound identity and keeping it makes a repeat run
 * find the row rather than duplicate it. The exceptions are catalogue tables
 * that simply never declared a constraint, and those are named below.
 */

/** Tables whose identity the schema does not declare, but which are real things. */
const NATURAL_KEY_OVERRIDES: Record<string, string[]> = {
  // Without this the catalogue duplicates: a medicine is the same medicine
  // when the name, strength and form match within a hospital.
  medicine: ['hospitalId', 'name', 'strength', 'form'],
  // A batch is identified by where it sits and what is written on it.
  stockBatch: ['hospitalId', 'pharmacyId', 'medicineId', 'batchNo', 'expiryDate'],
};

/**
 * Not merged, deliberately.
 * auditLog is the other system's account of its own activity — copying it
 * would put entries in this hospital's log for actions never performed here.
 * The sync bookkeeping describes a replication run, not hospital data.
 */
const EXCLUDED = new Set(['auditLog', 'syncOperation']);

const delegateOf = (modelName: string) => modelName[0].toLowerCase() + modelName.slice(1);

interface Relation {
  /** the scalar column holding the id, e.g. hospitalId */
  column: string;
  /** delegate name of the table it points at */
  target: string;
  required: boolean;
}

function relationsOf(model: Prisma.DMMF.Model): Relation[] {
  const out: Relation[] = [];
  for (const field of model.fields) {
    if (field.kind !== 'object') continue;
    const from = field.relationFromFields;
    // A one-sided relation has no local column; only the owning side does.
    if (!from || from.length !== 1) continue;

    const scalar = model.fields.find((f) => f.name === from[0]);
    out.push({
      column: from[0],
      target: delegateOf(field.type),
      required: scalar?.isRequired ?? false,
    });
  }
  return out;
}

/** The declared unique constraint to match on, if the model has a usable one. */
function declaredNaturalKey(model: Prisma.DMMF.Model): string[] | null {
  const single = model.fields.find((f) => f.isUnique && !f.isId);
  if (single) return [single.name];

  const composite = model.uniqueFields?.find((fields) => fields.length > 0);
  return composite ? [...composite] : null;
}

export function buildMergePlan(): TableSpec[] {
  const models = Prisma.dmmf.datamodel.models.filter(
    (m) => !EXCLUDED.has(delegateOf(m.name)),
  );

  const byDelegate = new Map(models.map((m) => [delegateOf(m.name), m]));

  // ── Order: a table can only be placed once what it points at has been ─────
  const ordered: Prisma.DMMF.Model[] = [];
  const placed = new Set<string>();
  const remaining = [...models];

  while (remaining.length > 0) {
    // Anything whose required parents are already down
    const ready = remaining.filter((m) => {
      const self = delegateOf(m.name);
      return relationsOf(m).every(
        (r) => !r.required || r.target === self || placed.has(r.target) || !byDelegate.has(r.target),
      );
    });

    if (ready.length === 0) {
      // A cycle of required relations. Take the one with the fewest unmet
      // parents and continue: rows whose parent is genuinely missing are
      // reported as skipped rather than silently dropped.
      remaining.sort(
        (a, b) =>
          relationsOf(a).filter((r) => r.required && !placed.has(r.target)).length -
          relationsOf(b).filter((r) => r.required && !placed.has(r.target)).length,
      );
      const forced = remaining.shift()!;
      ordered.push(forced);
      placed.add(delegateOf(forced.name));
      continue;
    }

    for (const m of ready) {
      ordered.push(m);
      placed.add(delegateOf(m.name));
      remaining.splice(remaining.indexOf(m), 1);
    }
  }

  // ── Turn each model into a spec ──────────────────────────────────────────
  return ordered.map((model) => {
    const delegate = delegateOf(model.name);
    const relations = relationsOf(model);

    const remap: Record<string, string> = {};
    const nullable: string[] = [];
    const userFallback: string[] = [];

    for (const r of relations) {
      if (!byDelegate.has(r.target)) {
        // Points at something not merged at all — leave it empty if allowed,
        // and let the row be skipped with a reason if it is required.
        if (!r.required) nullable.push(r.column);
        continue;
      }

      remap[r.column] = r.target;

      if (!r.required) {
        nullable.push(r.column);
      } else if (r.target === 'user') {
        // Required, and whoever did it in the other system may not exist here.
        // Attribute it to the person running the restore rather than lose the
        // record — the alternative is dropping real clinical history.
        userFallback.push(r.column);
      }
    }

    // A self-reference cannot be resolved on the pass that creates the row.
    const selfRefs = relations.filter((r) => r.target === delegate).map((r) => r.column);
    for (const column of selfRefs) {
      delete remap[column];
      if (!nullable.includes(column)) nullable.push(column);
    }

    const naturalKey = NATURAL_KEY_OVERRIDES[delegate] ?? declaredNaturalKey(model);

    return {
      label: model.name,
      model: delegate,
      strategy: naturalKey ? 'natural' : 'id',
      naturalKey: naturalKey ?? undefined,
      remap,
      nullable,
      userFallback,
      mapKey: delegate,
    } as TableSpec;
  });
}
