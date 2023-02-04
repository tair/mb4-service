import * as taxaService from '../services/taxa-service.js'

export async function getTaxa(req, res) {
  const projectId = req.params.projectId
  const taxa = await taxaService.getTaxaInProject(projectId)
  const data = {
    taxa: taxa,
  }
  res.status(200).json(data)
}
