const jobQueue = require('../services/jobQueue');

// GET /api/jobs/:id — Check the status of a background job
async function getJobStatus(req, res, next) {
  try {
    if (!jobQueue.isAvailable()) {
      return res.status(404).json({ error: 'Job queue is not available' });
    }

    const job = await jobQueue.getJobById(req.params.id);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const response = {
      id: job.id,
      name: job.name,
      state: job.state,
      data: job.data,
      createdOn: job.createdon || job.createdOn,
      startedOn: job.startedon || job.startedOn,
      completedOn: job.completedon || job.completedOn,
    };

    if (job.state === 'failed' && job.output) {
      response.error = typeof job.output === 'string' ? job.output : job.output.message || 'Job failed';
    }

    res.json(response);
  } catch (err) {
    next(err);
  }
}

module.exports = { getJobStatus };
