'use strict';

/**
 * Adds the composite unique constraint on rfp_vendors(rfp_id, vendor_id).
 *
 * Sequelize's sync() creates this automatically for the belongsToMany through
 * table, so development databases built with sync-db.js already have it while
 * migrated databases did not. rfpController.sendRfpToVendors uses
 * RfpVendor.findOrCreate(), which relies on a unique constraint to stay
 * race-safe -- without it, concurrent sends can insert duplicate rows.
 *
 * IF NOT EXISTS keeps this a no-op on databases that already picked the index
 * up from sync().
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS rfp_vendors_rfp_id_vendor_id_key ' +
        'ON rfp_vendors (rfp_id, vendor_id);'
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS rfp_vendors_rfp_id_vendor_id_key;'
    );
  },
};
