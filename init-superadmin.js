require('dotenv').config();
const UserRepository = require('./repositories/UserRepository');
const { hashPassword } = require('./utils/auth');
const { initializeDatabase } = require('./database');

async function initSuperadmin() {
  try {
    await initializeDatabase();
    console.log('Database initialized');

    const email = 'admin@dineflow.com';
    const password = 'Demo@123';
    const name = 'Admin User';

    // Check if user exists
    const existing = await UserRepository.findByEmail(email);
    if (existing) {
      console.log('✅ Superadmin already exists');
      process.exit(0);
    }

    // Create superadmin
    const passwordHash = await hashPassword(password);
    const userId = await UserRepository.create({
      tenant_id: null,
      email,
      password_hash: passwordHash,
      name,
      role: 'superadmin'
    });

    console.log('✅ Superadmin created successfully');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log(`   ID: ${userId}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

initSuperadmin();
