require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { sequelize } = require('../models');

const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * True when the database is managed by sequelize-cli migrations, i.e. the
 * SequelizeMeta bookkeeping table exists and records applied migrations.
 */
async function isMigrationManaged() {
  const [tables] = await sequelize.query(
    "SELECT COUNT(*)::int AS count FROM information_schema.tables " +
    "WHERE table_schema = 'public' AND table_name = 'SequelizeMeta'"
  );
  if (!tables[0] || tables[0].count === 0) return false;

  const [applied] = await sequelize.query('SELECT COUNT(*)::int AS count FROM "SequelizeMeta"');
  return Boolean(applied[0] && applied[0].count > 0);
}

async function syncDatabase() {
  if (NODE_ENV === 'production') {
    console.error(
      'ERROR: sync-db.js must not run in production. Use migrations instead:\n' +
      '  npx sequelize-cli db:migrate'
    );
    process.exit(1);
  }

  const forceFlag = process.argv.includes('--force');

  try {
    await sequelize.authenticate();
    console.log(`Database connection established (env: ${NODE_ENV}).`);

    // sync() does not reproduce the migration schema. The FK columns it derives
    // from associations are nullable even where the model says allowNull: false,
    // and it creates none of the performance indexes. Running it against a
    // migration-managed database silently reintroduces that drift.
    if (await isMigrationManaged()) {
      console.error(
        'ERROR: this database is managed by migrations (SequelizeMeta is populated).\n' +
        'sync() would alter its schema away from what the migrations define. Use:\n' +
        '  npm run migrate'
      );
      process.exit(1);
    }

    if (forceFlag) {
      console.warn('WARNING: --force flag detected. This will DROP and recreate all tables.');
      await sequelize.sync({ force: true });
    } else {
      await sequelize.sync({ alter: true });
    }
    console.log('All models synchronized.');

    process.exit(0);
  } catch (error) {
    console.error('Database sync failed:', error.message);
    process.exit(1);
  }
}

syncDatabase();
