import { describe, expect, test } from '@jest/globals'

import { PartitionProjectPublisher } from '../../src/lib/partition-project-publisher'
//import { PartitionPublishHandler } from '../../src/lib/task-handlers/partition-publish-handler'
import { models } from '../../src/models/init-models.js'
import sequelizeConn from '../../src/util/db.js'


describe('PartitionProjectPublisherTests', () => {
    test('Test that all matrix ids are returned, using matrices', async () => {
        let publisher = new PartitionProjectPublisher(models.Matrix, 0, 0)
        let tables = await publisher.getAllIdsInTable("matrices")
        expect(tables.length).toBe(0)

        publisher = new PartitionProjectPublisher(models.Matrix, 5, 5)
        tables = await publisher.getAllIdsInTable("matrices")
        expect(tables.length).toBe(4)

        publisher = new PartitionProjectPublisher(models.Matrix, 100, 100)
        tables = await publisher.getAllIdsInTable("matrices")
        expect(tables.length).toBe(1)
    })
})