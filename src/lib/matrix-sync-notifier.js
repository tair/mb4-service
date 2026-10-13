import * as taxaService from '../services/taxa-service.js'
import { matrixClients } from './matrix-clients.js'

/**
 * Asks every open editor of the given matrices to sync. Used after changes
 * made outside the matrix editor (e.g. the project taxa list), which no
 * editor, including the acting user's, has applied yet. Never throws: a
 * notification failure must not fail the request that made the change.
 */
export function notifyMatrices(matrixIds, user) {
  const userId = user ? user.user_id : 0
  for (const matrixId of new Set(matrixIds.map((id) => parseInt(id)))) {
    try {
      matrixClients.sendSync(matrixId, { userId })
    } catch (e) {
      console.error(`Failed to notify matrix ${matrixId} clients:`, e)
    }
  }
}

/** Notifies the open editors of every matrix that contains any of the taxa. */
export async function notifyMatricesForTaxa(taxonIds, user) {
  try {
    const rows = await taxaService.getMatrixIds(taxonIds)
    notifyMatrices(
      rows.map((row) => row.matrix_id),
      user
    )
  } catch (e) {
    console.error('Failed to look up matrices for changed taxa:', e)
  }
}
