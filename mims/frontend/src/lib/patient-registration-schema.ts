import * as z from 'zod';

/** The patient registration form: what it accepts and what it requires. */
export const patientSchema = z.object({
  // Full Name is the only mandatory field. The ID is optional, but when given it
  // acts as the identity key: a matching ID records a new visit against the
  // existing MRN instead of creating a second one.
  fullName: z.string().min(2, 'Full name is required'),
  // CNIC = Pakistani national ID (fixed format); OTHER = passport / foreign ID,
  // which has no single format and is accepted as entered.
  idType: z.enum(['CNIC', 'OTHER']),
  cnic: z.string().optional(),
  age: z
    .string()
    .optional()
    .refine((v) => !v || (/^\d{1,3}$/.test(v) && Number(v) <= 150), {
      message: 'Enter a valid age',
    }),
  mobile: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  isGuardian: z.boolean().optional(),
  guardianType: z.enum(['WIFE', 'CHILD']).optional(),
  visitType: z.enum(['OPD', 'EMERGENCY', 'WARD_INDOOR']).optional(),
  department: z.string().optional(),
  clinicId: z.string().optional(),
  roomType: z.string().optional(),
  roomId: z.string().optional(),
  bedId: z.string().optional(),
  ward: z.string().optional(),
  bed: z.string().optional(),
  attendingDoctorId: z.string().optional(),
}).superRefine((data, ctx) => {
  // A Ward/Indoor registration admits the patient to a bed, so it needs every
  // field the admission needs. The server refuses it without them too; this
  // just says so before the form is sent.
  if (data.visitType === 'WARD_INDOOR') {
    const required: Array<[keyof typeof data, string]> = [
      ['department', 'Select a department for the admission'],
      ['attendingDoctorId', 'Select the attending doctor'],
      ['roomId', 'Select a room'],
      ['bedId', 'Select a bed'],
    ];
    for (const [field, message] of required) {
      if (!String(data[field] ?? '').trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message });
      }
    }
  }

  // Format is only meaningful for a CNIC. Passports and foreign IDs vary by
  // country, so they are checked for a sane minimum length and nothing more.
  const value = (data.cnic ?? '').trim();
  if (!value) return; // the ID is optional — nothing to check when left blank

  if (data.idType === 'CNIC') {
    if (!/^\d{5}-\d{7}-\d$/.test(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cnic'],
        message: 'Enter a valid CNIC (XXXXX-XXXXXXX-X)',
      });
    }
  } else if (value.length < 4) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['cnic'],
      message: 'Enter a valid ID number (at least 4 characters)',
    });
  }
});

export type PatientFormData = z.infer<typeof patientSchema>;
