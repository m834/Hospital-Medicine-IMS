import { Prisma } from '@prisma/client';
import { buildMergePlan } from './plan-builder';

const plan = buildMergePlan();
const byModel = new Map(plan.map((s) => [s.model, s]));
const delegateOf = (n: string) => n[0].toLowerCase() + n.slice(1);

const MODEL_FIELDS = new Map(
  Prisma.dmmf.datamodel.models.map((m) => [
    delegateOf(m.name),
    new Set(m.fields.map((f) => f.name)),
  ]),
);

describe('buildMergePlan', () => {
  it('covers every model in the schema bar the deliberate exclusions', () => {
    const all = Prisma.dmmf.datamodel.models.map((m) => delegateOf(m.name));
    const missing = all.filter((m) => !byModel.has(m));

    // Audit logs and sync bookkeeping describe the OTHER system's activity
    expect(missing.sort()).toEqual(['auditLog', 'syncOperation']);
  });

  it('is substantially larger than the hand-written list it replaced', () => {
    expect(plan.length).toBeGreaterThan(50);
  });

  it('names only columns that exist on their model', () => {
    const bad: string[] = [];

    for (const spec of plan) {
      const fields = MODEL_FIELDS.get(spec.model)!;
      const columns = [
        ...(spec.naturalKey ?? []),
        ...Object.keys(spec.remap ?? {}),
        ...(spec.nullable ?? []),
        ...(spec.userFallback ?? []),
      ];
      for (const c of columns) {
        if (!fields.has(c)) bad.push(`${spec.model}.${c}`);
      }
    }

    expect(bad).toEqual([]);
  });

  it('places a table only after everything its required keys point at', () => {
    const placed = new Set<string>();
    const bad: string[] = [];

    for (const spec of plan) {
      for (const target of Object.values(spec.remap ?? {})) {
        const optional = spec.nullable?.includes(
          Object.keys(spec.remap!).find((k) => spec.remap![k] === target)!,
        );
        if (!placed.has(target) && target !== spec.model && !optional) {
          bad.push(`${spec.model} needs ${target} placed first`);
        }
      }
      placed.add(spec.model);
    }

    expect(bad).toEqual([]);
  });

  it('never tries to resolve a self-reference during insert', () => {
    for (const spec of plan) {
      for (const [column, target] of Object.entries(spec.remap ?? {})) {
        expect(target).not.toBe(spec.model);
        expect(column).toBeTruthy();
      }
    }
    // Pharmacy points at its own parent; that column must be deferred
    expect(byModel.get('pharmacy')?.nullable).toContain('parentPharmacyId');
  });

  it('keeps the identities that the schema does not declare', () => {
    // No unique constraint exists on either, so without an override the
    // catalogue and the shelf would duplicate on every merge
    expect(byModel.get('medicine')?.naturalKey).toEqual([
      'hospitalId', 'name', 'strength', 'form',
    ]);
    expect(byModel.get('stockBatch')?.strategy).toBe('natural');
  });

  it('uses declared unique constraints where they exist', () => {
    expect(byModel.get('patient')?.naturalKey).toEqual(['nrNumber']);
    expect(byModel.get('user')?.naturalKey).toEqual(['email']);
    expect(byModel.get('hospital')?.naturalKey).toEqual(['code']);
  });

  it('falls back to the original id for transactional tables', () => {
    // Dispatch items have no natural identity — they belong to their dispatch
    expect(byModel.get('prescriptionDispatchItem')?.strategy).toBe('id');
  });

  it('lets a required author fall back rather than block the row', () => {
    const spec = byModel.get('prescriptionMedicine')!;
    expect(spec.userFallback).toContain('addedBy');
  });
});
