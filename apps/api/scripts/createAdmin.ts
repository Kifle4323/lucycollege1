import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@gmail.com';
  const password = 'password-123';
  const fullName = 'admin';
  
  // Check if admin already exists
  const existing = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });
  
  if (existing) {
    console.log('Admin user already exists!');
    console.log('Email:', existing.email);
    console.log('Role:', existing.role);
    return;
  }
  
  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);
  
  // Create admin user
  const admin = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash,
      fullName,
      role: 'ADMIN',
      isApproved: true,
      isProfileComplete: true,
    },
  });
  
  console.log('Admin user created successfully!');
  console.log('---');
  console.log('Email:', admin.email);
  console.log('Password:', password);
  console.log('Role:', admin.role);
  console.log('---');
  console.log('You can now login with these credentials.');
}

main()
  .catch((e) => {
    console.error('Error creating admin:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
