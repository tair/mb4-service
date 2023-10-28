import { describe, expect, test } from '@jest/globals'

import { BaseModelScanner } from '../../lib/base-model-scanner'
import { models } from '../../models/init-models.js'

describe('BaseModelScannerTests', () => {
  test('Test that correct tables are returned', () => {
    const baseModelScanner = new BaseModelScanner(models.Matrix, 0)
    baseModelScanner.setDuplicatedTables([
      models.Matrix,
      models.MatrixAdditionalBlock,
      models.MatrixCharacterOrder,
      models.MatrixTaxaOrder,
      models.MatrixFileUpload,
      models.Cell,
      models.CellNote,
      models.CellsXBibliographicReference,
      models.CellsXMedium,
    ])
    baseModelScanner.setIgnoredTables([
      models.Project,
      models.Character,
      models.CharacterOrdering,
      models.CharacterState,
      models.Taxon,
      models.BibliographicReference,
      models.MediaFile,
      models.CipresRequest,
    ])

    const tables = baseModelScanner.getTopologicalDependentTables()

    expect(tables).toEqual(
      expect.arrayContaining([
        models.Matrix,
        models.MatrixAdditionalBlock,
        models.MatrixCharacterOrder,
        models.MatrixTaxaOrder,
        models.MatrixFileUpload,
        models.Cell,
        models.CellNote,
        models.CellsXBibliographicReference,
        models.CellsXMedium,
      ])
    )
  })

  test('Test that tables are in the correct order', () => {
    const baseModelScanner = new BaseModelScanner(models.Character, 0)
    baseModelScanner.setDuplicatedTables([
      models.Character,
      models.CharacterRuleAction,
      models.CharacterOrdering,
      models.CharacterRule,
      models.CharacterState,
    ])
    baseModelScanner.setIgnoredTables([
      models.Project,
      models.Matrix,
      models.Cell,
      models.CellNote,
      models.CellsXBibliographicReference,
      models.CellsXMedium,
      models.MatrixCharacterOrder,
      models.CharactersXBibliographicReference,
      models.CharactersXMedium,
      models.CharactersXPartition,
    ])

    const tables = baseModelScanner.getTopologicalDependentTables()

    expect(tables.length).toBe(4)
    expect(tables).toEqual([
      models.Character,
      models.CharacterState,
      models.CharacterRule,
      models.CharacterRuleAction,
    ])
  })

  test('Test that generate SQL statement', () => {
    const scanner = new BaseModelScanner(models.Character, 0)

    const sql = scanner.generateSQLStatementForTable(models.CharacterRuleAction)

    const expectedSQL = `
      SELECT character_rule_actions.*
      FROM character_rule_actions
      INNER JOIN characters
        ON characters.character_id = character_rule_actions.character_id
      WHERE characters.character_id = ?`
    expect(sql).toEqual(expectedSQL.replace(/\s+/g, ' ').trim())
  })

  test('Test that generate SQL statement multiple JOINS', () => {
    const scanner = new BaseModelScanner(models.Project, 0)

    const sql = scanner.generateSQLStatementForTable(models.MatrixFileUpload)

    const expectedSQL = `
      SELECT matrix_file_uploads.*
      FROM matrix_file_uploads
      INNER JOIN matrices 
        ON matrices.matrix_id = matrix_file_uploads.matrix_id
      INNER JOIN projects
        ON projects.project_id = matrices.project_id
      WHERE projects.project_id = ?`
    expect(sql).toEqual(expectedSQL.replace(/\s+/g, ' ').trim())
  })
})
