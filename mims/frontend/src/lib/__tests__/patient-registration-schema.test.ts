import { patientSchema } from '../patient-registration-schema';

const indoor = {
  fullName: 'Ali Khan',
  idType: 'CNIC' as const,
  visitType: 'WARD_INDOOR' as const,
  department: 'dept-1',
  attendingDoctorId: 'doctor-1',
  roomId: 'room-1',
  bedId: 'bed-1',
};

/** The fields the form flags, in the order it flags them. */
const flagged = (data: object) => {
  const result = patientSchema.safeParse(data);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
};

describe('patient registration form', () => {
  it('accepts a complete Ward/Indoor registration', () => {
    expect(flagged(indoor)).toEqual([]);
  });

  it.each([
    ['department', { department: '' }],
    ['attendingDoctorId', { attendingDoctorId: undefined }],
    ['roomId', { roomId: '' }],
    ['bedId', { bedId: '' }],
  ])('refuses a Ward/Indoor registration without %s', (field, override) => {
    expect(flagged({ ...indoor, ...override })).toEqual([field]);
  });

  it('flags every missing admission field at once', () => {
    expect(
      flagged({ fullName: 'Ali Khan', idType: 'CNIC', visitType: 'WARD_INDOOR' }),
    ).toEqual(['department', 'attendingDoctorId', 'roomId', 'bedId']);
  });

  it('still needs only a name for OPD and Emergency', () => {
    expect(flagged({ fullName: 'Ali Khan', idType: 'CNIC', visitType: 'OPD' })).toEqual([]);
    expect(flagged({ fullName: 'Ali Khan', idType: 'CNIC', visitType: 'EMERGENCY' })).toEqual([]);
  });

  it('still checks the CNIC format when one is entered', () => {
    expect(flagged({ ...indoor, cnic: '123' })).toEqual(['cnic']);
  });
});
