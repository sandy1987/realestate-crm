/**
 * scripts/seedAdmin.js
 *
 * Seeds initial demo accounts and entities into the configured MongoDB Atlas database:
 *  - 1 Platform SUPER_ADMIN
 *  - 1 Tenant Firm ("Apex Realty")
 *  - 1 FIRM_ADMIN ("admin@apex.com")
 *  - 1 FIRM_STAFF ("staff@apex.com")
 *  - 1 Colony ("Silver Springs Colony")
 *  - 1 Public Plot ("PLOT-A-101")
 *  - 1 PlotPrivate record
 */

import dns from 'dns';
import mongoose from 'mongoose';
import config from '../src/config/env.js';
import { hashPassword } from '../src/utils/password.js';
import { ROLES } from '../src/constants/roles.js';
import { PERMS } from '../src/constants/permissions.js';
import { User } from '../src/models/User.model.js';
import { Firm } from '../src/models/Firm.model.js';
import { Colony } from '../src/models/Colony.model.js';
import { Plot } from '../src/models/Plot.model.js';
import { PlotPrivate } from '../src/models/PlotPrivate.model.js';

if (config.MONGODB_URI.startsWith('mongodb+srv://')) {
  try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  } catch {
    // fallback
  }
}

async function seed() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(config.MONGODB_URI);
  console.log('Connected to Atlas successfully.');

  const defaultPassword = 'Password123!';
  const passwordHash = await hashPassword(defaultPassword);

  // 1. Create Platform SUPER_ADMIN
  let superAdmin = await User.findOne({ email: 'superadmin@broker.com' });
  if (!superAdmin) {
    superAdmin = await User.create({
      email: 'superadmin@broker.com',
      passwordHash,
      role: ROLES.SUPER_ADMIN,
      firmId: null,
      firstName: 'Platform',
      lastName: 'SuperAdmin',
      isActive: true,
    });
    console.log('✔ Created SUPER_ADMIN: superadmin@broker.com (Password: Password123!)');
  } else {
    console.log('ℹ SUPER_ADMIN already exists: superadmin@broker.com');
  }

  // 2. Create Sample Firm
  let firm = await Firm.findOne({ slug: 'apex-realty' });
  if (!firm) {
    firm = await Firm.create({
      name: 'Apex Realty Developers',
      slug: 'apex-realty',
      contactEmail: 'contact@apexrealty.com',
      contactPhone: '+91 98765 43210',
      isActive: true,
      settings: {
        allowedVideoProviders: ['youtube', 'vimeo', 'cloudinary'],
        defaultCurrency: 'INR',
      },
    });
    console.log(`✔ Created Tenant Firm: Apex Realty Developers (${firm._id})`);
  } else {
    console.log('ℹ Tenant Firm already exists: Apex Realty Developers');
  }

  // 3. Create FIRM_ADMIN
  let firmAdmin = await User.findOne({ email: 'admin@apex.com' });
  if (!firmAdmin) {
    firmAdmin = await User.create({
      email: 'admin@apex.com',
      passwordHash,
      role: ROLES.FIRM_ADMIN,
      firmId: firm._id,
      firstName: 'Vikram',
      lastName: 'Sharma',
      isActive: true,
    });
    console.log('✔ Created FIRM_ADMIN: admin@apex.com (Password: Password123!)');
  } else {
    console.log('ℹ FIRM_ADMIN already exists: admin@apex.com');
  }

  // 4. Create FIRM_STAFF
  let firmStaff = await User.findOne({ email: 'staff@apex.com' });
  if (!firmStaff) {
    firmStaff = await User.create({
      email: 'staff@apex.com',
      passwordHash,
      role: ROLES.FIRM_STAFF,
      firmId: firm._id,
      firstName: 'Rahul',
      lastName: 'Verma',
      permissions: [
        PERMS.PLOTS_READ,
        PERMS.PLOTS_WRITE,
        PERMS.COLONIES_READ,
        PERMS.COLONIES_WRITE,
        PERMS.PRIVATE_READ,
        PERMS.AUDIT_READ,
      ],
      isActive: true,
    });
    console.log('✔ Created FIRM_STAFF: staff@apex.com (Password: Password123!)');
  } else {
    console.log('ℹ FIRM_STAFF already exists: staff@apex.com');
  }

  // 5. Create Sample Colony
  let colony = await Colony.findOne({ firmId: firm._id, name: 'Silver Springs Colony' });
  if (!colony) {
    colony = await Colony.create({
      name: 'Silver Springs Colony',
      firmId: firm._id,
      description: 'Gated luxury residential enclave',
      city: 'Jaipur',
      state: 'Rajasthan',
      country: 'India',
      pincode: '302020',
      isActive: true,
      createdBy: firmAdmin._id,
    });
    console.log(`✔ Created Colony: Silver Springs Colony (${colony._id})`);
  }

  // 6. Create Sample Plot
  let plot = await Plot.findOne({ firmId: firm._id, plotRef: 'PLOT-A-101' });
  if (!plot) {
    plot = await Plot.create({
      plotRef: 'PLOT-A-101',
      plotId: 'PLOT-A-101',
      colonyId: colony._id,
      firmId: firm._id,
      size: 1500,
      sizeUnit: 'sqft',
      rate: 4500,
      rateType: 'total',
      totalPrice: 6750000,
      status: 'available',
      currency: 'INR',
      description: 'North-facing corner plot near central green park',
      videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      videoProvider: 'youtube',
      isActive: true,
      createdBy: firmAdmin._id,
    });
    console.log(`✔ Created Plot: PLOT-A-101 (${plot._id})`);

    // 7. Create PlotPrivate Record
    await PlotPrivate.create({
      plotId: plot._id,
      firmId: firm._id,
      owner: {
        name: 'Rajendra Prasad Gupta',
        phone: '+91 98111 22334',
        email: 'rajendra.gupta@example.com',
        address: 'B-12, Malviya Nagar, Jaipur',
      },
      source: {
        name: 'Amit Agarwal (Direct Referrer)',
        phone: '+91 98222 33445',
        type: 'direct',
      },
      notes: 'Owner prefers quick closing; title deed clear and verified.',
      createdBy: firmAdmin._id,
    });
    console.log('✔ Created PlotPrivate record for PLOT-A-101');
  }

  console.log('\n--- SEED COMPLETE ---');
  console.log('Ready for manual testing with both UI and Postman/curl!');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
