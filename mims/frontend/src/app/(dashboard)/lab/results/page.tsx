"use client";

import { useState } from "react";
import { useLabOrders, useEnterResult } from "@/hooks/use-lab-orders";
import { useHospitalStore } from "@/stores/hospital.store";
import { useAuthStore } from "@/stores/auth.store";
import { UserRole } from "@/lib/constants";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Search, FileText, Clock, TestTube } from "lucide-react";
import { matchesMRN } from '@/lib/mrn';

export default function LabResultsPage() {
  const { selectedHospital } = useHospitalStore();
  const { user } = useAuthStore();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  // Get hospital ID - Master/Super Admin use dropdown, others use user.hospitalId
  const hospitalId = selectedHospital?.id || user?.hospitalId;
  const isMasterOrSuper = user?.role === UserRole.MASTER_ADMIN || user?.role === UserRole.SUPER_ADMIN;

  const { data: orders, isLoading } = useLabOrders(hospitalId || "", {
    status: "SAMPLE_COLLECTED",
  });

  const filteredOrders = orders?.filter((order) =>
    order.orderNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.patient?.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    matchesMRN(order.patient?.nrNumber, searchQuery)
  ) || [];

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
        <h1 className="text-3xl font-bold">Lab Results Entry</h1>
        <p className="text-muted-foreground">Enter test results for collected samples</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by order number, patient name, or NR number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOrders?.map((order) => (
            <Card key={order.id} className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => router.push(`/lab/results/${order.id}`)}>
              <CardHeader>
                <CardTitle className="text-base">{order.patient?.fullName}</CardTitle>
                <CardDescription className="font-mono text-xs">
                  {order.orderNumber}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <TestTube className="h-4 w-4 text-muted-foreground" />
                  <span>{order.labTest?.testName}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs">
                    Collected: {order.sampleCollectedAt ? new Date(order.sampleCollectedAt).toLocaleString() : "N/A"}
                  </span>
                </div>
                {order.sampleType && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Sample: </span>
                    <Badge variant="outline">{order.sampleType}</Badge>
                  </div>
                )}
                <Button className="w-full mt-4" onClick={() => router.push(`/lab/results/${order.id}`)}>
                  <FileText className="mr-2 h-4 w-4" />
                  Enter Results
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
