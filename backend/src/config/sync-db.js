require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { sequelize } = require('../models');

const NODE_ENV = process.env.NODE_ENV || 'development';

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
