import api from './api';

/**
 * The /medicines endpoint is paginated and sorted by name ascending, so a
 * single request with a fixed limit silently drops everything past that limit.
 * Medicines late in the alphabet then disappear from pickers even when the
 * pharmacy holds stock — the catalogue outgrew the cap without anything
 * failing visibly.
 *
 * Fetch page 1, read the real page count from meta, then pull the remainder in
 * parallel. Correct regardless of how large the catalogue grows.
 */
const PAGE_SIZE = 500;

export async function fetchAllMedicines<T = any>(hospitalId: string): Promise<T[]> {
  const first = await api.get('/medicines', {
    params: { hospitalId, limit: PAGE_SIZE, page: 1 },
  });
  const firstPage: T[] = first.data?.data ?? first.data ?? [];
  const totalPages: number = first.data?.meta?.totalPages ?? 1;

  if (totalPages <= 1) return firstPage;

  const rest = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, i) =>
      api.get('/medicines', { params: { hospitalId, limit: PAGE_SIZE, page: i + 2 } }),
    ),
  );

  return rest.reduce<T[]>((all, res) => all.concat(res.data?.data ?? res.data ?? []), firstPage);
}
