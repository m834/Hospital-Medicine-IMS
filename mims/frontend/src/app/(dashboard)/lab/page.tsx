"use client";

import { useEffect, useMemo, useState } from "react";
import { useHospitalStore } from "@/stores/hospital.store";
import { useAuthStore } from "@/stores/auth.store";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PackagePlus, Microscope, FileText, CheckSquare, FileCheck } from "lucide-react";
import { UserRole } from "@/lib/constants";
import dynamic from "next/dynamic";

// Dynamically import components to avoid SSR issues
const LabOrderNewPage = dynamic(() => import("./orders/new/page"), { ssr: false });
const LabQueuePage = dynamic(() => import("./queue/page"), { ssr: false });
const LabResultsPage = dynamic(() => import("./results/page"), { ssr: false });
const LabApprovalPage = dynamic(() => import("./approve/page"), { ssr: false });
const LabReportsPage = dynamic(() => import("./reports/page"), { ssr: false });

export default function LabPage() {
  const { selectedHospital } = useHospitalStore();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState("new-order");

  // Get hospital ID - Master/Super Admin use dropdown, others use their user.hospitalId
  const currentHospitalId = selectedHospital?.id || user?.hospitalId;

  // Check if user should see hospital selection warning
  const isMasterOrSuper = user?.role === UserRole.MASTER_ADMIN || user?.role === UserRole.SUPER_ADMIN;
  const shouldWarnNoHospital = isMasterOrSuper && !currentHospitalId;

  const tabItems = useMemo(
    () => [
      {
        value: "new-order",
        label: "New Order",
        icon: PackagePlus,
        roles: [
          UserRole.MASTER_ADMIN,
          UserRole.SUPER_ADMIN,
          UserRole.HOSPITAL_ADMIN,
          UserRole.DEPARTMENT_ADMIN,
          UserRole.RECEPTIONIST,
          UserRole.REGISTRATION_STAFF,
          UserRole.LAB_TECHNICIAN,
        ],
      },
      {
        value: "queue",
        label: "Queue",
        icon: Microscope,
        roles: [
          UserRole.MASTER_ADMIN,
          UserRole.SUPER_ADMIN,
          UserRole.HOSPITAL_ADMIN,
          UserRole.DEPARTMENT_ADMIN,
          UserRole.LAB_TECHNICIAN,
        ],
      },
      {
        value: "results",
        label: "Results",
        icon: FileText,
        roles: [
          UserRole.MASTER_ADMIN,
          UserRole.SUPER_ADMIN,
          UserRole.HOSPITAL_ADMIN,
          UserRole.DEPARTMENT_ADMIN,
          UserRole.LAB_TECHNICIAN,
        ],
      },
      {
        value: "approval",
        label: "Approval",
        icon: CheckSquare,
        roles: [
          UserRole.MASTER_ADMIN,
          UserRole.SUPER_ADMIN,
          UserRole.HOSPITAL_ADMIN,
          UserRole.DEPARTMENT_ADMIN,
          UserRole.LAB_TECHNICIAN,
        ],
      },
      {
        value: "reports",
        label: "Reports",
        icon: FileCheck,
        roles: [
          UserRole.MASTER_ADMIN,
          UserRole.SUPER_ADMIN,
          UserRole.HOSPITAL_ADMIN,
          UserRole.DEPARTMENT_ADMIN,
          UserRole.DOCTOR,
          UserRole.RECEPTIONIST,
          UserRole.REGISTRATION_STAFF,
          UserRole.LAB_TECHNICIAN,
        ],
      },
    ],
    [],
  );

  const userRole = user?.role as UserRole | undefined;
  const visibleTabs = useMemo(
    () => tabItems.filter((tab) => !userRole || tab.roles.includes(userRole)),
    [tabItems, userRole],
  );

  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.some((tab) => tab.value === activeTab)) {
      setActiveTab(visibleTabs[0].value);
    }
  }, [activeTab, visibleTabs]);

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

  if (!currentHospitalId) {
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
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Lab Services</h1>
        <p className="text-muted-foreground">Manage lab tests, orders, results, and approvals</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex w-full flex-wrap gap-2">
          {visibleTabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="flex items-center gap-2">
              <tab.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="new-order">
          <LabOrderNewPage />
        </TabsContent>

        <TabsContent value="queue">
          <LabQueuePage />
        </TabsContent>

        <TabsContent value="results">
          <LabResultsPage />
        </TabsContent>

        <TabsContent value="approval">
          <LabApprovalPage />
        </TabsContent>

        <TabsContent value="reports">
          <LabReportsPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
