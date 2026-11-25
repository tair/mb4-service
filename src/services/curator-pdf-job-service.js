import { randomUUID } from 'crypto'

// Background jobs for AI character extraction from PDF/Word documents.
//
// An extraction takes 30 seconds to several minutes, longer than the proxies in
// front of the service hold a request open (60 s on the beta ALB, 120 s in
// production Apache), so the browser starts a job and polls for its result
// instead of waiting on one long request.
//
// Jobs are held in memory: each environment runs a single service container, and
// a job lost to a restart only means the curator starts the extraction again.

const JOB_TTL_MS = 30 * 60 * 1000
const MAX_JOBS = 200

const jobs = new Map()

/**
 * Start a job that runs `work` in the background.
 *
 * `work` returns a promise for the job's result. When it rejects, `toFailure`
 * turns the error into the { httpStatus, body } the client sees.
 *
 * Returns the job id, or null when too many jobs are already held.
 */
export function startJob(work, toFailure) {
  removeExpiredJobs()
  if (countRunningJobs() >= MAX_JOBS) {
    return null
  }
  // Finished jobs give way to new ones before the TTL when the store is full.
  while (jobs.size >= MAX_JOBS) {
    removeOldestFinishedJob()
  }

  const jobId = randomUUID()
  const job = {
    status: 'running',
    createdAt: Date.now(),
    finishedAt: null,
    result: null,
    failure: null,
  }
  jobs.set(jobId, job)

  Promise.resolve()
    .then(work)
    .then(
      (result) => {
        job.status = 'done'
        job.result = result
      },
      (error) => {
        job.status = 'failed'
        job.failure = toFailure(error)
      }
    )
    .finally(() => {
      job.finishedAt = Date.now()
    })

  return jobId
}

/**
 * The job's current state, or null when the id is unknown or has expired.
 */
export function getJob(jobId) {
  removeExpiredJobs()
  const job = jobs.get(jobId)
  if (!job) {
    return null
  }
  return {
    status: job.status,
    result: job.result,
    failure: job.failure,
    elapsedSeconds: Math.round(
      ((job.finishedAt ?? Date.now()) - job.createdAt) / 1000
    ),
  }
}

// For tests.
export function clearJobs() {
  jobs.clear()
}

function removeExpiredJobs() {
  const now = Date.now()
  for (const [jobId, job] of jobs) {
    if (now - job.createdAt >= JOB_TTL_MS) {
      jobs.delete(jobId)
    }
  }
}

function countRunningJobs() {
  let count = 0
  for (const job of jobs.values()) {
    if (job.status === 'running') {
      count++
    }
  }
  return count
}

function removeOldestFinishedJob() {
  for (const [jobId, job] of jobs) {
    if (job.status !== 'running') {
      jobs.delete(jobId)
      return
    }
  }
}
