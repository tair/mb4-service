import { describe, expect, test } from '@jest/globals'

import { PartitionModelDuplicator } from 'lib/partition-model-duplicator'
import { models } from 'models/init-models.js'

describe('PartitionModelDuplicatorTests', () => {
  test('Test that the SQL query for taxa is valid', async () => {
    let publisher = new PartitionModelDuplicator(models.Project, 12, 12)
    const sql = await publisher.generateSQLStatementForTable(models.Taxon)

    const expectedSQL = `
      SELECT taxa.*
      FROM taxa
      INNER JOIN taxa_x_partitions USING (taxon_id)
      WHERE
      taxa_x_partitions.partition_id = 12 AND
      taxa.project_id = ?`
    expect(trim(sql)).toEqual(trim(expectedSQL))
  })
})

function trim(sql) {
  return sql.replace(/\s+/g, ' ').trim()
}
