import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { seedShifts } from './seeds/seed-shifts';
import { seedLeaveTypes } from './seeds/seed-leave-types';
import { seedHolidays } from './seeds/seed-holidays';
import { seedAttendanceConfig } from './seeds/seed-attendance-config';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...\n');

  // ============================================
  // 1. CREATE DEFAULT SUPER ADMIN
  // ============================================
  console.log('Creating Super Admin...');
  
  const superAdminEmail = 'admin@mims.com';
  const superAdminPassword = 'Admin@12345';
  
  const existingSuperAdmin = await prisma.user.findUnique({
    where: { email: superAdminEmail },
  });

  if (!existingSuperAdmin) {
    const hashedPassword = await argon2.hash(superAdminPassword);
    
    const superAdmin = await prisma.user.create({
      data: {
        email: superAdminEmail,
        passwordHash: hashedPassword,
        fullName: 'Super Administrator',
        phone: '+92-300-1234567',
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        hospitalId: null, // SUPER_ADMIN is not tied to any hospital
        pharmacyId: null,
      },
    });

    console.log('✅ Super Admin created:');
    console.log(`   Email: ${superAdminEmail}`);
    console.log(`   Password: ${superAdminPassword}`);
    console.log(`   Role: SUPER_ADMIN`);
    console.log(`   ID: ${superAdmin.id}\n`);
  } else {
    console.log('⚠️  Super Admin already exists. Skipping...\n');
  }

  // ============================================
  // 2. CREATE SAMPLE HOSPITALS
  // ============================================
  console.log('Creating sample hospitals...');

  const hospitals = [
    {
      name: 'City General Hospital',
      code: 'CGH001',
      address: '123 Main Street, Karachi, Pakistan',
      phone: '+92-21-1111111',
      email: 'info@cgh.com',
      status: 'ACTIVE' as const,
    },
    {
      name: 'District Medical Center',
      code: 'DMC002',
      address: '456 Hospital Road, Lahore, Pakistan',
      phone: '+92-42-2222222',
      email: 'contact@dmc.com',
      status: 'ACTIVE' as const,
    },
  ];

  const createdHospitals = [];
  for (const hospitalData of hospitals) {
    const existingHospital = await prisma.hospital.findUnique({
      where: { code: hospitalData.code },
    });

    if (!existingHospital) {
      const hospital = await prisma.hospital.create({
        data: hospitalData,
      });
      createdHospitals.push(hospital);
      console.log(`✅ Created hospital: ${hospital.name} (${hospital.code})`);
    } else {
      createdHospitals.push(existingHospital);
      console.log(`⚠️  Hospital ${hospitalData.name} already exists. Skipping...`);
    }
  }

  console.log('');

  // ============================================
  // 3. CREATE PHARMACIES FOR EACH HOSPITAL
  // ============================================
  console.log('Creating pharmacies...');

  for (const hospital of createdHospitals) {
    // Main Pharmacy
    const mainPharmacyCode = `${hospital.code}-MAIN`;
    const existingMainPharmacy = await prisma.pharmacy.findFirst({
      where: {
        code: mainPharmacyCode,
        hospitalId: hospital.id,
      },
    });

    if (!existingMainPharmacy) {
      const mainPharmacy = await prisma.pharmacy.create({
        data: {
          hospitalId: hospital.id,
          name: 'Main Pharmacy',
          code: mainPharmacyCode,
          type: 'MAIN',
          locationWard: 'Ground Floor',
          status: 'ACTIVE',
        },
      });
      console.log(`✅ Created main pharmacy for ${hospital.name}`);
    } else {
      console.log(`⚠️  Main pharmacy for ${hospital.name} already exists. Skipping...`);
    }

    // Sub Pharmacies
    const subPharmacies = [
      { name: 'Emergency Pharmacy', ward: 'Emergency Wing', code: `${hospital.code}-EMRG` },
      { name: 'Ward Pharmacy', ward: 'Ward Block A', code: `${hospital.code}-WARD` },
    ];

    for (const subPharmacyData of subPharmacies) {
      const existingSubPharmacy = await prisma.pharmacy.findFirst({
        where: {
          code: subPharmacyData.code,
          hospitalId: hospital.id,
        },
      });

      if (!existingSubPharmacy) {
        await prisma.pharmacy.create({
          data: {
            hospitalId: hospital.id,
            name: subPharmacyData.name,
            code: subPharmacyData.code,
            type: 'SUB',
            locationWard: subPharmacyData.ward,
            status: 'ACTIVE',
          },
        });
        console.log(`✅ Created ${subPharmacyData.name} for ${hospital.name}`);
      } else {
        console.log(`⚠️  ${subPharmacyData.name} for ${hospital.name} already exists. Skipping...`);
      }
    }
  }

  console.log('');

  // ============================================
  // 4. CREATE SAMPLE HOSPITAL ADMINS
  // ============================================
  console.log('Creating Hospital Admins...');

  for (const hospital of createdHospitals) {
    const adminEmail = `admin@${hospital.code.toLowerCase()}.com`;
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (!existingAdmin) {
      const hashedPassword = await argon2.hash('Admin@12345');
      
      await prisma.user.create({
        data: {
          email: adminEmail,
          passwordHash: hashedPassword,
          fullName: `${hospital.name} Administrator`,
          phone: hospital.phone,
          role: 'HOSPITAL_ADMIN',
          status: 'ACTIVE',
          hospitalId: hospital.id,
          pharmacyId: null,
        },
      });
      console.log(`✅ Created Hospital Admin for ${hospital.name}`);
      console.log(`   Email: ${adminEmail}`);
      console.log(`   Password: Admin@12345`);
    } else {
      console.log(`⚠️  Hospital Admin for ${hospital.name} already exists. Skipping...`);
    }
  }

  console.log('');

  // ============================================
  // 5. CREATE POPULAR MEDICINES
  // ============================================
  console.log('Seeding popular medicines for each hospital...');

  const popularMedicines = [
    { name: 'Paracetamol', genericName: 'Paracetamol', strength: '500mg', form: 'TABLET' },
    { name: 'Ibuprofen', genericName: 'Ibuprofen', strength: '200mg', form: 'TABLET' },
    { name: 'Amoxicillin', genericName: 'Amoxicillin', strength: '500mg', form: 'CAPSULE' },
    { name: 'Metformin', genericName: 'Metformin', strength: '500mg', form: 'TABLET' },
    { name: 'Omeprazole', genericName: 'Omeprazole', strength: '20mg', form: 'CAPSULE' },
    { name: 'Ciprofloxacin', genericName: 'Ciprofloxacin', strength: '500mg', form: 'TABLET' },
    { name: 'Salbutamol Syrup', genericName: 'Salbutamol', strength: '2mg/5ml', form: 'SYRUP' },
    { name: 'Amoxicillin-Clavulanate', genericName: 'Amoxicillin/Clavulanate', strength: '625mg', form: 'TABLET' },
  ];

  for (const hospital of createdHospitals) {
    for (const med of popularMedicines) {
      const exists = await prisma.medicine.findFirst({
        where: { name: med.name, hospitalId: hospital.id },
      });

      if (!exists) {
        await prisma.medicine.create({
          data: {
            hospitalId: hospital.id,
            name: med.name,
            genericName: med.genericName,
            strength: med.strength,
            form: med.form as any,
            manufacturer: 'Generic Manufacturer',
            status: 'ACTIVE',
          },
        });
        console.log(`✅ Seeded medicine ${med.name} for ${hospital.name}`);
      } else {
        console.log(`⚠️  Medicine ${med.name} already exists for ${hospital.name}. Skipping...`);
      }
    }
  }


  console.log('\n✅ Database seeding completed successfully!\n');
  console.log('='.repeat(60));
  console.log('DEFAULT CREDENTIALS:');
  console.log('='.repeat(60));
  console.log('\n🔐 SUPER ADMIN:');
  console.log('   Email: admin@mims.com');
  console.log('   Password: Admin@12345');
  console.log('   Access: All hospitals\n');
  
  for (const hospital of createdHospitals) {
    console.log(`🏥 HOSPITAL ADMIN - ${hospital.name}:`);
    console.log(`   Email: admin@${hospital.code.toLowerCase()}.com`);
    console.log(`   Password: Admin@12345`);
    console.log(`   Hospital: ${hospital.name} (${hospital.code})\n`);
  }
  console.log('='.repeat(60));

  // ============================================
  // ATTENDANCE MODULE SEEDING
  // ============================================
  console.log('\n🎯 ATTENDANCE MODULE INITIALIZATION\n');
  
  // Seed shifts
  await seedShifts();
  
  // Seed leave types
  await seedLeaveTypes();
  
  // Seed holidays
  await seedHolidays();
  
  // Seed attendance configuration
  await seedAttendanceConfig();

  console.log('✅ All attendance module seeds completed successfully!\n');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error during seeding:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
