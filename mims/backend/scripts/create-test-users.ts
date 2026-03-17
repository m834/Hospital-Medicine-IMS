import { PrismaClient, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const HOSPITAL_ID = 'eebe800c-33a4-41a1-b0c6-dd2300232775';
const PASSWORD = 'Asdf@112';

const ROLE_LIST: UserRole[] = [
  UserRole.HOSPITAL_ADMIN,
  UserRole.DEPARTMENT_ADMIN,
  UserRole.MAIN_PHARMACY_MANAGER,
  UserRole.SUB_PHARMACY_MANAGER,
  UserRole.DOCTOR,
  UserRole.DOCTOR_ASSISTANT,
  UserRole.REGISTRATION_STAFF,
  UserRole.PHARMACY_STAFF,
  UserRole.AUDITOR,
  UserRole.LAB_TECHNICIAN,
  UserRole.RADIOLOGIST,
  UserRole.NURSE,
  UserRole.BILLING_STAFF,
  UserRole.RECEPTIONIST,
];

const toLabel = (role: UserRole) =>
  role
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

async function main() {
  const passwordHash = await argon2.hash(PASSWORD);

  for (const role of ROLE_LIST) {
    const email = `test.${role.toLowerCase()}@example.com`;
    const fullName = `Test ${toLabel(role)}`;

    await prisma.user.upsert({
      where: { email },
      update: {
        fullName,
        role,
        hospitalId: HOSPITAL_ID,
        status: 'ACTIVE',
        passwordHash,
      },
      create: {
        email,
        passwordHash,
        fullName,
        role,
        hospitalId: HOSPITAL_ID,
        status: 'ACTIVE',
      },
    });
  }

  console.log(`Created/updated ${ROLE_LIST.length} users for hospital ${HOSPITAL_ID}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
