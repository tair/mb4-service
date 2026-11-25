import { afterEach, describe, expect, jest, test } from '@jest/globals'
import {
  clearJobs,
  getJob,
  startJob,
} from 'services/curator-pdf-job-service.js'

const toFailure = (error) => ({
  httpStatus: error.status ?? 500,
  body: { success: false, message: error.message },
})

// Lets the job's promise chain settle.
const settle = () => new Promise((resolve) => globalThis.setImmediate(resolve))

// Work that never finishes.
const pending = () => new Promise(() => undefined)

function deferred() {
  let resolve, reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('curator PDF job service', () => {
  afterEach(() => {
    clearJobs()
    jest.useRealTimers()
  })

  test('a job reports running until its work finishes, then its result', async () => {
    const work = deferred()
    const jobId = startJob(() => work.promise, toFailure)

    expect(getJob(jobId).status).toBe('running')

    work.resolve({ success: true, data: { characters: [] } })
    await settle()

    const job = getJob(jobId)
    expect(job.status).toBe('done')
    expect(job.result).toEqual({ success: true, data: { characters: [] } })
    expect(job.failure).toBeNull()
  })

  test('a failed job reports the failure built from its error', async () => {
    const error = Object.assign(new Error('Curator API error'), { status: 502 })
    const jobId = startJob(() => Promise.reject(error), toFailure)
    await settle()

    const job = getJob(jobId)
    expect(job.status).toBe('failed')
    expect(job.failure).toEqual({
      httpStatus: 502,
      body: { success: false, message: 'Curator API error' },
    })
  })

  test('work that throws synchronously still fails the job', async () => {
    const jobId = startJob(() => {
      throw new Error('boom')
    }, toFailure)
    await settle()

    expect(getJob(jobId).status).toBe('failed')
  })

  test('job ids are unique and unknown ids return null', () => {
    const first = startJob(pending, toFailure)
    const second = startJob(pending, toFailure)

    expect(first).not.toBe(second)
    expect(getJob('no-such-job')).toBeNull()
  })

  test('jobs expire after 30 minutes', () => {
    jest.useFakeTimers({ now: new Date('2026-11-25T12:00:00Z') })
    const jobId = startJob(pending, toFailure)

    jest.setSystemTime(new Date('2026-11-25T12:29:00Z'))
    expect(getJob(jobId)).not.toBeNull()

    jest.setSystemTime(new Date('2026-11-25T12:30:00Z'))
    expect(getJob(jobId)).toBeNull()
  })

  test('elapsed time stops counting when the job finishes', async () => {
    jest.useFakeTimers({
      now: new Date('2026-11-25T12:00:00Z'),
      doNotFake: ['setImmediate', 'nextTick'],
    })
    const work = deferred()
    const jobId = startJob(() => work.promise, toFailure)

    jest.setSystemTime(new Date('2026-11-25T12:01:30Z'))
    expect(getJob(jobId).elapsedSeconds).toBe(90)

    work.resolve({ success: true })
    await settle()

    jest.setSystemTime(new Date('2026-11-25T12:05:00Z'))
    expect(getJob(jobId).elapsedSeconds).toBe(90)
  })

  test('new jobs are refused while 200 are running', () => {
    for (let i = 0; i < 200; i++) {
      expect(startJob(pending, toFailure)).not.toBeNull()
    }

    expect(startJob(pending, toFailure)).toBeNull()
  })

  test('finished jobs make room for new ones when the store is full', async () => {
    const finishedId = startJob(() => Promise.resolve({ success: true }), toFailure)
    await settle()
    for (let i = 0; i < 199; i++) {
      startJob(pending, toFailure)
    }

    const newId = startJob(pending, toFailure)

    expect(newId).not.toBeNull()
    expect(getJob(finishedId)).toBeNull()
    expect(getJob(newId).status).toBe('running')
  })
})
