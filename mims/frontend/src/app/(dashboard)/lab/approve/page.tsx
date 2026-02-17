"use client";

import { useState } from "react";
import { useLabOrders, useApproveResult, downloadLabResultPdf } from "@/hooks/use-lab-orders";
import { useHospitalStore } from "@/stores/hospital.store";
import { useAuthStore } from "@/stores/auth.store";
import { UserRole } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Search, CheckCircle, Download, FileText, User, TestTube } from "lucide-react";
import type { LabOrder } from "@/hooks/use-lab-orders";

export default function LabApprovePage() {
  const { selectedHospital } = useHospitalStore();
  const { user, token } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<LabOrder | null>(null);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState("");

  // Get hospital ID - Master/Super Admin use dropdown, others use user.hospitalId
  const hospitalId = selectedHospital?.id || user?.hospitalId;
  const isMasterOrSuper = user?.role === UserRole.MASTER_ADMIN || user?.role === UserRole.SUPER_ADMIN;

  const { data: completedOrders } = useLabOrders(hospitalId || "", {
    status: "COMPLETED",
  });

  const approveMutation = useApproveResult();

  const filteredOrders = completedOrders?.filter((order) =>
    order.orderNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.patient?.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.labTest?.testName?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const handleApprove = async () => {
    if (!selectedOrder || !user) return;

    await approveMutation.mutateAsync({
      orderId: selectedOrder.id,
      data: {
        resultsApprovedById: user.id,
        approvalNotes,
      },
    });

    setIsApproveDialogOpen(false);
    setSelectedOrder(null);
    setApprovalNotes("");
  };

  const openApproveDialog = (order: LabOrder) => {
    setSelectedOrder(order);
    setIsApproveDialogOpen(true);
  };

  if (isMasterOrSuper && !selectedHospital) {
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

  if (!hospitalId) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Loading hospital information...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Result Approval</h1>
        <p className="text-muted-foreground">Review and approve lab test results</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by order number, patient name, or test..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredOrders?.map((order) => (
          <Card key={order.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{order.patient?.fullName}</CardTitle>
                  <CardDescription className="font-mono text-xs mt-1">
                    {order.orderNumber}
                  </CardDescription>
                </div>
                <Badge variant="outline">{order.priority}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-xs text-muted-foreground">Test</Label>
                  <p className="font-medium">{order.labTest?.testName}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Category</Label>
                  <p>{order.labTest?.testCategory}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Entered By</Label>
                  <p>{order.resultsEnteredBy?.fullName}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Entered At</Label>
                  <p className="text-xs">
                    {order.resultsEnteredAt
                      ? new Date(order.resultsEnteredAt).toLocaleString()
                      : "N/A"}
                  </p>
                </div>
              </div>

              {/* Results Preview */}
              {order.results && (
                <div className="border rounded-lg p-3 bg-muted/50">
                  <Label className="text-xs text-muted-foreground mb-2 block">Results</Label>
                  <div className="space-y-1">
                    {Array.isArray(order.results) ? (
                      order.results.map((result: any, idx: number) => (
                        <div key={idx} className="text-sm grid grid-cols-4 gap-2">
                          <span className="font-medium">{result.parameter}:</span>
                          <span>{result.value}</span>
                          <span className="text-muted-foreground">{result.unit}</span>
                          <span className="text-xs text-muted-foreground">{result.normalRange}</span>
                        </div>
                      ))
                    ) : (
                      <pre className="text-xs">{JSON.stringify(order.results, null, 2)}</pre>
                    )}
                  </div>
                </div>
              )}

              {order.resultNotes && (
                <div className="text-sm">
                  <Label className="text-xs text-muted-foreground">Notes</Label>
                  <p className="text-muted-foreground mt-1">{order.resultNotes}</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => openApproveDialog(order)}>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Approve
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Approve Dialog */}
      <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Lab Results</DialogTitle>
            <DialogDescription>
              Review and approve results for {selectedOrder?.patient?.fullName}
            </DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-muted rounded-lg space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">Order:</span>
                  <span className="font-mono">{selectedOrder.orderNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Test:</span>
                  <span>{selectedOrder.labTest?.testName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Patient:</span>
                  <span>{selectedOrder.patient?.fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Entered By:</span>
                  <span>{selectedOrder.resultsEnteredBy?.fullName}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="approvalNotes">Approval Notes (Optional)</Label>
                <Textarea
                  id="approvalNotes"
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  placeholder="Any additional comments or observations..."
                  rows={3}
                />
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm">
                <p className="text-blue-900">
                  By approving, you confirm that the results have been reviewed and are ready for patient release.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsApproveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleApprove} disabled={approveMutation.isPending}>
              {approveMutation.isPending ? "Approving..." : "Approve Results"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
