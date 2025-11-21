#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import Sequelize from 'sequelize'

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v = true] = a.replace(/^--/, '').split('=')
  return [k, v]
}))

if (!args['project-id'] || !args['source-env'] || !args['target-env']) {
  console.error('Usage: node diagnose-fk-violations.js --project-id=123 --source-env=.env.source --target-env=.env.target')
  process.exit(1)
}

const projectId = parseInt(args['project-id'], 10)

function loadDbFromEnv(envPath) {
  const env = dotenv.parse(fs.readFileSync(path.resolve(envPath)))
  return new Sequelize(env.DB_SCHEMA, env.DB_USER, env.DB_PASSWORD, {
    host: env.DB_HOST,
    dialect: 'mysql',
    logging: false,
  })
}

const sourceDb = loadDbFromEnv(args['source-env'])
const targetDb = loadDbFromEnv(args['target-env'])

async function fetchParentSets(db, pid) {
  const matrices = await db.query(
    'SELECT matrix_id FROM matrices WHERE project_id = :pid',
    { replacements: { pid }, type: Sequelize.QueryTypes.SELECT }
  )
  const characters = await db.query(
    'SELECT character_id FROM characters WHERE project_id = :pid',
    { replacements: { pid }, type: Sequelize.QueryTypes.SELECT }
  )
  const taxa = await db.query(
    'SELECT taxon_id FROM taxa WHERE project_id = :pid',
    { replacements: { pid }, type: Sequelize.QueryTypes.SELECT }
  )
  return {
    matrices: new Set(matrices.map(r => r.matrix_id)),
    characters: new Set(characters.map(r => r.character_id)),
    taxa: new Set(taxa.map(r => r.taxon_id)),
  }
}

async function getSourceCellNotes(pid) {
  return await sourceDb.query(
    `SELECT cn.note_id, cn.matrix_id, cn.character_id, cn.taxon_id
     FROM cell_notes cn
     JOIN matrices m ON m.matrix_id = cn.matrix_id
     WHERE m.project_id = :pid`,
    { replacements: { pid }, type: Sequelize.QueryTypes.SELECT }
  )
}

function diffRows(rows, targetSets) {
  const missingMatrix = []
  const missingCharacter = []
  const missingTaxon = []
  for (const r of rows) {
    if (!targetSets.matrices.has(r.matrix_id)) missingMatrix.push(r)
    if (!targetSets.characters.has(r.character_id)) missingCharacter.push(r)
    if (!targetSets.taxa.has(r.taxon_id)) missingTaxon.push(r)
  }
  return { missingMatrix, missingCharacter, missingTaxon }
}

function printSample(label, arr) {
  if (!arr.length) return
  const sample = arr.slice(0, 20)
  console.log(`  sample ${label} (${sample.length}/${arr.length} shown):`)
  sample.forEach(r => console.log(`    note_id=${r.note_id} m=${r.matrix_id} c=${r.character_id} t=${r.taxon_id}`))
}

async function main() {
  console.log(`Diagnosing FK issues for project ${projectId}`)

  const targetSets = await fetchParentSets(targetDb, projectId)
  console.log(`Target parents: matrices=${targetSets.matrices.size}, characters=${targetSets.characters.size}, taxa=${targetSets.taxa.size}`)

  const rows = await getSourceCellNotes(projectId)
  console.log(`Source cell_notes rows within project: ${rows.length}`)

  const { missingMatrix, missingCharacter, missingTaxon } = diffRows(rows, targetSets)

  console.log('Missing parents for cell_notes:')
  console.log(`  matrix_id missing: ${missingMatrix.length}`)
  console.log(`  character_id missing: ${missingCharacter.length}`)
  console.log(`  taxon_id missing: ${missingTaxon.length}`)

  printSample('matrix_id', missingMatrix)
  printSample('character_id', missingCharacter)
  printSample('taxon_id', missingTaxon)

  // Fetch and print details for missing parents from SOURCE for easier triage
  const uniq = (arr) => Array.from(new Set(arr))
  if (missingMatrix.length) {
    const ids = uniq(missingMatrix.map(r => r.matrix_id))
    const rows = await sourceDb.query(
      `SELECT matrix_id, title FROM matrices WHERE matrix_id IN (:ids)`,
      { replacements: { ids }, type: Sequelize.QueryTypes.SELECT }
    )
    console.log(`\nMissing matrices details (up to 20):`)
    rows.slice(0, 20).forEach(r => console.log(`  matrix_id=${r.matrix_id} title="${r.title}"`))
  }
  if (missingCharacter.length) {
    const ids = uniq(missingCharacter.map(r => r.character_id))
    const rows = await sourceDb.query(
      `SELECT character_id, name FROM characters WHERE character_id IN (:ids)`,
      { replacements: { ids }, type: Sequelize.QueryTypes.SELECT }
    )
    console.log(`\nMissing characters details (up to 20):`)
    rows.slice(0, 20).forEach(r => console.log(`  character_id=${r.character_id} name="${r.name}"`))
  }
  if (missingTaxon.length) {
    const ids = uniq(missingTaxon.map(r => r.taxon_id))
    const rows = await sourceDb.query(
      `SELECT taxon_id, name FROM taxa WHERE taxon_id IN (:ids)`,
      { replacements: { ids }, type: Sequelize.QueryTypes.SELECT }
    )
    console.log(`\nMissing taxa details (up to 20):`)
    rows.slice(0, 20).forEach(r => console.log(`  taxon_id=${r.taxon_id} name="${r.name}"`))
  }
}

main()
  .then(async () => { try { await sourceDb.close() } catch {} try { await targetDb.close() } catch {} })
  .catch(async (e) => { console.error(e); try { await sourceDb.close() } catch {} try { await targetDb.close() } catch {} process.exit(1) })
