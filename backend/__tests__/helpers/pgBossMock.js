/**
 * Mock for pg-boss module used in tests.
 * Prevents pg-boss ESM import issues and database connections during testing.
 *
 * Mirrors the pg-boss v12 API surface: a named PgBoss export, queues declared
 * via createQueue(), and queue-scoped getJobById(name, id).
 */
class PgBoss {
  constructor() {
    this.handlers = {};
    this.queues = new Set();
  }

  on() {}

  async start() {
    return this;
  }

  async stop() {}

  async createQueue(name) {
    this.queues.add(name);
  }

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

module.exports = { PgBoss };
