import sequelizeConn from '../util/db.js'
import { Op } from 'sequelize'
import * as specimenService from '../services/specimen-service.js'
import { models } from '../models/init-models.js'
import {
  ModelRefencialMapper,
  ModelReferencialConfig,
} from '../lib/datamodel/model-referencial-mapper.js'
import { array_difference, set_intersect } from '../util/util.js'
import { Multimap } from '../util/multimap.js'

export async function getSpecimens(req, res) {
  const projectId = req.params.projectId
  const [specimens] = await Promise.all([
    specimenService.getProjectSpecimens(projectId),
  ])
  res.status(200).json({ specimens })
}

export async function createSpecimen(req, res) {
  res.status(200).json({ message: 'Not yet implemented' })
}

export async function createSpecimens(req, res) {
  res.status(200).json({ message: 'Not yet implemented' })
}

export async function deleteSpecimens(req, res) {
  res.status(200).json({ message: 'Not yet implemented' })
}

export async function getUsage(req, res) {
  res.status(200).json({ message: 'Not yet implemented' })
}

export async function search(req, res) {
  res.status(200).json({ message: 'Not yet implemented' })
}

export async function editSpecimen(req, res) {
  res.status(200).json({ message: 'Not yet implemented' })
}
