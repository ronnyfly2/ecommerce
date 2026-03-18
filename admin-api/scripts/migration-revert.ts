import { AppDataSource } from '../src/data-source';

async function revertMigration() {
  try {
    await AppDataSource.initialize();
    console.log('Reverting latest migration...');
    await AppDataSource.undoLastMigration();
    console.log('✅ Migration reverted');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration revert failed:', error);
    process.exit(1);
  }
}

revertMigration();
