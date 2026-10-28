import { connectDB, disconnectDB } from '../src/config/db.js';
import { Firm } from '../src/models/Firm.model.js';

async function main() {
  await connectDB();
  const result = await Firm.updateMany(
    {},
    { $addToSet: { 'settings.allowedVideoProviders': 'cloudinary' } }
  );
  console.log(`Updated ${result.modifiedCount} firms with 'cloudinary' provider.`);
  await disconnectDB();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
