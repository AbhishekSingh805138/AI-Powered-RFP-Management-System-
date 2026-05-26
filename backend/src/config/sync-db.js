require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { sequelize } = require('../models');

async function syncDatabase() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established.');

    await sequelize.sync({ alter: true });
    console.log('All models synchronized.');

    process.exit(0);
  } catch (error) {
    console.error('Database sync failed:', error.message);
    process.exit(1);
  }
}

syncDatabase();
