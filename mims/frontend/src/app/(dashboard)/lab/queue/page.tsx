"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePendingLabOrders, useCollectSample } from "@/hooks/use-lab-orders";
import { useHospitalStore } from "@/stores/hospital.store";
import { useAuthStore } from "@/stores/auth.store";
import { UserRole } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TestTube, Clock, User, AlertCircle, CheckCircle2, Syringe, DollarSign } from "lucide-react";
import type { LabOrder } from "@/hooks/use-lab-orders";

export default function LabQueuePage() {
  const { selectedHospital } = useHospitalStore();
  const { user } = useAuthStore();
  const [selectedOrder, setSelectedOrder] = useState<LabOrder | null>(null);
  const [isCollectDialogOpen, setIsCollectDialogOpen] = useState(false);
  const [collectData, setCollectData] = useState({
    sampleType: "",
    sampleNotes: "",
  });

  // Get hospital ID - Master/Super Admin use dropdown, others use user.hospitalId
  const hospitalId = selectedHospital?.id || user?.hospitalId;
  const isMasterOrSuper = user?.role === UserRole.MASTER_ADMIN || user?.role === UserRole.SUPER_ADMIN;

  const { data: pendingOrders, isLoading } = usePendingLabOrders(hospitalId || "");
  const collectMutation = useCollectSample();

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, { variant: "default" | "destructive" | "secondary"; label: string }> = {
      STAT: { variant: "destructive", label: "STAT" },
      URGENT: { variant: "default", label: "URGENT" },
      ROUTINE: { variant: "secondary", label: "ROUTINE" },
    };
    const config = variants[priority] || variants.ROUTINE;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const handleCollectSample = async () => {
    if (!selectedOrder || !user) return;

    await collectMutation.mutateAsync({
      orderId: selectedOrder.id,
      data: {
        sampleCollectedById: user.id,
        sampleType: collectData.sampleType,
        sampleNotes: collectData.sampleNotes,
      },
    });

    setIsCollectDialogOpen(false);
    setSelectedOrder(null);
    setCollectData({ sampleType: "", sampleNotes: "" });
  };

  const openCollectDialog = (order: LabOrder) => {
    setSelectedOrder(order);
    setCollectData({
      sampleType: order.labTest?.testCategory || "",
      sampleNotes: "",
    });
    setIsCollectDialogOpen(true);
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

  const statOrders = pendingOrders?.filter((o) => o.priority === "STAT") || [];
  const urgentOrders = pendingOrders?.filter((o) => o.priority === "URGENT") || [];
  const routineOrders = pendingOrders?.filter((o) => o.priority === "ROUTINE") || [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Lab Sample Collection Queue</h1>
        <p className="text-muted-foreground">Pending lab orders awaiting sample collection</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingOrders?.length || 0}</div>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-red-700">STAT Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">{statOrders.length}</div>
            <p className="text-xs text-red-600 mt-1">Immediate attention required</p>
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-orange-700">Urgent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700">{urgentOrders.length}</div>
            <p className="text-xs text-orange-600 mt-1">Priority collection</p>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-blue-700">Routine Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">{routineOrders.length}</div>
            <p className="text-xs text-blue-600 mt-1">Standard collection</p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Loading queue...</p>
          </CardContent>
        </Card>
      ) : pendingOrders && pendingOrders.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <p className="text-lg font-semibold">All samples collected!</p>
              <p className="text-sm text-muted-foreground mt-2">No pending orders in the queue</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* STAT Orders */}
          {statOrders.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-red-700 mb-4 flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                STAT Orders - Immediate Attention
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {statOrders.map((order) => (
                  <OrderCard key={order.id} order={order} onCollect={openCollectDialog} />
                ))}
              </div>
            </div>
          )}

          {/* Urgent Orders */}
          {urgentOrders.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-orange-700 mb-4">Urgent Orders</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {urgentOrders.map((order) => (
                  <OrderCard key={order.id} order={order} onCollect={openCollectDialog} />
                ))}
              </div>
            </div>
          )}

          {/* Routine Orders */}
          {routineOrders.length > 0 && (
            <div>
              <h2 className="text-xl font-bold mb-4">Routine Orders</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {routineOrders.map((order) => (
                  <OrderCard key={order.id} order={order} onCollect={openCollectDialog} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Collect Sample Dialog */}
      <Dialog open={isCollectDialogOpen} onOpenChange={setIsCollectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Collect Sample</DialogTitle>
            <DialogDescription>
              Record sample collection for {selectedOrder?.patient?.fullName}
            </DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Order Number:</span>
                  <span className="text-sm font-mono">{selectedOrder.orderNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Test:</span>
                  <span className="text-sm">{selectedOrder.labTest?.testName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Patient:</span>
                  <span className="text-sm">{selectedOrder.patient?.fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">MRN:</span>
                  <span className="text-sm font-mono">{selectedOrder.patient?.nrNumber}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sampleType">Sample Type *</Label>
                <Input
                  id="sampleType"
                  value={collectData.sampleType}
                  onChange={(e) => setCollectData({ ...collectData, sampleType: e.target.value })}
                  placeholder="e.g., Blood, Urine, Serum"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sampleNotes">Notes</Label>
                <Textarea
                  id="sampleNotes"
                  value={collectData.sampleNotes}
                  onChange={(e) => setCollectData({ ...collectData, sampleNotes: e.target.value })}
                  placeholder="Any observations or special notes..."
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCollectDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCollectSample} disabled={collectMutation.isPending || !collectData.sampleType}>
              {collectMutation.isPending ? "Collecting..." : "Confirm Collection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrderCard({ order, onCollect }: { order: LabOrder; onCollect: (order: LabOrder) => void }) {
  const timeSinceOrder = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000); // minutes
  const router = useRouter();

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {order.priority === "STAT" && <AlertCircle className="h-4 w-4 text-red-600" />}
              <Badge variant={order.priority === "STAT" ? "destructive" : order.priority === "URGENT" ? "default" : "secondary"}>
                {order.priority}
              </Badge>
            </div>
            <CardTitle className="text-base">{order.patient?.fullName}</CardTitle>
            <CardDescription className="font-mono text-xs mt-1">
              {order.patient?.nrNumber}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <TestTube className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{order.labTest?.testName}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Order:</span>
            <span className="font-mono text-xs">{order.orderNumber}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">By:</span>
            <span className="text-xs">{order.orderedBy?.fullName}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Ordered:</span>
            <span className="text-xs">
              {timeSinceOrder < 60 ? `${timeSinceOrder}m ago` : `${Math.floor(timeSinceOrder / 60)}h ago`}
            </span>
          </div>
        </div>

        {order.clinicalNotes && (
          <div className="p-2 bg-muted rounded text-xs">
            <p className="font-medium mb-1">Clinical Notes:</p>
            <p className="text-muted-foreground">{order.clinicalNotes}</p>
          </div>
        )}

        {order.labTest?.requirements && (
          <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs">
            <p className="font-medium text-blue-900 mb-1">Sample Requirements:</p>
            <p className="text-blue-700">{order.labTest.requirements}</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-2">
          <Button className="w-full" onClick={() => onCollect(order)}>
            <Syringe className="mr-2 h-4 w-4" />
            Collect Sample
          </Button>
          {order.patient?.id && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push(`/dashboard/payments/patient/${order.patient?.id}`)}
            >
              <DollarSign className="mr-2 h-4 w-4" />
              Pay
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
