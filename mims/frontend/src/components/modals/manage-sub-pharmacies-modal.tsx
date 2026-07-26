/**
 * Manage Sub-Pharmacies Modal
 * Pick which existing pharmacies are bundled under a main pharmacy.
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { Loader2, Search, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import api from '@/lib/api';

interface Pharmacy {
  id: string;
  name: string;
  code: string;
  type: 'MAIN' | 'SUB';
  parentPharmacyId?: string | null;
  locationWard?: string;
  status: string;
  hospitalId: string;
  _count?: {
    subPharmacies?: number;
  };
}

interface ManageSubPharmaciesModalProps {
  /** The main pharmacy whose bundle is being edited. */
  mainPharmacy: Pharmacy | null;
  /** Every pharmacy currently loaded, used to derive selectable candidates. */
  allPharmacies: Pharmacy[];
  onClose: () => void;
  onSaved: () => void;
}

export function ManageSubPharmaciesModal({
  mainPharmacy,
  allPharmacies,
  onClose,
  onSaved,
}: ManageSubPharmaciesModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sub-pharmacies in the same hospital. Mains are deliberately excluded so a
  // main can never be demoted by accident from this screen.
  const candidates = useMemo(() => {
    if (!mainPharmacy) return [];
    return allPharmacies
      .filter(
        (p) =>
          p.id !== mainPharmacy.id &&
          p.hospitalId === mainPharmacy.hospitalId &&
          p.type === 'SUB' &&
          (p._count?.subPharmacies ?? 0) === 0
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [mainPharmacy, allPharmacies]);

  const nameById = useMemo(
    () => new Map(allPharmacies.map((p) => [p.id, p.name])),
    [allPharmacies]
  );

  // Pre-tick whatever is already bundled under this main
  useEffect(() => {
    if (mainPharmacy) {
      setSelectedIds(
        allPharmacies
          .filter((p) => p.parentPharmacyId === mainPharmacy.id)
          .map((p) => p.id)
      );
      setSearchTerm('');
      setError(null);
    }
  }, [mainPharmacy, allPharmacies]);

  const visible = candidates.filter((p) => {
    const q = searchTerm.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      (p.locationWard || '').toLowerCase().includes(q)
    );
  });

  const toggle = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const handleSave = async () => {
    if (!mainPharmacy) return;

    setLoading(true);
    setError(null);
    try {
      await api.patch(`/pharmacies/${mainPharmacy.id}/sub-pharmacies`, {
        subPharmacyIds: selectedIds,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(
        err.response?.data?.message || 'Failed to update sub-pharmacies'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={!!mainPharmacy}
      onOpenChange={(open) => !open && !loading && onClose()}
    >
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Sub-Pharmacies</DialogTitle>
          <DialogDescription>
            Select the pharmacies that belong under{' '}
            <span className="font-medium">{mainPharmacy?.name}</span>. Unticking
            one removes it from this bundle.
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search by name, code, or location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Candidate list */}
        <div className="flex-1 overflow-y-auto -mx-1 px-1 min-h-[200px]">
          {visible.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              {candidates.length === 0
                ? 'No sub-pharmacies in this hospital are available to bundle.'
                : 'No sub-pharmacies match your search.'}
            </div>
          ) : (
            <div className="space-y-1">
              {visible.map((pharmacy) => {
                const checked = selectedIds.includes(pharmacy.id);
                const otherParent =
                  pharmacy.parentPharmacyId &&
                  pharmacy.parentPharmacyId !== mainPharmacy?.id
                    ? nameById.get(pharmacy.parentPharmacyId)
                    : null;

                return (
                  <label
                    key={pharmacy.id}
                    className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggle(pharmacy.id)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">
                          {pharmacy.name}
                        </span>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {pharmacy.code}
                        </code>
                        {pharmacy.status !== 'ACTIVE' && (
                          <Badge variant="secondary">{pharmacy.status}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {pharmacy.locationWard || 'No location set'}
                      </p>
                      {otherParent && (
                        <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                          Currently under {otherParent} — ticking this moves it
                          here.
                        </p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-destructive p-3 bg-destructive/10">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            <Store className="w-4 h-4" />
            {selectedIds.length} selected
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? 'Saving...' : 'Save Bundle'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
