"use client";

import { Fragment, useMemo, useState } from "react";
import { useLabOrders, downloadLabResultPdf } from "@/hooks/use-lab-orders";
import { useHospitalStore } from "@/stores/hospital.store";
import { useAuthStore } from "@/stores/auth.store";
import { UserRole } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Search, Download, FileText, Calendar, User, TestTube, Printer } from "lucide-react";
import { formatMRN, matchesMRN } from '@/lib/mrn';
import { useLabRevenue } from "@/hooks/use-lab-revenue";
import { printLabRevenueReport } from "@/lib/print-lab-revenue";

/** Two decimals, grouped — the same figures the printed report carries. */
const formatMoney = (value: number) =>
  new Intl.NumberFormat('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);

const prettyDate = (value: string) =>
  new Date(value).toLocaleDateString('en-PK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

export default function LabReportsPage() {
  const { selectedHospital } = useHospitalStore();
  const { user, token } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Get hospital ID - Master/Super Admin use dropdown, others use user.hospitalId
  const hospitalId = selectedHospital?.id || user?.hospitalId;
  const isMasterOrSuper = user?.role === UserRole.MASTER_ADMIN || user?.role === UserRole.SUPER_ADMIN;

  // Registration staff get their own orders only — the server scopes the list
  // off the token, so this only says out loud what they are already seeing.
  const isOwnOrdersOnly = user?.role === UserRole.REGISTRATION_STAFF;

  const { data: approvedOrders, isLoading } = useLabOrders(hospitalId || "", {
    status: "APPROVED",
    startDate,
    endDate,
  });

  // Revenue counts every order in the range, not just the approved ones: the
  // charge is raised when the slip is created, so filtering by status here
  // would under-report the money that was actually taken.
  const { data: revenue, isLoading: revenueLoading } = useLabRevenue({
    hospitalId,
    startDate,
    endDate,
  });

  const revenuePeriodLabel = useMemo(() => {
    if (!startDate || !endDate) return 'All dates';
    return startDate === endDate
      ? prettyDate(startDate)
      : `${prettyDate(startDate)} – ${prettyDate(endDate)}`;
  }, [startDate, endDate]);

  const filteredOrders = approvedOrders?.filter((order) =>
    order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.patient?.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    matchesMRN(order.patient?.nrNumber, searchQuery) ||
    order.labTest?.testName.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        <h1 className="text-3xl font-bold">Lab Reports</h1>
        <p className="text-muted-foreground">
          {isOwnOrdersOnly
            ? "View and download approved reports for the lab tests you ordered"
            : "View and download approved lab test reports"}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Reports</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvedOrders?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Today's Reports</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {approvedOrders?.filter((o) => {
                const today = new Date().toDateString();
                return new Date(o.resultsApprovedAt || "").toDateString() === today;
              }).length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Unique Patients</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(approvedOrders?.map((o) => o.patientId)).size || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by patient, order, or test..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <DateInput
                value={startDate}
                onChange={setStartDate}
                placeholder="Start Date"
              />
            </div>
            <div>
              <DateInput
                value={endDate}
                onChange={setEndDate}
                placeholder="End Date"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lab Revenue: every order in the range, grouped by category. The print
          button sends a document of its own — see print-lab-revenue.ts. */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>Lab Revenue</CardTitle>
            <CardDescription>
              {revenuePeriodLabel}
              {isOwnOrdersOnly ? ' · your own orders' : ''}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={!revenue || revenueLoading}
            onClick={() =>
              revenue && printLabRevenueReport(revenue, selectedHospital?.name)
            }
          >
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
        </CardHeader>
        <CardContent>
          {revenueLoading ? (
            <p className="py-6 text-center text-muted-foreground">Loading lab revenue...</p>
          ) : !revenue || revenue.categories.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">
              No lab tests were created in this period.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase text-muted-foreground">
                    <th className="py-2 text-left font-medium">Test Name</th>
                    <th className="py-2 text-right font-medium">Quantity</th>
                    <th className="py-2 text-right font-medium">Test Price</th>
                    <th className="py-2 text-right font-medium">Total Price</th>
                  </tr>
                </thead>
                <tbody>
                  {revenue.categories.map((category) => (
                    <Fragment key={category.category}>
                      <tr>
                        <td
                          colSpan={4}
                          className="pt-4 text-xs font-semibold uppercase tracking-wide text-foreground"
                        >
                          {category.category}
                        </td>
                      </tr>
                      {category.tests.map((test) => (
                        <tr key={`${category.category}-${test.testName}-${test.unitPrice}`}>
                          <td className="py-1.5 pl-4">{test.testName}</td>
                          <td className="py-1.5 text-right">{test.quantity}</td>
                          <td className="py-1.5 text-right">{formatMoney(test.unitPrice)}</td>
                          <td className="py-1.5 text-right">{formatMoney(test.total)}</td>
                        </tr>
                      ))}
                      <tr className="border-y font-semibold">
                        <td className="py-1.5">{category.category} subtotal</td>
                        <td className="py-1.5 text-right">{category.quantity}</td>
                        <td />
                        <td className="py-1.5 text-right">{formatMoney(category.subtotal)}</td>
                      </tr>
                    </Fragment>
                  ))}
                  <tr className="border-t-2 border-double text-base font-bold">
                    <td className="py-2">GRAND TOTAL</td>
                    <td className="py-2 text-right">{revenue.totalQuantity}</td>
                    <td />
                    <td className="py-2 text-right">{formatMoney(revenue.grandTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tests by Resource</CardTitle>
          <CardDescription>Tests created by each resource in this period.</CardDescription>
        </CardHeader>
        <CardContent>
          {!revenue || revenue.resources.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">
              No tests were created in this period.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase text-muted-foreground">
                    <th className="py-2 text-left font-medium">Resource</th>
                    <th className="py-2 text-right font-medium">Tests Created</th>
                  </tr>
                </thead>
                <tbody>
                  {revenue.resources.map((resource) => (
                    <tr key={resource.resourceId}>
                      <td className="py-1.5">{resource.resourceName}</td>
                      <td className="py-1.5 text-right">{resource.tests}</td>
                    </tr>
                  ))}
                  <tr className="border-t font-semibold">
                    <td className="py-1.5">Total</td>
                    <td className="py-1.5 text-right">{revenue.totalQuantity}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reports List */}
      {isLoading ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Loading reports...</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredOrders?.map((order) => (
            <Card key={order.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Order Number</Label>
                      <p className="font-mono text-sm font-medium">{order.orderNumber}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Patient</Label>
                      <p className="font-medium">{order.patient?.fullName}</p>
                      <p className="text-xs text-muted-foreground font-mono">{formatMRN(order.patient?.nrNumber)}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Test</Label>
                      <p className="text-sm">{order.labTest?.testName}</p>
                      <Badge variant="outline" className="text-xs mt-1">{order.labTest?.testCategory}</Badge>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Approved By</Label>
                      <p className="text-sm">{order.resultsApprovedBy?.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {order.resultsApprovedAt
                          ? new Date(order.resultsApprovedAt).toLocaleDateString()
                          : "N/A"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Priority</Label>
                      <Badge
                        variant={
                          order.priority === "STAT"
                            ? "destructive"
                            : order.priority === "URGENT"
                            ? "default"
                            : "secondary"
                        }
                        className="mt-1"
                      >
                        {order.priority}
                      </Badge>
                    </div>
                  </div>
                  <div className="ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadLabResultPdf(order.id, token || "")}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download PDF
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {filteredOrders?.length === 0 && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-semibold">No reports found</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Try adjusting your search criteria or date range
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
