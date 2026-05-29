/**
 * Mock for pg-boss module used in tests.
 * Prevents pg-boss ESM import issues and database connections during testing.
 */
class PgBoss {
  constructor() {
    this.handlers = {};
  }

  on() {}

  async start() {}
  async stop() {}

  async work(name, options, handler) {
    this.handlers[name] = handler;
  }

  async send() {
    return null;
  }

  async getJobById() {
    return null;
  }
}

module.exports = PgBoss;
