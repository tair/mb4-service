import { describe, expect, test } from '@jest/globals'

import { Datamodel } from 'lib/datamodel/datamodel'
import { TABLE_NUMBERS } from 'lib/table-number.js'
import { models } from 'models/init-models.js'

describe('DatamodelTests', () => {
  test('Test getTableNames contains tables', () => {
    const datamodel = Datamodel.getInstance()

    const tableNames = datamodel.getTableNames()
    expect(tableNames).toContain('projects')
    expect(tableNames).toContain('characters')
  })

  test('Test tableExists contains table', () => {
    const datamodel = Datamodel.getInstance()

    expect(datamodel.tableExists(models.TaxaXMedium)).toStrictEqual(true)
    expect(datamodel.tableExists(models.Folio)).toStrictEqual(true)
  })

  test('Test getPrimaryKey', () => {
    const datamodel = Datamodel.getInstance()

    expect(datamodel.getPrimaryKey(models.Cell)).toStrictEqual(['cell_id'])
    expect(datamodel.getPrimaryKey(models.Taxon)).toStrictEqual(['taxon_id'])
  })

  test('Test getTableByName', () => {
    const datamodel = Datamodel.getInstance()

    expect(datamodel.getTableByName('partitions')).toBe(models.Partition)
    expect(datamodel.getTableByName('media_views')).toBe(models.MediaView)
  })

  test('Test getTableByNumber', () => {
    const datamodel = Datamodel.getInstance()

    expect(datamodel.getTableByNumber(TABLE_NUMBERS.media_files)).toBe(
      models.MediaFile
    )
    expect(datamodel.getTableByNumber(TABLE_NUMBERS.folios)).toBe(models.Folio)
  })

  test('Test getNeighboringTables', () => {
    const datamodel = Datamodel.getInstance()

    expect(datamodel.getNeighboringTables(models.Specimen)).toEqual([
      models.Project,
    ])
  })

  test('Test getReferencingTables', () => {
    const datamodel = Datamodel.getInstance()

    expect(datamodel.getReferencingTables(models.Specimen)).toEqual([
      models.MediaFile,
      models.SpecimensXBibliographicReference,
      models.TaxaXSpecimen,
    ])
  })

  test('Test getPath', () => {
    const datamodel = Datamodel.getInstance()

    const path = datamodel.getPath(models.CharacterRule, models.Project)
    expect(path.length).toBe(3)
    expect(path).toEqual([
      models.CharacterRule,
      models.Character,
      models.Project,
    ])
  })
})
