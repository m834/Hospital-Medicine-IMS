"use client";

/**
 * Test List — every lab test ordered, with the slip reprintable from the row.
 *
 * This is a manager's screen. A slip drops into a slot on a pre-printed A4 lab
 * form, so a second print burns a form and can put two identical slips into
 * circulation; the server allows a reprint only for a manager or an admin
 * (SLIP_REPRINT_ROLES in lab-orders.service.ts). The tab is shown to exactly
 * those roles, so nobody is offered a button the server will refuse.
 */

import { useMemo, useState } from "react";
import { useLabOrders, type LabOrder } from "@/hooks/use-lab-orders";
import { useHospitalStore } from "@/stores/hospital.store";
import { useAuthStore } from "@/stores/auth.store";
import { UserRole } from "@/lib/constants";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Printer } from "lucide-react";
import { formatMRN, matchesMRN } from "@/lib/mrn";
import { printLabReceipt } from "@/lib/print-receipt";

/** Mirrors SLIP_REPRINT_ROLES on the server. */
const LIST_ROLES: UserRole[] = [
  UserRole.MASTER_ADMIN,
  UserRole.SUPER_ADMIN,
  UserRole.HOSPITAL_ADMIN,
  UserRole.REGISTRATION_STAFF_MANAGER,
];

const STATUS_TONES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  SAMPLE_COLLECTED: "bg-sky-100 text-sky-700",
  IN_PROGRESS: "bg-sky-100 text-sky-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-rose-100 text-rose-700",
};

/**
 * Local calendar date, not UTC: at the desk in Karachi an ISO/UTC "today"
 * still reads as yesterday until 5am.
 */
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
};

const formatDateTime = (value?: string) =>
  value
    ? new Date(value).toLocaleString("en-PK", {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";

const getErrorMessage = (error: any) =>
  error?.response?.data?.message || error?.message || "Failed to print the slip.";

export default function LabOrderListPage() {
  const { selectedHospital } = useHospitalStore();
  const { user } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState("");
  // Opens on today: a reprint is nearly always same-day, and an unfiltered
  // list would fetch every order the hospital has ever raised. Widen the dates
  // to hunt for an older slip.
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [printError, setPrintError] = useState("");

  const hospitalId = user?.hospitalId || selectedHospital?.id;
  const hasAccess = !!user && LIST_ROLES.includes(user.role as UserRole);

  const { data: orders, isLoading } = useLabOrders(hasAccess ? hospitalId || "" : "", {
    startDate,
    endDate,
  });

  const filteredOrders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return orders ?? [];

    return (orders ?? []).filter(
      (order) =>
        order.orderNumber.toLowerCase().includes(query) ||
        order.patient?.fullName.toLowerCase().includes(query) ||
        matchesMRN(order.patient?.nrNumber, searchQuery) ||
        order.labTest?.testName.toLowerCase().includes(query) ||
        order.labTest?.testCategory?.toLowerCase().includes(query),
    );
  }, [orders, searchQuery]);

  /**
   * Claim the print on the server first: it counts the slip and refuses one it
   * is not willing to reprint, so a refusal never reaches the printer.
   */
  const handlePrint = async (order: LabOrder) => {
    setPrintingId(order.id);
    setPrintError("");

    try {
      await api.post("/lab-orders/print-slip", { orderIds: [order.id] });
      printLabReceipt([order], {
        patientId: order.patient?.nrNumber,
        createdBy: user?.fullName || user?.email || "Staff",
      });
    } catch (error) {
      setPrintError(`${order.orderNumber}: ${getErrorMessage(error)}`);
    } finally {
      setPrintingId(null);
    }
  };

  if (!user) return null;

  if (!hasAccess) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              This list is available to registration managers and admins.
            </p>
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
            <p className="text-center text-muted-foreground">
              Please select a hospital from the dropdown to proceed
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Test List</h1>
        <p className="text-muted-foreground">
          Every lab test ordered, with its slip reprintable from the row. Showing
          today by default — widen the dates to find an older slip.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by patient, MRN, order, or test..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <DateInput value={startDate} onChange={setStartDate} placeholder="Start Date" />
            <DateInput value={endDate} onChange={setEndDate} placeholder="End Date" />
          </div>
        </CardContent>
      </Card>

      {printError && <p className="text-sm text-rose-600">{printError}</p>}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Lab Tests</CardTitle>
          <span className="text-sm text-muted-foreground">
            {filteredOrders.length.toLocaleString()} shown
          </span>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-8 text-center text-muted-foreground">Loading lab tests...</p>
          ) : filteredOrders.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No lab tests match this search.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order No.</TableHead>
                    <TableHead>MRN</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Test</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead className="text-right">Slips</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono text-xs">{order.orderNumber}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {formatMRN(order.patient?.nrNumber)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {order.patient?.fullName || "—"}
                      </TableCell>
                      <TableCell>{order.labTest?.testName || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {order.labTest?.testCategory || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={`border-transparent font-medium ${
                            STATUS_TONES[order.status] ?? "bg-muted text-muted-foreground"
                          }`}
                        >
                          {order.status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(order.createdAt)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {order.orderedBy?.fullName || "—"}
                      </TableCell>
                      {/* How many slips are already out there — a reprint adds
                          to this, so the count is the thing to check first. */}
                      <TableCell className="text-right">
                        {order.slipPrintCount > 0 ? (
                          <span title={`Last printed ${formatDateTime(order.slipLastPrintedAt)}`}>
                            {order.slipPrintCount}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={printingId === order.id}
                          onClick={() => handlePrint(order)}
                        >
                          <Printer className="mr-2 h-4 w-4" />
                          {printingId === order.id
                            ? "Printing..."
                            : order.slipPrintCount > 0
                              ? "Reprint"
                              : "Print"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
