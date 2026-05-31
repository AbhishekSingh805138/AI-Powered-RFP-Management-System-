#!/usr/bin/env node

/**
 * Admin Bootstrap Script
 *
 * Creates the initial admin account for the RFP Management System.
 * Run once during deployment before opening the app to users.
 *
 * Usage:
 *   npm run setup:admin -- --email admin@company.com --password SecurePass123 --firstName John --lastName Doe
 *
 * Or with environment variables:
 *   ADMIN_EMAIL=admin@company.com ADMIN_PASSWORD=SecurePass123 ADMIN_FIRST_NAME=John ADMIN_LAST_NAME=Doe npm run setup:admin
 */

require('dotenv').config();

const bcrypt = require('bcryptjs');
const { User } = require('../src/models');
const sequelize = require('../src/config/database');

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace(/^--/, '');
    const value = args[i + 1];
    if (key && value) parsed[key] = value;
  }

  return {
    email: parsed.email || process.env.ADMIN_EMAIL,
    password: parsed.password || process.env.ADMIN_PASSWORD,
    firstName: parsed.firstName || process.env.ADMIN_FIRST_NAME || 'Admin',
    lastName: parsed.lastName || process.env.ADMIN_LAST_NAME || 'User',
  };
}

function validatePassword(password) {
  if (!password || password.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter';
  if (!/[a-z]/.test(password)) return 'Password must contain a lowercase letter';
  if (!/[0-9]/.test(password)) return 'Password must contain a number';
  return null;
}

async function main() {
  const { email, password, firstName, lastName } = parseArgs();

  if (!email || !password) {
    console.error('\nUsage:');
    console.error('  npm run setup:admin -- --email admin@company.com --password SecurePass123 --firstName John --lastName Doe\n');
    console.error('Or set environment variables: ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_FIRST_NAME, ADMIN_LAST_NAME\n');
    process.exit(1);
  }

  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error(`Invalid email format: ${email}`);
    process.exit(1);
  }

  // Validate password strength
  const passwordError = validatePassword(password);
  if (passwordError) {
    console.error(`Password policy: ${passwordError}`);
    process.exit(1);
  }

  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    // Check if this email already exists
    const existing = await User.scope('withPassword').findOne({ where: { email } });
    if (existing) {
      if (existing.role === 'admin') {
        console.log(`Admin account already exists: ${email}`);
        process.exit(0);
      }
      // Promote existing user to admin
      await existing.update({ role: 'admin' });
      console.log(`Existing user promoted to admin: ${email}`);
      await sequelize.close();
      process.exit(0);
    }

    // Check if any admin already exists
    const adminCount = await User.count({ where: { role: 'admin' } });
    if (adminCount > 0) {
      console.warn(`Warning: ${adminCount} admin account(s) already exist. Creating another one.`);
    }

    // Create the admin user
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      email,
      passwordHash,
      firstName,
      lastName,
      role: 'admin',
      status: 'active',
    });

    console.log('\nAdmin account created successfully:');
    console.log(`  Email:    ${user.email}`);
    console.log(`  Name:     ${user.firstName} ${user.lastName}`);
    console.log(`  Role:     admin`);
    console.log(`  ID:       ${user.id}`);
    console.log('\nYou can now login at the frontend.\n');

    await sequelize.close();
    process.exit(0);
  } catch (err) {
    console.error('Failed to create admin account:', err.message);
    await sequelize.close().catch(() => {});
    process.exit(1);
  }
}

main();
