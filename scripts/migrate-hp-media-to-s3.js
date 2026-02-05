// Usage examples:
//   node scripts/migrate-hp-media-to-s3.js
//   node scripts/migrate-hp-media-to-s3.js --derived-format=jpg
//   node scripts/migrate-hp-media-to-s3.js --derived-format=png --original-format=keep
//
// Env expected (already set in container):
//   DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
//   AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_DEFAULT_BUCKET
// Optional legacy source config:
//   LEGACY_IMAGES_DIR=/path/to/legacy/images (local filesystem hash/magic/FILENAME layout)
//   LEGACY_BASE_URL=https://morphobank.org/media/morphobank3/images

// RUN ON LOCAL: docker exec -it mb4-service-container-local npm run migrate:hp-media

import mysql from 'mysql2/promise'
import { S3Client, GetObjectCommand, PutObjectCommand, CopyObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'
import https from 'https'
import http from 'http'
import fs from 'fs'
import path from 'path'

const BUCKET = process.env.AWS_S3_DEFAULT_BUCKET
if (!BUCKET) {
  console.error('Missing AWS_S3_DEFAULT_BUCKET in environment')
  process.exit(1)
}

const ARGS = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v = true] = a.replace(/^--/, '').split('=')
    return [k, v]
  })
)

// Formats:
// - original-format: keep | png | jpg      (default: keep original extension)
// - derived-format : png | jpg             (default: jpg)
const ORIGINAL_FORMAT = (ARGS['original-format'] || 'keep').toLowerCase()
const DERIVED_FORMAT = (ARGS['derived-format'] || 'jpg').toLowerCase()
if (!['keep', 'png', 'jpg'].includes(ORIGINAL_FORMAT)) throw new Error('invalid --original-format')
if (!['png', 'jpg'].includes(DERIVED_FORMAT)) throw new Error('invalid --derived-format')

const LEGACY_DIR = process.env.LEGACY_IMAGES_DIR || null
const LEGACY_BASE_URL = process.env.LEGACY_BASE_URL || 'https://morphobank.org/media/morphobank3/images'

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
})

const TABLES = [
  { table: 'hp_matrix_images', idField: 'image_id', basePrefix: 'media_files/matrix_images' },
  { table: 'press',            idField: 'press_id', basePrefix: 'media_files/press' },
  { table: 'hp_tools',         idField: 'tool_id',  basePrefix: 'media_files/hp_tools' },
]

function contentTypeForExt(ext) {
  return ext === 'png' ? 'image/png' : 'image/jpeg'
}

function extFromPath(p) {
  const m = p?.match(/\.([a-z0-9]+)(?:\?|$)/i)
  return m ? m[1].toLowerCase() : null
}

function legacyUrl(obj) {
  if (!obj?.HASH || !obj?.MAGIC || !obj?.FILENAME) return null
  return `${LEGACY_BASE_URL}/${obj.HASH}/${obj.MAGIC}_${obj.FILENAME}`
}

async function httpGetBuffer(url, redirects = 5) {
  const parsed = new URL(url)
  const isHttps = parsed.protocol === 'https:'
  const mod = isHttps ? https : http

  const options = {
    method: 'GET',
    hostname: parsed.hostname,
    path: parsed.pathname + (parsed.search || ''),
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': `${parsed.protocol}//${parsed.hostname}/`,
      'Connection': 'keep-alive',
    },
  }

  return new Promise((resolve, reject) => {
    const req = mod.request(options, (res) => {
      const { statusCode, headers } = res
      // Follow redirects
      if ([301, 302, 303, 307, 308].includes(statusCode) && headers.location && redirects > 0) {
        const nextUrl = new URL(headers.location, url).toString()
        res.resume() // drain
        httpGetBuffer(nextUrl, redirects - 1).then(resolve).catch(reject)
        return
      }
      if (statusCode !== 200) {
        res.resume() // drain
        reject(new Error(`HTTP ${statusCode} for ${url}`))
        return
      }
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks)))
      res.on('error', reject)
    })
    req.on('error', reject)
    req.end()
  })
}

async function fsGetBuffer(hash, magic, filename) {
  if (!LEGACY_DIR) return null
  const p = path.join(LEGACY_DIR, hash, `${magic}_${filename}`)
  return fs.promises.readFile(p)
}

async function s3GetBuffer(key) {
  const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
  const chunks = []
  for await (const chunk of res.Body) chunks.push(chunk)
  return Buffer.concat(chunks)
}

async function s3PutBuffer(destKey, buf, ext) {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: destKey,
    Body: buf,
    ContentType: contentTypeForExt(ext),
  }))
  console.log(`PUT  s3://${BUCKET}/${destKey}  (${buf.length} bytes)`) 
}

async function ensureSizeBuffer(media, size) {
  // S3 JSON path
  const entry = media?.[size]
  if (entry?.S3_KEY) {
    const buf = await s3GetBuffer(entry.S3_KEY)
    const ext = extFromPath(entry.S3_KEY) || 'jpg'
    return { buf, ext }
  }

  // Legacy object => try local dir, then remote URL
  if (entry?.HASH && entry?.MAGIC && entry?.FILENAME) {
    try {
      const buf = await fsGetBuffer(entry.HASH, entry.MAGIC, entry.FILENAME)
      if (buf) {
        const ext = extFromPath(entry.FILENAME) || 'jpg'
        return { buf, ext }
      }
    } catch {}
    const url = legacyUrl(entry)
    if (url) {
      const buf = await httpGetBuffer(url)
      const ext = extFromPath(url) || 'jpg'
      return { buf, ext }
    }
  }

  // Raw URL string stored as media
  if (typeof media === 'string') {
    const buf = await httpGetBuffer(media)
    const ext = extFromPath(media) || 'jpg'
    return { buf, ext }
  }

  // Legacy under media[size]
  const candidate = media?.[size]
  if (candidate?.HASH && candidate?.FILENAME) {
    try {
      const buf = await fsGetBuffer(candidate.HASH, candidate.MAGIC, candidate.FILENAME)
      if (buf) {
        const ext = extFromPath(candidate.FILENAME) || 'jpg'
        return { buf, ext }
      }
    } catch {}
    const url = legacyUrl(candidate)
    if (url) {
      const buf = await httpGetBuffer(url)
      const ext = extFromPath(url) || 'jpg'
      return { buf, ext }
    }
  }

  return null
}

async function getOriginalBuffer(media) {
  const got = await ensureSizeBuffer(media, 'original')
  if (got) return got
  const large = await ensureSizeBuffer(media, 'large')
  if (large) return large
  const tn = await ensureSizeBuffer(media, 'thumbnail')
  if (tn) return tn
  return null
}

async function generateVariant(buf, size, derivedFormat) {
  const img = sharp(buf)
  const methodName = derivedFormat === 'jpg' ? 'jpeg' : 'png'
  if (size === 'large') {
    return { buf: await img.resize(800, 800, { fit: 'inside', withoutEnlargement: true })[methodName]({ quality: 85 }).toBuffer(), ext: derivedFormat }
  }
  if (size === 'thumbnail') {
    return { buf: await img.resize(120, 120, { fit: 'inside', withoutEnlargement: true })[methodName]({ quality: 85 }).toBuffer(), ext: derivedFormat }
  }
  return { buf, ext: 'jpg' }
}

async function processRow({ table, idField, basePrefix }, row) {
  let media = row.media
  if (!media) return
  if (typeof media === 'string') {
    try { media = JSON.parse(media) } catch { /* raw URL supported */ }
  }

  const id = row[idField]

  // ORIGINAL
  let original = await getOriginalBuffer(media)
  if (!original) {
    console.warn(`[${table} ${id}] No source found for original; skipping`)
    return
  }
  let origExt = original.ext || 'jpg'
  if (ORIGINAL_FORMAT !== 'keep') {
    const img = sharp(original.buf)
    const out = ORIGINAL_FORMAT === 'png' ? await img.png().toBuffer() : await img.jpeg({ quality: 95 }).toBuffer()
    original = { buf: out, ext: ORIGINAL_FORMAT }
    origExt = ORIGINAL_FORMAT
  }

  // LARGE
  let large = await ensureSizeBuffer(media, 'large')
  if (!large) {
    large = await generateVariant(original.buf, 'large', DERIVED_FORMAT)
  } else {
    // normalize ext to chosen derived format if needed
    if (large.ext !== DERIVED_FORMAT) {
      const img = sharp(large.buf)
      const methodName = DERIVED_FORMAT === 'jpg' ? 'jpeg' : 'png'
      const out = await img[methodName]({ quality: 85 }).toBuffer()
      large = { buf: out, ext: DERIVED_FORMAT }
    }
  }

  // THUMBNAIL
  let thumb = await ensureSizeBuffer(media, 'thumbnail')
  if (!thumb) {
    thumb = await generateVariant(original.buf, 'thumbnail', DERIVED_FORMAT)
  } else {
    if (thumb.ext !== DERIVED_FORMAT) {
      const img = sharp(thumb.buf)
      const methodName = DERIVED_FORMAT === 'jpg' ? 'jpeg' : 'png'
      const out = await img[methodName]({ quality: 85 }).toBuffer()
      thumb = { buf: out, ext: DERIVED_FORMAT }
    }
  }

  // Upload to target structure
  const destBase = `${basePrefix}/${id}`
  const keys = {
    original: `${destBase}/${id}_original.${origExt}`,
    large:    `${destBase}/${id}_large.${large.ext}`,
    thumbnail:`${destBase}/${id}_thumbnail.${thumb.ext}`,
  }

  await s3PutBuffer(keys.original, original.buf, origExt)
  await s3PutBuffer(keys.large, large.buf, large.ext)
  await s3PutBuffer(keys.thumbnail, thumb.buf, thumb.ext)
}

async function run() {
  const startMs = Date.now()
  const schema = process.env.DB_SCHEMA || process.env.DB_NAME
  if (!schema) {
    throw new Error('No DB_SCHEMA or DB_NAME provided in environment')
  }
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: schema,
  })

  try {
    for (const spec of TABLES) {
      const [rows] = await conn.execute(`SELECT ${spec.idField}, media FROM ${spec.table}`)
      console.log(`Processing ${spec.table}: ${rows.length} rows`)
      const tableStart = Date.now()
      for (const row of rows) {
        try {
          await processRow(spec, row)
        } catch (e) {
          console.error(`Failed ${spec.table} ${row[spec.idField]}: ${e.message}`)
        }
      }
      const tableMs = Date.now() - tableStart
      console.log(`Finished ${spec.table} in ${(tableMs / 1000).toFixed(2)}s (${tableMs} ms)`) 
    }
  } finally {
    try { await conn.end() } catch {}
    const totalMs = Date.now() - startMs
    console.log(`Migration completed in ${(totalMs / 1000).toFixed(2)}s (${totalMs} ms)`) 
  }
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})


