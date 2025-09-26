import fs from 'fs'
import path from 'path'
import xlsx from 'xlsx'
import { parse as parseCsv } from 'csv-parse/sync'

/**
 * Parse an uploaded CSV or XLSX file into the matrix object shape expected by importMatrix.
 * @param {Object} file - Multer file object (with .path, .originalname, .mimetype)
 * @param {Object} [options]
 * @param {('discrete'|'continuous')} [options.mode] - Force parsing mode; otherwise auto-detect
 * @returns {{ matrixObj: Object, warnings: string[] }}
 */
export function parseCsvXlsxToMatrix(file, options = {}) {
  if (!file || !file.path) {
    throw new Error('No file to parse')
  }

  const ext = path.extname(file.originalname || '').toLowerCase()
  const rows = readRowsFromFile(file.path, ext)
  if (!rows || rows.length === 0) {
    throw new Error('No data found in file')
  }

  // Normalize rows: ensure each row is an array of strings
  const normalized = rows
    .map((r) => (Array.isArray(r) ? r : [r]))
    .map((r) => r.map((v) => (v == null ? '' : String(v).trim())))

  const header = normalized[0]
  if (!header || header.length < 2) {
    throw new Error('At least one character column is required')
  }

  const body = normalized.slice(1)
  if (body.length === 0) {
    throw new Error('No data rows found')
  }

  const mode = options.mode || detectMode(normalized)
  const warnings = []

  if (mode === 'discrete') {
    const { matrixObj, warn } = buildDiscreteMatrix(normalized)
    return { matrixObj, warnings: warn }
  } else if (mode === 'continuous') {
    const { matrixObj, warn } = buildContinuousMatrix(normalized)
    return { matrixObj, warnings: warn }
  }

  throw new Error(
    'Unable to detect matrix type (discrete or continuous). Provide a mode override.'
  )
}

function readRowsFromFile(filePath, ext) {
  if (ext === '.xlsx' || ext === '.xls') {
    const wb = xlsx.readFile(filePath)
    const firstSheetName = wb.SheetNames[0]
    const ws = wb.Sheets[firstSheetName]
    // sheet_to_json with header:1 returns array of arrays
    return xlsx.utils.sheet_to_json(ws, { header: 1, blankrows: false })
  }

  // default CSV
  const content = fs.readFileSync(filePath, 'utf8')
  const records = parseCsv(content, {
    skip_empty_lines: true,
    relax_column_count: true,
  })
  return records
}

// Auto-detect data type per README
function detectMode(rows) {
  // Heuristic:
  // - If row 2 (index 1) has state definitions (multiple tokens with ';' or spaced tokens) in most columns => discrete
  // - Else if data rows look numeric (allow ranges) => continuous
  if (rows.length >= 2) {
    const second = rows[1]
    let discreteHints = 0
    for (let c = 1; c < second.length; c++) {
      const v = (second[c] ?? '').toString().trim()
      if (looksLikeStateDefinition(v)) {
        discreteHints++
      }
    }
    if (discreteHints > 0) {
      return 'discrete'
    }
  }

  // Check numeric-ness of first data row
  const firstData = rows[1]
  if (firstData) {
    let numericOrMissing = 0
    let valueCols = 0
    for (let c = 1; c < firstData.length; c++) {
      const v = (firstData[c] ?? '').toString().trim()
      // Treat '-', '?', and 'NA' as missing/inapplicable when detecting mode
      if (v === '' || v === '?' || v === '-' || equalsIgnoreCase(v, 'NA')) {
        numericOrMissing++
        valueCols++
        continue
      }
      if (looksNumericOrRange(v)) {
        numericOrMissing++
      }
      valueCols++
    }
    if (valueCols > 0 && numericOrMissing === valueCols) {
      return 'continuous'
    }
  }

  return null
}

function looksLikeStateDefinition(text) {
  if (!text) return false
  // split by ';' primarily; also consider space-delimited multi-states
  const cleaned = text.replace(/^\(\d+\)|^\d+\:|^\(\d+\)\:/g, '').trim()
  if (cleaned.includes(';')) return true
  // multiple tokens separated by spaces (e.g., "Absent Present")
  const parts = cleaned.split(/[\s;]+/).filter((p) => p.length > 0)
  return parts.length > 1
}

function looksNumericOrRange(text) {
  // Examples: 1, 1.2, -0.5, 1.2-2.5, 1;2 (we allow semicolon ranges too)
  // Accept comma/semicolon/range dash separators
  const pieces = text
    .split(/[,;\-–]/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
  if (pieces.length === 0) return false
  return pieces.every((p) => !isNaN(parseFloat(p)))
}

function equalsIgnoreCase(a, b) {
  return String(a).toLowerCase() === String(b).toLowerCase()
}

function buildDiscreteMatrix(rows) {
  const header = rows[0]
  const statesRow = rows[1]
  if (!statesRow || statesRow.length < 2) {
    throw new Error(
      'Discrete matrix requires a state definitions row as the second row'
    )
  }

  // Characters: header from column 2 onwards
  const characterNames = header.slice(1)

  // Build per-character states array
  const characterStates = characterNames.map((_, idx) =>
    parseStates(statesRow[1 + idx])
  )

  // Build SYMBOLS string sufficient for the max number of states across characters
  const maxStates = characterStates.reduce((m, s) => Math.max(m, s.length), 0)
  const SYMBOLS = buildSymbols(maxStates)

  // Characters array
  const characters = characterNames.map((name, idx) => ({
    name: name || `Character ${idx + 1}`,
    type: 0,
    states: characterStates[idx].map((label) => ({ name: label })),
  }))

  // Taxa rows start from row index 2 (third row)
  const taxa = []
  const cells = []
  const warnings = []

  for (let r = 2; r < rows.length; r++) {
    const row = rows[r]
    if (!row || row.length === 0) continue
    const taxonName = (row[0] ?? '').toString().trim()
    if (!taxonName) continue
    taxa.push({ name: taxonName })

    const rowCells = []
    for (let c = 1; c < header.length; c++) {
      const raw = (row[c] ?? '').toString().trim()
      if (raw === '') {
        rowCells.push('?')
        continue
      }
      if (equalsIgnoreCase(raw, 'NA')) {
        rowCells.push('-')
        continue
      }

      // Map value to state symbol index for this character
      const states = characterStates[c - 1]
      const mapping = buildStateLabelToSymbolMap(states, SYMBOLS)

      // polymorphic e.g., "0&1" or "Red&Blue"
      if (raw.includes('&')) {
        const parts = raw
          .split('&')
          .map((p) => p.trim())
          .filter((p) => p.length > 0)
        const symbolCodes = parts
          .map((p) => mapToSymbolCode(p, states, mapping))
          .join('')
        rowCells.push({ scores: symbolCodes, uncertain: true })
        continue
      }

      // single value: could be numeric index or label
      const symbolCode = mapToSymbolCode(raw, states, mapping)
      rowCells.push(symbolCode)
    }
    cells.push(rowCells)
  }

  const matrixObj = {
    format: 'NEXUS',
    dataType: 0,
    taxa,
    characters,
    cells,
    parameters: {
      MISSING: '?',
      GAP: '-',
      SYMBOLS,
    },
    blocks: [],
  }

  return { matrixObj, warn: warnings }
}

function buildContinuousMatrix(rows) {
  const header = rows[0]
  const characterNames = header.slice(1)
  const characters = characterNames.map((name, idx) => ({
    name: name || `Character ${idx + 1}`,
    type: 1,
  }))

  const taxa = []
  const cells = []
  const warnings = []

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    if (!row || row.length === 0) continue
    const taxonName = (row[0] ?? '').toString().trim()
    if (!taxonName) continue
    taxa.push({ name: taxonName })

    const rowCells = []
    for (let c = 1; c < header.length; c++) {
      const raw = (row[c] ?? '').toString().trim()
      if (raw === '' || raw === '?') {
        rowCells.push('?')
        continue
      }
      // Accept '-' as inapplicable for continuous data
      if (raw === '-') {
        rowCells.push('-')
        continue
      }
      if (equalsIgnoreCase(raw, 'NA')) {
        rowCells.push('-')
        continue
      }
      if (!looksNumericOrRange(raw)) {
        warnings.push(
          `Non-numeric value "${raw}" treated as missing at row ${r + 1}, col ${
            c + 1
          }`
        )
        rowCells.push('?')
        continue
      }
      // Keep as-is; importer will parse into start/end values
      rowCells.push(raw)
    }
    cells.push(rowCells)
  }

  const matrixObj = {
    format: 'TNT',
    dataType: 1,
    taxa,
    characters,
    cells,
    parameters: {},
    blocks: [],
  }

  return { matrixObj, warn: warnings }
}

function parseStates(cell) {
  const text = (cell ?? '').toString().trim()
  if (!text) return []
  // Strip leading numbering formats like "0:", "(1)" etc., then split
  const cleaned = text
    .replace(/\(\d+\)\s*:?/g, '')
    .replace(/\b\d+\s*:\s*/g, '')
    .trim()
  // Prefer ';' but also split on whitespace when not present
  const parts = (
    cleaned.includes(';') ? cleaned.split(';') : cleaned.split(/\s+/)
  )
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
  return parts
}

function buildSymbols(maxStates) {
  const digits = '0123456789'
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const pool = digits + letters
  if (maxStates <= pool.length) {
    return pool.slice(0, maxStates)
  }
  // If more than 36 states, extend with lowercase letters
  const extra = 'abcdefghijklmnopqrstuvwxyz'
  const total = pool + extra
  return total.slice(0, maxStates)
}

function buildStateLabelToSymbolMap(states, SYMBOLS) {
  const map = new Map()
  for (let i = 0; i < states.length; i++) {
    map.set(states[i].toUpperCase(), SYMBOLS[i])
  }
  return map
}

function mapToSymbolCode(value, states, labelToSymbolMap) {
  const v = value.toString().trim()
  // If numeric index provided
  if (/^\d+$/.test(v)) {
    const idx = parseInt(v, 10)
    if (idx >= 0 && idx < states.length) {
      // numeric indices map to SYMBOLS position
      const upperMap = labelToSymbolMap
      let count = 0
      for (const symbol of upperMap.values()) {
        if (count === idx) return symbol
        count++
      }
    }
  }

  // Try label match (case-insensitive)
  const symbol = labelToSymbolMap.get(v.toUpperCase())
  if (symbol) return symbol

  // Fallback: use first state if unknown
  return labelToSymbolMap.values().next().value
}
