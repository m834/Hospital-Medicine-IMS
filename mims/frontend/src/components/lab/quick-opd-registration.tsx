import * as React from "react";
import { Loader2, Save, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import api, { getErrorMessage } from "@/lib/api";
import { createSingleFlight } from "@/lib/lab-slip-print";

/**
 * Roles the server lets register a patient (POST /patients) that can also open
 * Lab → New Order. Anyone else would only be refused, so the form is not shown.
 */
export const QUICK_REGISTRATION_ROLES: string[] = [
  "SUPER_ADMIN",
  "HOSPITAL_ADMIN",
  "REGISTRATION_STAFF",
  "REGISTRATION_STAFF_MANAGER",
  "RECEPTIONIST",
];

/** Same rule as the Patient Registration form. */
const MIN_NAME_LENGTH = 2;

/** The values POST /patients accepts, labelled as Patient Registration labels them. */
const GENDERS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
];

export interface RegisteredPatient {
  id: string;
  nrNumber: string;
  fullName: string;
  gender?: string;
  mobile?: string;
  cnic?: string;
}

/**
 * Register a walk-in OPD patient by name, with an optional gender, without
 * leaving the lab desk.
 *
 * Sends exactly what Patient Registration sends for an OPD patient with only a
 * name filled in, to the same endpoint — so the patient, their MRN and their
 * OPD visit are created the same way and show up in the patient list and the
 * registration report. Nothing prints.
 */
export function QuickOpdRegistration({
  user,
  selectedHospitalId,
  onRegistered,
  nameInputRef,
}: {
  user: { role: string } | null | undefined;
  selectedHospitalId?: string;
  onRegistered: (patient: RegisteredPatient) => void;
  /** Lets the page put the cursor in the name box. */
  nameInputRef?: React.Ref<HTMLInputElement>;
}) {
  const [fullName, setFullName] = React.useState("");
  const [gender, setGender] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  // Taken the instant Save is pressed, so a double press or a held Enter
  // registers one patient, not two.
  const [lock] = React.useState(createSingleFlight);

  const name = fullName.trim();
  const canSave = name.length >= MIN_NAME_LENGTH && !busy;

  const save = () =>
    lock.run(async () => {
      if (name.length < MIN_NAME_LENGTH) return;
      setBusy(true);
      setError("");
      try {
        // A super admin works across hospitals and names one; everyone else is
        // pinned to their own hospital by the server.
        const params =
          user?.role === "SUPER_ADMIN" && selectedHospitalId
            ? { hospitalId: selectedHospitalId }
            : {};
        const response = await api.post(
          "/patients",
          { fullName: name, visitType: "OPD", ...(gender ? { gender } : {}) },
          { params },
        );
        setFullName("");
        setGender("");
        onRegistered(response.data as RegisteredPatient);
      } catch (err) {
        setError(getErrorMessage(err) || "Could not register the patient. Please try again.");
      } finally {
        setBusy(false);
      }
    });

  const saveOnEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void save();
    }
  };

  if (!user || !QUICK_REGISTRATION_ROLES.includes(user.role)) return null;

  return (
    <div className="space-y-2 rounded-lg border border-dashed p-3">
      <p className="flex items-center gap-2 text-sm font-medium">
        <UserPlus className="h-4 w-4" />
        New patient? Register by name (OPD)
      </p>
      <div className="flex gap-2">
        <Input
          ref={nameInputRef}
          aria-label="New patient full name"
          placeholder="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          onKeyDown={saveOnEnter}
          disabled={busy}
          maxLength={100}
        />
        {/* Optional: a plain select, so the desk can Tab in and type M or F. */}
        <select
          aria-label="New patient gender"
          value={gender}
          onChange={(e) => setGender(e.target.value)}
          onKeyDown={saveOnEnter}
          disabled={busy}
          className="h-10 w-36 shrink-0 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">Gender (optional)</option>
          {GENDERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Button type="button" onClick={() => void save()} disabled={!canSave}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span className="ml-2">{busy ? "Saving..." : "Save"}</span>
        </Button>
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
