// Helper for curator-ops.sh, run inside the mb4-service container:
//   node scripts/curator-ops/curator-ops.js info [--require-exportable] <ids>
//   node scripts/curator-ops/curator-ops.js share <id> | unshare <id> | list
// Exit codes: 0 ok, 1 error, 2 bad usage, 3 a project can't be exported.
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  UploadPartCopyCommand,
} from '@aws-sdk/client-s3'
import sequelizeConn from '../../src/util/db.js'
import s3Service from '../../src/services/s3-service.js'

const SOURCE_BUCKET = process.env.AWS_S3_DEFAULT_BUCKET || 'mb4-data'
const SHARE_BUCKET = process.env.CURATOR_OPS_SHARE_BUCKET || 'shareable-mb-files'
const SHARE_REGION = process.env.CURATOR_OPS_SHARE_REGION || 'us-west-2'
// CopyObject stops at 5 GB; bigger ZIPs are copied server-side in parts.
const SINGLE_COPY_LIMIT = 5 * 1024 ** 3
const COPY_PART_SIZE = 512 * 1024 ** 2
const SHARE_KEY = /^(\d+)_morphobank\.zip$/

const exportKey = (id) => `sdd_exports/${id}_morphobank.zip`
const shareKey = (id) => `${id}_morphobank.zip`
const shareUrl = (id) =>
  `https://${SHARE_BUCKET}.s3.${SHARE_REGION}.amazonaws.com/${shareKey(id)}`
const mb = (bytes) => Math.round((Number(bytes) || 0) / 1024 / 1024)
const day = (date) => (date ? new Date(date).toISOString().slice(0, 10) : '?')

class UsageError extends Error {}

function parseIds(arg, { single = false } = {}) {
  const ids = String(arg || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (!ids.length || !ids.every((id) => /^\d{1,7}$/.test(id))) {
    throw new UsageError(`"${arg ?? ''}" is not a list of project numbers`)
  }
  if (single && ids.length > 1) throw new UsageError('one project at a time')
  return ids.map(Number)
}

async function loadProjects(ids) {
  const [rows] = await sequelizeConn.query(
    'SELECT project_id, name, published, deleted, disk_usage FROM projects WHERE project_id IN (?)',
    { replacements: [ids] }
  )
  return new Map(rows.map((row) => [Number(row.project_id), row]))
}

// Unpublished project names stay private, so problems never echo the name.
function exportProblem(project) {
  if (!project) return 'not found'
  if (Number(project.deleted)) return 'deleted'
  if (Number(project.published) !== 1) {
    return 'not published. Curator exports are for published projects only; ask the tech team'
  }
  return null
}

async function info(args) {
  const requireExportable = args[0] === '--require-exportable'
  const ids = parseIds(requireExportable ? args[1] : args[0])
  const projects = await loadProjects(ids)
  let blocked = 0
  for (const id of ids) {
    const project = projects.get(id)
    const problem = exportProblem(project)
    if (problem) {
      blocked++
      console.log(`P${id}: cannot export: ${problem}.`)
      continue
    }
    console.log(
      `P${id}: OK to export. "${project.name}", about ${mb(project.disk_usage)} MB of files.`
    )
    const shared = await s3Service.getObjectAttributes(SHARE_BUCKET, shareKey(id))
    console.log(
      shared
        ? `  Shared copy already exists: made ${day(shared.lastModified)}, ${mb(shared.contentLength)} MB, ${shareUrl(id)}`
        : '  No shared copy yet.'
    )
  }
  return requireExportable && blocked ? 3 : 0
}

// Server-side multipart copy (nothing passes through this machine), for objects of 5 GB or more.
async function copyInParts(sourceKey, destKey, size) {
  const client = s3Service.s3Client
  const { UploadId } = await client.send(
    new CreateMultipartUploadCommand({
      Bucket: SHARE_BUCKET,
      Key: destKey,
      ContentType: 'application/zip',
    })
  )
  try {
    const parts = []
    for (let start = 0, n = 1; start < size; start += COPY_PART_SIZE, n++) {
      const end = Math.min(start + COPY_PART_SIZE, size) - 1
      const { CopyPartResult } = await client.send(
        new UploadPartCopyCommand({
          Bucket: SHARE_BUCKET,
          Key: destKey,
          UploadId,
          PartNumber: n,
          CopySource: `${SOURCE_BUCKET}/${sourceKey}`,
          CopySourceRange: `bytes=${start}-${end}`,
        })
      )
      parts.push({ PartNumber: n, ETag: CopyPartResult.ETag })
    }
    await client.send(
      new CompleteMultipartUploadCommand({
        Bucket: SHARE_BUCKET,
        Key: destKey,
        UploadId,
        MultipartUpload: { Parts: parts },
      })
    )
  } catch (error) {
    await client
      .send(new AbortMultipartUploadCommand({ Bucket: SHARE_BUCKET, Key: destKey, UploadId }))
      .catch(() => {})
    throw error
  }
}

async function share(args) {
  const [id] = parseIds(args[0], { single: true })
  const problem = exportProblem((await loadProjects([id])).get(id))
  if (problem) {
    console.log(`P${id}: cannot share: ${problem}.`)
    return 3
  }
  const source = await s3Service.getObjectAttributes(SOURCE_BUCKET, exportKey(id))
  if (!source) throw new Error(`no export at ${SOURCE_BUCKET}/${exportKey(id)}`)
  if (Number(source.contentLength) < SINGLE_COPY_LIMIT) {
    await s3Service.copyObject(SOURCE_BUCKET, exportKey(id), SHARE_BUCKET, shareKey(id))
  } else {
    await copyInParts(exportKey(id), shareKey(id), Number(source.contentLength))
  }
  const copy = await s3Service.getObjectAttributes(SHARE_BUCKET, shareKey(id))
  if (!copy) throw new Error(`copy to ${SHARE_BUCKET}/${shareKey(id)} not found`)
  console.log(`SHARED P${id} ${shareUrl(id)} ${mb(copy.contentLength)} MB`)
  return 0
}

async function unshare(args) {
  const [id] = parseIds(args[0], { single: true })
  if (!(await s3Service.getObjectAttributes(SHARE_BUCKET, shareKey(id)))) {
    console.log(`P${id}: there is no shared copy to remove.`)
    return 0
  }
  await s3Service.deleteObject(SHARE_BUCKET, shareKey(id))
  console.log(`REMOVED P${id}: ${shareUrl(id)} no longer works.`)
  return 0
}

// Only project exports; anything else in the bucket was shared by hand and is left alone.
async function list() {
  const objects = (await s3Service.listObjects(SHARE_BUCKET))
    .filter((o) => SHARE_KEY.test(o.Key))
    .sort((a, b) => new Date(a.LastModified) - new Date(b.LastModified))
  if (!objects.length) console.log('No project ZIPs are shared right now.')
  for (const o of objects) {
    const id = o.Key.match(SHARE_KEY)[1]
    console.log(`P${id}\tshared ${day(o.LastModified)}\t${mb(o.Size)} MB\t${shareUrl(id)}`)
  }
  return 0
}

const commands = { info, share, unshare, list }
const [command, ...args] = process.argv.slice(2)
let code = 0
try {
  if (!commands[command]) {
    throw new UsageError(`unknown command "${command ?? ''}"; use info, share, unshare or list`)
  }
  code = await commands[command](args)
} catch (error) {
  console.error(`ERROR: ${error.message}`)
  code = error instanceof UsageError ? 2 : 1
} finally {
  await sequelizeConn.close().catch(() => {})
}
process.exit(code)
