/**
 * Delete Hospital Confirmation Dialog
 * Warning dialog with CASCADE deletion information
 */

'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, Loader2, X, Building2, Users, Activity, FileText, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api, { getErrorMessage } from '@/lib/api';

interface Hospital {
  id: string;
  name: string;
  code: string;
  _count?: {
    users: number;
    pharmacies: number;
    patients: number;
    medicines?: number;
    prescriptions?: number;
    issueTransactions?: number;
  };
}

interface DeleteHospitalDialogProps {
  isOpen: boolean;
  hospital: Hospital | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function DeleteHospitalDialog({ isOpen, hospital, onClose, onSuccess }: DeleteHospitalDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [hospitalDetails, setHospitalDetails] = useState<Hospital | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Fetch detailed hospital info including counts
  useEffect(() => {
    if (isOpen && hospital) {
      fetchHospitalDetails();
      setConfirmText(''); // Reset confirmation text
      setError(null);
    }
  }, [isOpen, hospital]);

  const fetchHospitalDetails = async () => {
    if (!hospital) return;

    setLoadingDetails(true);
    try {
      const response = await api.get(`/hospitals/${hospital.id}`);
      setHospitalDetails(response.data);
    } catch (err) {
      console.error('Failed to fetch hospital details:', err);
      setHospitalDetails(hospital); // Fallback to passed hospital
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleDelete = async () => {
    if (!hospital) return;

    // Validate confirmation text
    if (confirmText !== hospital.code) {
      setError(`Please type "${hospital.code}" to confirm deletion`);
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      await api.delete(`/hospitals/${hospital.id}`);
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen || !hospital) return null;

  const counts: any = hospitalDetails?._count || hospital._count || {};
  const hasRecords = (counts.users || 0) > 0 ||
                     (counts.pharmacies || 0) > 0 ||
                     (counts.patients || 0) > 0 ||
                     (counts.medicines || 0) > 0 ||
                     (counts.prescriptions || 0) > 0 ||
                     (counts.issueTransactions || 0) > 0;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose} />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card shadow-2xl animate-scale-in">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Delete Hospital - CASCADE WARNING</h2>
                <p className="text-sm text-muted-foreground">This will delete ALL related data permanently</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              disabled={isDeleting}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {error && (
              <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-4">
              {/* Hospital Info */}
              <div className="rounded-lg border border-border bg-muted/50 p-4">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-semibold text-foreground">{hospital.name}</p>
                    <p className="text-sm text-muted-foreground">Code: {hospital.code}</p>
                  </div>
                </div>
              </div>

              {/* Critical Warning */}
              <div className="rounded-lg border-l-4 border-destructive bg-destructive/5 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
                  <div className="space-y-2">
                    <p className="font-semibold text-destructive">⚠️ CRITICAL: This action CANNOT be undone!</p>
                    <p className="text-sm text-foreground">
                      Deleting this hospital will <strong>PERMANENTLY DELETE</strong> all associated records:
                    </p>
                  </div>
                </div>
              </div>

              {/* Related Records Count */}
              {loadingDetails ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading hospital data...</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-foreground">The following will be DELETED:</p>
                  
                  <div className="grid gap-3 sm:grid-cols-2">
                    {/* Users */}
                    <div className={`rounded-lg border p-3 ${(counts.users || 0) > 0 ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-muted/50'}`}>
                      <div className="flex items-center gap-2">
                        <Users className={`h-4 w-4 ${(counts.users || 0) > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
                        <span className="text-sm font-medium text-foreground">Users</span>
                      </div>
                      <p className={`mt-1 text-2xl font-bold ${(counts.users || 0) > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {counts.users || 0}
                      </p>
                    </div>

                    {/* Pharmacies */}
                    <div className={`rounded-lg border p-3 ${(counts.pharmacies || 0) > 0 ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-muted/50'}`}>
                      <div className="flex items-center gap-2">
                        <Building2 className={`h-4 w-4 ${(counts.pharmacies || 0) > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
                        <span className="text-sm font-medium text-foreground">Pharmacies</span>
                      </div>
                      <p className={`mt-1 text-2xl font-bold ${(counts.pharmacies || 0) > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {counts.pharmacies || 0}
                      </p>
                    </div>

                    {/* Patients */}
                    <div className={`rounded-lg border p-3 ${(counts.patients || 0) > 0 ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-muted/50'}`}>
                      <div className="flex items-center gap-2">
                        <Activity className={`h-4 w-4 ${(counts.patients || 0) > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
                        <span className="text-sm font-medium text-foreground">Patients</span>
                      </div>
                      <p className={`mt-1 text-2xl font-bold ${(counts.patients || 0) > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {counts.patients || 0}
                      </p>
                    </div>

                    {/* Medicines */}
                    <div className={`rounded-lg border p-3 ${(counts.medicines || 0) > 0 ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-muted/50'}`}>
                      <div className="flex items-center gap-2">
                        <Package className={`h-4 w-4 ${(counts.medicines || 0) > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
                        <span className="text-sm font-medium text-foreground">Medicines</span>
                      </div>
                      <p className={`mt-1 text-2xl font-bold ${(counts.medicines || 0) > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {counts.medicines || 0}
                      </p>
                    </div>

                    {/* Prescriptions */}
                    <div className={`rounded-lg border p-3 ${(counts.prescriptions || 0) > 0 ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-muted/50'}`}>
                      <div className="flex items-center gap-2">
                        <FileText className={`h-4 w-4 ${(counts.prescriptions || 0) > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
                        <span className="text-sm font-medium text-foreground">Prescriptions</span>
                      </div>
                      <p className={`mt-1 text-2xl font-bold ${(counts.prescriptions || 0) > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {counts.prescriptions || 0}
                      </p>
                    </div>

                    {/* Issue Transactions */}
                    <div className={`rounded-lg border p-3 ${(counts.issueTransactions || 0) > 0 ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-muted/50'}`}>
                      <div className="flex items-center gap-2">
                        <Activity className={`h-4 w-4 ${(counts.issueTransactions || 0) > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
                        <span className="text-sm font-medium text-foreground">Transactions</span>
                      </div>
                      <p className={`mt-1 text-2xl font-bold ${(counts.issueTransactions || 0) > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {counts.issueTransactions || 0}
                      </p>
                    </div>
                  </div>

                  {hasRecords && (
                    <div className="rounded-lg border-l-4 border-orange-500 bg-orange-500/10 p-4">
                      <p className="text-sm font-semibold text-orange-700 dark:text-orange-400">
                        ⚠️ Hospital has active records! Deleting will permanently remove all data listed above.
                      </p>
                    </div>
                  )}

                  {!hasRecords && (
                    <div className="rounded-lg border-l-4 border-green-500 bg-green-500/10 p-4">
                      <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                        ✓ Hospital has no records. Safe to delete.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Confirmation Input */}
              <div className="space-y-2">
                <Label htmlFor="confirm" className="text-foreground">
                  Type <span className="font-mono font-bold text-destructive">{hospital.code}</span> to confirm deletion:
                </Label>
                <Input
                  id="confirm"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={`Type ${hospital.code} to confirm`}
                  disabled={isDeleting}
                  className="font-mono"
                  autoComplete="off"
                />
              </div>

              {/* Additional Info */}
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">
                  <strong>Note:</strong> This will also delete all stock batches, purchase orders, GRNs, transfer requests, 
                  return transactions, alerts, audit logs, sync operations, and system configs related to this hospital.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-6 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting || confirmText !== hospital.code || loadingDetails}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    Delete Hospital & All Data
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
