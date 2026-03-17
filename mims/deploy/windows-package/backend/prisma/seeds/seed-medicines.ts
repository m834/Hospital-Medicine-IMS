/**
 * Seed Sample Medicines
 * Creates sample medicines for testing the medicines management UI
 * 
 * Usage: ts-node prisma/seeds/seed-medicines.ts
 */

import { PrismaClient, MedicineForm } from '@prisma/client';

const prisma = new PrismaClient();

const sampleMedicines = [
  {
    name: 'Paracetamol',
    genericName: 'Acetaminophen',
    form: MedicineForm.TABLET,
    strength: '500mg',
    manufacturer: 'GSK',
  },
  {
    name: 'Amoxicillin',
    genericName: 'Amoxicillin Trihydrate',
    form: MedicineForm.CAPSULE,
    strength: '250mg',
    manufacturer: 'Pfizer',
  },
  {
    name: 'Ibuprofen',
    genericName: 'Ibuprofen',
    form: MedicineForm.TABLET,
    strength: '400mg',
    manufacturer: 'Abbott',
  },
  {
    name: 'Cough Syrup',
    genericName: 'Dextromethorphan',
    form: MedicineForm.SYRUP,
    strength: '10mg/5ml',
    manufacturer: 'Getz Pharma',
  },
  {
    name: 'Insulin',
    genericName: 'Insulin Human',
    form: MedicineForm.INJECTION,
    strength: '100IU/ml',
    manufacturer: 'Novo Nordisk',
  },
  {
    name: 'Metformin',
    genericName: 'Metformin HCL',
    form: MedicineForm.TABLET,
    strength: '850mg',
    manufacturer: 'Searle',
  },
  {
    name: 'Omeprazole',
    genericName: 'Omeprazole',
    form: MedicineForm.CAPSULE,
    strength: '20mg',
    manufacturer: 'Himont Pharma',
  },
  {
    name: 'Ciprofloxacin',
    genericName: 'Ciprofloxacin HCL',
    form: MedicineForm.TABLET,
    strength: '500mg',
    manufacturer: 'Bosch Pharma',
  },
  {
    name: 'Eye Drops',
    genericName: 'Tobramycin',
    form: MedicineForm.DROPS,
    strength: '0.3%',
    manufacturer: 'Alcon',
  },
  {
    name: 'Ceftriaxone',
    genericName: 'Ceftriaxone Sodium',
    form: MedicineForm.INJECTION,
    strength: '1g',
    manufacturer: 'Getz Pharma',
  },
  {
    name: 'Aspirin',
    genericName: 'Acetylsalicylic Acid',
    form: MedicineForm.TABLET,
    strength: '75mg',
    manufacturer: 'Bayer',
  },
  {
    name: 'Hydrocortisone Cream',
    genericName: 'Hydrocortisone',
    form: MedicineForm.CREAM,
    strength: '1%',
    manufacturer: 'GSK',
  },
  {
    name: 'Azithromycin',
    genericName: 'Azithromycin',
    form: MedicineForm.TABLET,
    strength: '500mg',
    manufacturer: 'Pfizer',
  },
  {
    name: 'Amoxicillin Suspension',
    genericName: 'Amoxicillin',
    form: MedicineForm.SUSPENSION,
    strength: '125mg/5ml',
    manufacturer: 'GSK',
  },
  {
    name: 'ORS Powder',
    genericName: 'Oral Rehydration Salts',
    form: MedicineForm.POWDER,
    strength: '20.5g',
    manufacturer: 'Local',
  },
];

async function main() {
  console.log('🌱 Starting medicine seeding...');

  // Get all hospitals
  const hospitals = await prisma.hospital.findMany({
    where: { status: 'ACTIVE' },
  });

  if (hospitals.length === 0) {
    console.error('❌ No active hospitals found. Please create hospitals first.');
    return;
  }

  console.log(`📋 Found ${hospitals.length} active hospital(s)`);

  let createdCount = 0;
  let skippedCount = 0;

  // Create medicines for each hospital
  for (const hospital of hospitals) {
    console.log(`\n🏥 Processing hospital: ${hospital.name} (${hospital.code})`);

    for (const medicine of sampleMedicines) {
      try {
        // Check if medicine already exists
        const existing = await prisma.medicine.findFirst({
          where: {
            hospitalId: hospital.id,
            name: medicine.name,
            form: medicine.form,
          },
        });

        if (existing) {
          console.log(`   ⏭️  Skipped: ${medicine.name} (${medicine.form}) - already exists`);
          skippedCount++;
          continue;
        }

        // Create medicine
        await prisma.medicine.create({
          data: {
            ...medicine,
            hospitalId: hospital.id,
            status: 'ACTIVE',
          },
        });

        console.log(`   ✅ Created: ${medicine.name} (${medicine.form}) - ${medicine.strength}`);
        createdCount++;
      } catch (error) {
        console.error(`   ❌ Failed to create ${medicine.name}:`, error);
      }
    }
  }

  console.log('\n📊 Summary:');
  console.log(`   ✅ Created: ${createdCount} medicines`);
  console.log(`   ⏭️  Skipped: ${skippedCount} medicines (already exist)`);
  console.log('✨ Seeding completed!\n');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
