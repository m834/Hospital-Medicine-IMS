'use client';

import { useMemo } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useHospitalStore } from '@/stores/hospital.store';
import { UserRole } from '@/lib/constants';
import { useGetReferrals, Referral } from '@/hooks/use-referrals';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatMRN } from '@/lib/mrn';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function ReferralsPage() {
  const { user } = useAuthStore();
  const { selectedHospital } = useHospitalStore();

  const isMasterOrSuper = user?.role === UserRole.MASTER_ADMIN || user?.role === UserRole.SUPER_ADMIN;
  const hospitalId = selectedHospital?.id || user?.hospitalId;
  const shouldWarnNoHospital = isMasterOrSuper && !hospitalId;

  const filters = useMemo(() => {
    return hospitalId ? { hospitalId, page: 1, limit: 50 } : { page: 1, limit: 50 };
  }, [hospitalId]);

  const { data, isLoading } = useGetReferrals(filters);
  const referrals = data?.data || [];

  if (shouldWarnNoHospital) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Please select a hospital from the dropdown to proceed</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Referrals</h1>
        <p className="text-muted-foreground">View referrals sent by you and referrals received</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Referral List</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading referrals...</p>
          ) : referrals.length === 0 ? (
            <p className="text-muted-foreground">No referrals found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Direction</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>From Department</TableHead>
                  <TableHead>To Department</TableHead>
                  <TableHead>Referrer</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {referrals.map((referral: Referral) => {
                  const isOutgoing = referral.referrer?.id && referral.referrer.id === user?.id;
                  const patientName = referral.visit?.patient
                    ? `${referral.visit.patient.firstName} ${referral.visit.patient.lastName}`
                    : 'N/A';
                  return (
                    <TableRow key={referral.id}>
                      <TableCell>
                        <Badge variant={isOutgoing ? 'default' : 'secondary'}>
                          {isOutgoing ? 'Outgoing' : 'Incoming'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium">{patientName}</p>
                          <p className="text-xs text-muted-foreground">MRN: {formatMRN(referral.visit?.patient?.nrNumber) || 'N/A'}</p>
                        </div>
                      </TableCell>
                      <TableCell>{referral.fromDepartment?.name || 'N/A'}</TableCell>
                      <TableCell>{referral.toDepartment?.name || 'N/A'}</TableCell>
                      <TableCell>
                        {referral.referrer?.firstName
                          ? `${referral.referrer.firstName} ${referral.referrer.lastName}`
                          : referral.referrer?.id || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{referral.referralType}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{referral.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {referral.createdAt ? new Date(referral.createdAt).toLocaleString() : 'N/A'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
