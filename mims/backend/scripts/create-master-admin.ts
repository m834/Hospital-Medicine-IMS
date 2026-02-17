import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Creating Master Admin User...\n');

  const masterAdminEmail = 'master@mims.com';
  const masterAdminPassword = 'Master@12345';

  // Check if Master Admin already exists
  const existingMasterAdmin = await prisma.user.findUnique({
    where: { email: masterAdminEmail },
  });

  if (existingMasterAdmin) {
    console.log('⚠️  Master Admin already exists!');
    console.log(`   Email: ${existingMasterAdmin.email}`);
    console.log(`   Role: ${existingMasterAdmin.role}`);
    console.log(`   ID: ${existingMasterAdmin.id}`);
    
    if (existingMasterAdmin.role !== 'MASTER_ADMIN') {
      console.log('\n📝 Updating user role to MASTER_ADMIN...');
      
      const updatedUser = await prisma.user.update({
        where: { email: masterAdminEmail },
        data: {
          role: 'MASTER_ADMIN',
          hospitalId: null, // MASTER_ADMIN is not tied to any hospital
          pharmacyId: null,
        },
      });

      console.log('✅ User role updated to MASTER_ADMIN');
      console.log(`   Email: ${updatedUser.email}`);
      console.log(`   Role: ${updatedUser.role}`);
    }
    
    return;
  }

  // Create new Master Admin
  const hashedPassword = await argon2.hash(masterAdminPassword);

  const masterAdmin = await prisma.user.create({
    data: {
      email: masterAdminEmail,
      passwordHash: hashedPassword,
      fullName: 'Master Administrator',
      phone: '+92-300-9999999',
      role: 'MASTER_ADMIN',
      status: 'ACTIVE',
      hospitalId: null, // MASTER_ADMIN is not tied to any hospital
      pharmacyId: null,
    },
  });

  console.log('✅ Master Admin created successfully!\n');
  console.log('='.repeat(60));
  console.log('MASTER ADMIN CREDENTIALS:');
  console.log('='.repeat(60));
  console.log(`Email: ${masterAdminEmail}`);
  console.log(`Password: ${masterAdminPassword}`);
  console.log(`Role: MASTER_ADMIN`);
  console.log(`ID: ${masterAdmin.id}`);
  console.log('='.repeat(60));
  console.log('\n🔐 Master Admin has full system access across all hospitals');
  console.log('   - Can manage all hospitals, users, and system settings');
  console.log('   - Not tied to any specific hospital');
  console.log('   - Highest level of administrative privileges\n');
}

main()
  .then(async () => {
    console.log('✅ Operation completed successfully!\n');
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
