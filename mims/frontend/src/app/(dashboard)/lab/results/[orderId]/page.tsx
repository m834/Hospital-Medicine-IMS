"use client";

import { use, useState } from "react";
import { useLabOrder, useEnterResult } from "@/hooks/use-lab-orders";
import { useAuthStore } from "@/stores/auth.store";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save, TestTube, User, Clock, Plus, Trash2 } from "lucide-react";
import { formatMRN } from '@/lib/mrn';

interface ResultField {
  parameter: string;
  value: string;
  unit: string;
  normalRange: string;
}

export default function ResultEntryPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params);
  const { user } = useAuthStore();
  const router = useRouter();
  const { data: order, isLoading } = useLabOrder(orderId);
  const enterResultMutation = useEnterResult();

  const [resultFields, setResultFields] = useState<ResultField[]>([
    { parameter: "", value: "", unit: "", normalRange: "" },
  ]);
  const [resultNotes, setResultNotes] = useState("");

  const addField = () => {
    setResultFields([...resultFields, { parameter: "", value: "", unit: "", normalRange: "" }]);
  };

  const removeField = (index: number) => {
    setResultFields(resultFields.filter((_, i) => i !== index));
  };

  const updateField = (index: number, field: keyof ResultField, value: string) => {
    const updated = [...resultFields];
    updated[index][field] = value;
    setResultFields(updated);
  };

  const handleSubmit = async () => {
    if (!user) return;

    // Filter out empty fields
    const validResults = resultFields.filter((f) => f.parameter && f.value);

    if (validResults.length === 0) {
      alert("Please enter at least one result parameter");
      return;
    }

    await enterResultMutation.mutateAsync({
      orderId: orderId,
      data: {
        resultsEnteredById: user.id,
        results: validResults,
        resultNotes,
      },
    });

    router.push("/lab/results");
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Order not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Enter Lab Results</h1>
          <p className="text-muted-foreground">Order: {order.orderNumber}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Patient & Order Info */}
        <Card>
          <CardHeader>
            <CardTitle>Patient Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Patient Name</Label>
              <p className="font-medium">{order.patient?.fullName}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">MRN</Label>
              <p className="font-mono text-sm">{formatMRN(order.patient?.nrNumber)}</p>
            </div>
            {order.patient?.gender && (
              <div>
                <Label className="text-xs text-muted-foreground">Gender</Label>
                <p>{order.patient.gender}</p>
              </div>
            )}
            {order.patient?.dob && (
              <div>
                <Label className="text-xs text-muted-foreground">Age</Label>
                <p>{Math.floor((Date.now() - new Date(order.patient.dob).getTime()) / 31536000000)} years</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Test Info */}
        <Card>
          <CardHeader>
            <CardTitle>Test Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Test Name</Label>
              <p className="font-medium">{order.labTest?.testName}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Test Code</Label>
              <p className="font-mono text-sm">{order.labTest?.testCode}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Category</Label>
              <Badge variant="outline">{order.labTest?.testCategory}</Badge>
            </div>
            {order.labTest?.normalRange && (
              <div>
                <Label className="text-xs text-muted-foreground">Normal Ranges</Label>
                <pre className="text-xs bg-muted p-2 rounded mt-1">
                  {JSON.stringify(order.labTest.normalRange, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sample Info */}
        <Card>
          <CardHeader>
            <CardTitle>Sample Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Sample Type</Label>
              <p>{order.sampleType || "N/A"}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Collected At</Label>
              <p className="text-sm">
                {order.sampleCollectedAt
                  ? new Date(order.sampleCollectedAt).toLocaleString()
                  : "N/A"}
              </p>
            </div>
            {order.sampleCollectedBy && (
              <div>
                <Label className="text-xs text-muted-foreground">Collected By</Label>
                <p className="text-sm">{order.sampleCollectedBy.fullName}</p>
              </div>
            )}
            {order.sampleNotes && (
              <div>
                <Label className="text-xs text-muted-foreground">Collection Notes</Label>
                <p className="text-sm text-muted-foreground">{order.sampleNotes}</p>
              </div>
            )}
            {order.clinicalNotes && (
              <div>
                <Label className="text-xs text-muted-foreground">Clinical Notes</Label>
                <p className="text-sm text-muted-foreground">{order.clinicalNotes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Results Entry Form */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Test Results</CardTitle>
              <CardDescription>Enter the test parameters and their values</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={addField}>
              <Plus className="mr-2 h-4 w-4" />
              Add Parameter
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {resultFields.map((field, index) => (
            <div key={index} className="grid grid-cols-12 gap-4 p-4 border rounded-lg">
              <div className="col-span-3">
                <Label htmlFor={`param-${index}`}>Parameter</Label>
                <Input
                  id={`param-${index}`}
                  value={field.parameter}
                  onChange={(e) => updateField(index, "parameter", e.target.value)}
                  placeholder="e.g., Hemoglobin"
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor={`value-${index}`}>Value</Label>
                <Input
                  id={`value-${index}`}
                  value={field.value}
                  onChange={(e) => updateField(index, "value", e.target.value)}
                  placeholder="e.g., 14.5"
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor={`unit-${index}`}>Unit</Label>
                <Input
                  id={`unit-${index}`}
                  value={field.unit}
                  onChange={(e) => updateField(index, "unit", e.target.value)}
                  placeholder="e.g., g/dL"
                />
              </div>
              <div className="col-span-4">
                <Label htmlFor={`range-${index}`}>Normal Range</Label>
                <Input
                  id={`range-${index}`}
                  value={field.normalRange}
                  onChange={(e) => updateField(index, "normalRange", e.target.value)}
                  placeholder="e.g., 13-17 g/dL"
                />
              </div>
              <div className="col-span-1 flex items-end">
                {resultFields.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeField(index)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
          ))}

          <div className="space-y-2 pt-4">
            <Label htmlFor="resultNotes">Result Notes (Optional)</Label>
            <Textarea
              id="resultNotes"
              value={resultNotes}
              onChange={(e) => setResultNotes(e.target.value)}
              placeholder="Any additional observations, comments, or interpretations..."
              rows={4}
            />
          </div>

          <div className="flex gap-4 pt-4">
            <Button variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={enterResultMutation.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {enterResultMutation.isPending ? "Submitting..." : "Submit Results"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
