import { Prisma } from '@prisma/client';
import { MERGE_PLAN } from './merge-plan';

/**
 * The merge plan names models and columns as strings, so a typo or a renamed
 * field compiles perfectly and fails at run time, part-way through a live
 * restore — which is exactly how "Unknown argument `name`" reached production
 * and stopped a merge after six tables.
 *
 * These check the plan against Prisma's own model metadata, so the build
 * catches it instead of the customer.
 */

const MODELS = new Map(
  Prisma.dmmf.datamodel.models.map((m) => [
    m.name[0].toLowerCase() + m.name.slice(1),
    new Set(m.fields.map((f) => f.name)),
  ]),
);

describe('MERGE_PLAN', () => {
  it('names only models that exist', () => {
    for (const spec of MERGE_PLAN) {
      expect(MODELS.has(spec.model)).toBe(true);
    }
  });

  it('names only columns that exist on their model', () => {
    const bad: string[] = [];

    for (const spec of MERGE_PLAN) {
      const fields = MODELS.get(spec.model);
      if (!fields) continue;

      const columns = [
        ...(spec.naturalKey ?? []),
        ...Object.keys(spec.remap ?? {}),
        ...(spec.nullable ?? []),
        ...(spec.userFallback ?? []),
      ];

      for (const column of columns) {
        if (!fields.has(column)) bad.push(`${spec.label} (${spec.model}).${column}`);
      }
    }

    expect(bad).toEqual([]);
  });

  it('gives every natural-key table a key to match on', () => {
    for (const spec of MERGE_PLAN) {
      if (spec.strategy === 'natural') {
        expect(spec.naturalKey?.length ?? 0).toBeGreaterThan(0);
      }
    }
  });

  it('only remaps onto a table that is mapped earlier in the plan', () => {
    const availableByThen = new Set<string>();
    const bad: string[] = [];

    for (const spec of MERGE_PLAN) {
      for (const mapKey of Object.values(spec.remap ?? {})) {
        // A row can only be repointed once its target has been placed
        if (!availableByThen.has(mapKey)) bad.push(`${spec.label} needs '${mapKey}' before it`);
      }
      if (spec.mapKey) availableByThen.add(spec.mapKey);
    }

    expect(bad).toEqual([]);
  });

  it('keeps a required foreign key resolvable — fallback or nullable, never stuck', () => {
    // A remapped column that is neither nullable nor user-fallback will block
    // the whole row if its target is missing. That is intended for structural
    // parents (hospital, prescription) but a mistake for an author column.
    const authorish = /(By|ById)$/;
    const bad: string[] = [];

    for (const spec of MERGE_PLAN) {
      for (const column of Object.keys(spec.remap ?? {})) {
        if (!authorish.test(column)) continue;
        const handled =
          spec.userFallback?.includes(column) || spec.nullable?.includes(column);
        if (!handled) bad.push(`${spec.label}.${column}`);
      }
    }

    expect(bad).toEqual([]);
  });
});
