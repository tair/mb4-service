import { describe, expect, test } from '@jest/globals'

import { PartitionProjectPublisher } from '../../src/lib/partition-project-publisher'
import { UserError } from "../../src/lib/user-errors";
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

        publisher = new PartitionProjectPublisher(models.Matrix, 5, -100)
        tables = await publisher.getAllIdsInTable("matrices")
        expect(tables.length).toBe(0)
    })

    test('Test that all matrix ids are returned, using media_files', async () => {
        let publisher = new PartitionProjectPublisher(models.Matrix, 5, 5)
        let tables = await publisher.getAllIdsInTable("media_files")
        expect(tables.length).toBe(0)

        publisher = new PartitionProjectPublisher(models.Matrix, 355, 5)
        tables = await publisher.getAllIdsInTable("media_files")
        expect(tables.length).toBe(4)

        publisher = new PartitionProjectPublisher(models.Matrix, 355, -5)
        tables = await publisher.getAllIdsInTable("media_files")
        expect(tables.length).toBe(4)

        publisher = new PartitionProjectPublisher(models.Matrix, -355, -5)
        tables = await publisher.getAllIdsInTable("media_files")
        expect(tables.length).toBe(0)
    })

    test('Test that all matrix ids are returned, using default', async () => {
        let publisher = new PartitionProjectPublisher(models.Matrix, 5, 5)
        expect(() => {publisher.getAllIdsInTable("aaa")}).toThrow();
    })
})