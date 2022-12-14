import MatrixEditorService from '../services/matrix-editor-service.js'
import { MatrixClients } from '../lib/matrix-clients.js'
import { UserError } from '../lib/user-errors.js'
import { time } from '../util/util.js'

const clients = new MatrixClients()

export async function getMatrixData(req, res) {
  await applyMatrix(req, res, (service) => service.getMatrixData())
}

export async function getCellData(req, res) {
  await applyMatrix(req, res, (service) => service.getCellData())
}

export async function fetchCellsData(req, res) {
  const taxaIds = parseIntArray(req.body.taxa_ids)
  const characterIds = parseIntArray(req.body.character_ids)
  await applyMatrix(req, res, (service) =>
    service.fetchCellsData(taxaIds, characterIds)
  )
}

export async function getCellCounts(req, res) {
  const startCharacterNum = parseInt(req.body.start_character_num)
  const endCharacterNum = parseInt(req.body.end_character_num)
  const startTaxonNum = parseInt(req.body.start_taxon_num)
  const endTaxonNum = parseInt(req.body.end_taxon_num)
  await applyMatrix(req, res, (service) =>
    service.getCellCounts(
      startCharacterNum,
      endCharacterNum,
      startTaxonNum,
      endTaxonNum
    )
  )
}

export async function getAllCellNotes(req, res) {
  await applyMatrix(req, res, (service) => service.getAllCellNotes())
}

export async function getCellMedia(req, res) {
  await applyMatrix(req, res, (service) => service.getCellMedia())
}

export async function getAvailableTaxa(req, res) {
  await applyMatrix(req, res, (service) => service.getAvailableTaxa())
}

export async function addTaxaToMatrix(req, res) {
  const taxaIds = parseIntArray(req.body.taxa_ids)
  const afterTaxonId = parseInt(req.body.after_taxon_id)
  const success = await applyMatrix(req, res, (service) =>
    service.addTaxaToMatrix(taxaIds, afterTaxonId)
  )
  if (success) {
    sentSyncEventToClients(req.params.matrixId, req.user)
  }
}

export async function removeTaxaFromMatrix(req, res) {
  const taxaIds = parseIntArray(req.body.taxa_ids)
  const success = await applyMatrix(req, res, (service) =>
    service.removeTaxaFromMatrix(taxaIds)
  )
  if (success) {
    sentSyncEventToClients(req.params.matrixId, req.user)
  }
}

export async function reorderTaxa(req, res) {
  const taxaIds = parseIntArray(req.body.taxa_ids)
  const index = parseInt(req.body.index)
  const success = await applyMatrix(req, res, (service) =>
    service.reorderTaxa(taxaIds, index)
  )
  if (success) {
    sentSyncEventToClients(req.params.matrixId, req.user)
  }
}

export async function setTaxaNotes(req, res) {
  const taxaIds = parseIntArray(req.body.taxa_ids)
  const notes = req.body.notes
  const success = await applyMatrix(req, res, (service) =>
    service.setTaxaNotes(taxaIds, notes)
  )
  if (success) {
    sentSyncEventToClients(req.params.matrixId, req.user)
  }
}

export async function setTaxaAccess(req, res) {
  const taxaIds = parseIntArray(req.body.taxa_ids)
  const userId = parseInt(req.body.user_id) || null
  const groupId = parseInt(req.body.group_id) || null
  const success = await applyMatrix(req, res, (service) =>
    service.setTaxaAccess(taxaIds, userId, groupId)
  )
  if (success) {
    sentSyncEventToClients(req.params.matrixId, req.user)
  }
}

export async function addTaxonMedia(req, res) {
  const taxaIds = parseIntArray(req.body.taxa_ids)
  const mediaIds = parseIntArray(req.body.media_ids)
  const success = await applyMatrix(req, res, (service) =>
    service.addTaxonMedia(taxaIds, mediaIds)
  )
  if (success) {
    sentSyncEventToClients(req.params.matrixId, req.user)
  }
}

export async function removeTaxonMedia(req, res) {
  const linkId = parseInt(req.body.link_id)
  const success = await applyMatrix(req, res, (service) =>
    service.removeTaxonMedia(linkId)
  )
  if (success) {
    sentSyncEventToClients(req.params.matrixId, req.user)
  }
}

export async function loadTaxaMedia(req, res) {
  const taxonId = parseInt(req.body.taxon_id)
  const search = req.body.search
  await applyMatrix(req, res, (service) =>
    service.loadTaxaMedia(taxonId, search)
  )
}

export async function addCharacterRuleAction(req, res) {
  const characterId = parseInt(req.body.character_id)
  const stateId = parseNullableInt(req.body.state_id)
  const actionCharacterIds = parseIntArray(req.body.action_character_ids)
  const actionStateId = parseNullableInt(req.body.action_state_id)
  const action = req.body.action
  const success = await applyMatrix(req, res, (service) =>
    service.addCharacterRuleAction(
      characterId,
      stateId,
      actionCharacterIds,
      actionStateId,
      action
    )
  )
  if (success) {
    sentSyncEventToClients(req.params.matrixId, req.user)
  }
}

export async function removeCharacterRuleAction(req, res) {
  const characterId = parseInt(req.body.character_id)
  const actionId = parseInt(req.body.action_id)
  const success = await applyMatrix(req, res, (service) =>
    service.removeCharacterRuleAction(characterId, actionId)
  )
  if (success) {
    sentSyncEventToClients(req.params.matrixId, req.user)
  }
}

export async function fixAllRuleViolations(req, res) {
  const success = await applyMatrix(req, res, (service) =>
    service.fixAllRuleViolations()
  )
  if (success) {
    sentSyncEventToClients(req.params.matrixId, req.user)
  }
}

export async function fixRuleViolations(req, res) {
  const violations = req.body.violations
  const success = await applyMatrix(req, res, (service) =>
    service.fixRuleViolations(violations)
  )
  if (success) {
    sentSyncEventToClients(req.params.matrixId, req.user)
  }
}

export async function getRuleViolations(req, res) {
  await applyMatrix(req, res, (service) => service.getRuleViolations())
}

export async function setCellStates(req, res) {
  const taxaIds = parseIntArray(req.body.taxa_ids)
  const characterIds = parseIntArray(req.body.character_ids)
  const stateIds = parseIntArray(req.body.state_ids)
  const options = req.body.options
  const success = await applyMatrix(req, res, (service) =>
    service.setCellStates(taxaIds, characterIds, stateIds, options)
  )
  if (success) {
    sentSyncEventToClients(req.params.matrixId, req.user)
  }
}

export async function getCellCitations(req, res) {
  const taxonId = parseInt(req.body.taxon_id)
  const characterId = parseInt(req.body.character_id)
  await applyMatrix(req, res, (service) =>
    service.getCellCitations(taxonId, characterId)
  )
}

export async function findCitation(req, res) {
  const text = req.body.text
  await applyMatrix(req, res, (service) => service.findCitation(text))
}

export async function addCellCitations(req, res) {
  const taxaIds = parseIntArray(req.body.taxon_ids)
  const characterIds = parseIntArray(req.body.character_ids)
  const citationId = parseInt(req.body.citation_id)
  const pp = req.body.pp
  const notes = req.body.notes
  const batchmode = req.body.batchmode
  const success = await applyMatrix(req, res, (service) =>
    service.addCellCitations(
      taxaIds,
      characterIds,
      citationId,
      pp,
      notes,
      batchmode
    )
  )
  if (success) {
    sentSyncEventToClients(req.params.matrixId, req.user)
  }
}

export async function upsertCellCitation(req, res) {
  const linkId = parseNullableInt(req.body.link_id)
  const taxonId = parseInt(req.body.taxon_id)
  const characterId = parseInt(req.body.character_id)
  const citationId = parseInt(req.body.citation_id)
  const pp = req.body.pp
  const notes = req.body.notes
  const success = await applyMatrix(req, res, (service) =>
    service.upsertCellCitation(
      linkId,
      taxonId,
      characterId,
      citationId,
      pp,
      notes
    )
  )
  if (success) {
    sentSyncEventToClients(req.params.matrixId, req.user)
  }
}

export async function removeCellCitation(req, res) {
  const linkId = parseInt(req.body.link_id)
  await applyMatrix(req, res, (service) => service.removeCellCitation(linkId))
}

export async function setCellNotes(req, res) {
  const taxaIds = parseIntArray(req.body.taxa_ids)
  const characterIds = parseIntArray(req.body.character_ids)
  const notes = req.body.notes
  const status = parseNullableInt(req.body.status)
  const options = req.body.options
  const success = await applyMatrix(req, res, (service) =>
    service.setCellNotes(taxaIds, characterIds, notes, status, options)
  )
  if (success) {
    sentSyncEventToClients(req.params.matrixId, req.user)
  }
}

export async function addCellMedia(req, res) {
  const taxonId = parseInt(req.body.taxon_id)
  const characterIds = parseIntArray(req.body.character_ids)
  const mediaIds = parseIntArray(req.body.media_ids)
  const batchMode = parseInt(req.body.batchmode)
  const success = await applyMatrix(req, res, (service) =>
    service.addCellMedia(taxonId, characterIds, mediaIds, batchMode)
  )
  if (success) {
    sentSyncEventToClients(req.params.matrixId, req.user)
  }
}

export async function removeCellMedia(req, res) {
  const taxonId = parseInt(req.body.taxon_id)
  const characterId = parseInt(req.body.character_id)
  const linkId = parseInt(req.body.link_id)
  const shouldTransferCitations = parseInt(req.body.should_transfer_citations)
  const success = await applyMatrix(req, res, (service) =>
    service.removeCellMedia(
      taxonId,
      characterId,
      linkId,
      shouldTransferCitations
    )
  )
  if (success) {
    sentSyncEventToClients(req.params.matrixId, req.user)
  }
}

export async function addPartition(req, res) {
  const name = req.body.name
  const description = req.body.description
  const success = await applyMatrix(req, res, (service) =>
    service.addPartition(name, description)
  )
  if (success) {
    sentSyncEventToClients(req.params.matrixId, req.user)
  }
}

export async function editPartition(req, res) {
  const partitionId = parseInt(req.body.partition_id)
  const name = req.body.name
  const description = req.body.description
  const success = await applyMatrix(req, res, (service) =>
    service.editPartition(partitionId, name, description)
  )
  if (success) {
    sentSyncEventToClients(req.params.matrixId, req.user)
  }
}

export async function copyPartition(req, res) {
  const partitionId = parseInt(req.body.partition_id)
  const name = req.body.name
  const description = req.body.description
  const success = await applyMatrix(req, res, (service) =>
    service.copyPartition(partitionId, name, description)
  )
  if (success) {
    sentSyncEventToClients(req.params.matrixId, req.user)
  }
}

export async function removePartition(req, res) {
  const partitionId = parseInt(req.body.partition_id)
  const success = await applyMatrix(req, res, (service) =>
    service.removePartition(partitionId)
  )
  if (success) {
    sentSyncEventToClients(req.params.matrixId, req.user)
  }
}

export async function addCharactersToPartition(req, res) {
  const partitionId = parseInt(req.body.partition_id)
  const characterIds = parseIntArray(req.body.character_ids)
  const success = await applyMatrix(req, res, (service) =>
    service.addCharactersToPartition(partitionId, characterIds)
  )
  if (success) {
    sentSyncEventToClients(req.params.matrixId, req.user)
  }
}

export async function removeCharactersFromPartition(req, res) {
  const partitionId = parseInt(req.body.partition_id)
  const characterIds = parseIntArray(req.body.character_ids)
  const success = await applyMatrix(req, res, (service) =>
    service.removeCharactersFromPartition(partitionId, characterIds)
  )
  if (success) {
    sentSyncEventToClients(req.params.matrixId, req.user)
  }
}

export async function addTaxaToPartition(req, res) {
  const partitionId = parseInt(req.body.partition_id)
  const taxaIds = parseIntArray(req.body.taxa_ids)
  const success = await applyMatrix(req, res, (service) =>
    service.addTaxaToPartition(partitionId, taxaIds)
  )
  if (success) {
    sentSyncEventToClients(req.params.matrixId, req.user)
  }
}

export async function removeTaxaFromPartition(req, res) {
  const partitionId = parseInt(req.body.partition_id)
  const taxaIds = parseIntArray(req.body.taxa_ids)
  const success = await applyMatrix(req, res, (service) =>
    service.removeTaxaFromPartition(partitionId, taxaIds)
  )
  if (success) {
    sentSyncEventToClients(req.params.matrixId, req.user)
  }
}

export async function searchCells(req, res) {
  const partitionId = parseInt(req.body.partition_id)
  const taxonId = parseInt(req.body.taxon_id)
  const limitToUnscoredCells = req.body.limitToUnscoredCells
  const limitToScoredCells = req.body.limitToScoredCells
  const limitToUndocumentedCells = req.body.limitToUndocumentedCells
  const limitToNPACells = req.body.limitToNPACells
  const limitToPolymorphicCells = req.body.limitToPolymorphicCells
  const limitToUnimagedCells = req.body.limitToUnimagedCells
  await applyMatrix(req, res, (service) =>
    service.searchCells(
      partitionId,
      taxonId,
      limitToUnscoredCells,
      limitToScoredCells,
      limitToUndocumentedCells,
      limitToNPACells,
      limitToPolymorphicCells,
      limitToUnimagedCells
    )
  )
}

export async function searchCharacters(req, res) {
  const partitionId = parseInt(req.body.partition_id)
  const limitToUnscoredCells = req.body.limitToUnscoredCells
  const limitToUnusedMedia = req.body.limitToUnusedMedia
  const limitToNPACells = req.body.limitToNPACells
  await applyMatrix(req, res, (service) =>
    service.searchCharacters(
      partitionId,
      limitToUnscoredCells,
      limitToUnusedMedia,
      limitToNPACells
    )
  )
}

export async function searchTaxa(req, res) {
  const partitionId = parseInt(req.body.partition_id)
  const limitToUnscoredCells = req.body.limitToUnscoredCells
  const limitToNPACells = req.body.limitToNPACells
  await applyMatrix(req, res, (service) =>
    service.searchTaxa(partitionId, limitToUnscoredCells, limitToNPACells)
  )
}

export async function sync(req, res) {
  const userId = parseInt(req.params.userId)
  if (!userId) {
    res.status(401).json({ ok: false, errors: ['User invalid'] })
    return
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('Cache-Control', 'no-cache')

  const matrixId = parseInt(req.params.matrixId)
  const client = {
    userId,
    response: res,
    creationTime: time(),
    lastSyncTime: time(),
  }

  const clientId = clients.add(matrixId, client)
  const data = { client_id: clientId }
  res.write(`event: init\ndata: ${JSON.stringify(data)}\n\n`)
  req.on('close', () => {
    clients.remove(matrixId, clientId)
  })
}

export async function sendEvent(req, res) {
  const matrixId = parseInt(req.params.matrixId)
  const clientId = req.body.client_id
  const userId = req.user ? req.user.userId : 0
  const client = clients.getClient(matrixId, clientId)
  if (client == null || client.userId != userId) {
    res.status(401).json({ ok: false, errors: ['User invalid'] })
    return
  }

  const event = req.body.event
  switch (event.type) {
    case 'EDIT_CELL': {
      if (event.enable) {
        client.editingCell = {
          characterId: event.character_id,
          taxonId: event.taxon_id,
        }
      } else {
        delete client.editingCell
      }

      const peerClients = clients.getClients(parseInt(matrixId))
      const editingCells = []
      for (const peerClient of peerClients) {
        if (peerClient.editingCell) {
          editingCells.push({
            character_id: peerClient.editingCell.characterId,
            taxon_id: peerClient.editingCell.taxonId,
            user_id: peerClient.userId,
          })
        }
      }
      const data = { cells: editingCells }
      const response = `event: cell\ndata: ${JSON.stringify(data)}\n\n`
      peerClients
        .filter((peerClient) => peerClient != client)
        .forEach((peerClient) => peerClient.response.write(response))
      break
    }
    default:
      res.status(500).json({ ok: false, errors: ['Invalid type'] })
      return
  }
}

export async function fetchChanges(req, res) {
  const matrixId = parseInt(req.params.matrixId)
  const clientId = req.body.client_id
  const userId = req.user ? req.user.userId : 0
  const client = clients.getClient(matrixId, clientId)
  if (client == null || client.userId != userId) {
    res.status(401).json({ ok: false, errors: ['User invalid'] })
    return
  }

  await applyMatrix(req, res, (service) => {
    const syncTime = time()
    const result = service.fetchChanges(client.lastSyncTime)
    client.lastSyncTime = syncTime
    return result
  })
}

function sentSyncEventToClients(matrixId, user) {
  const userId = user ? user.userId : 0
  const data = { user_id: userId }
  const response = `event: sync\ndata: ${JSON.stringify(data)}\n\n`
  clients
    .getClients(parseInt(matrixId))
    .filter((client) => client.userId != userId)
    .forEach((client) => client.response.write(response))
}

export async function logError(req) {
  console.log('JS error: ', req.body)
}

export async function applyMatrix(req, res, func) {
  const projectId = parseInt(req.params.projectId)
  const matrixId = parseInt(req.params.matrixId)
  const userId = req.user ? req.user.userId : 0
  const readonly = req.body.ro

  try {
    const service = await MatrixEditorService.create(
      projectId,
      matrixId,
      userId,
      readonly
    )
    const data = await func(service)
    data.ok = true
    res.status(200).json(data)
    return true
  } catch (e) {
    console.log('Error', e)
    if (e instanceof UserError) {
      res.status(e.getStatus()).json({ ok: false, errors: [e.message] })
    } else {
      res.status(500).json({ ok: false, errors: ['Unknown error'] })
    }
    return false
  }
}

function parseIntArray(array) {
  if (Array.isArray(array)) {
    const ints = array.filter((i) => i != null).map((i) => parseInt(i))
    return Array.from(new Set(ints))
  }
  return []
}

function parseNullableInt(value) {
  return value == null ? null : parseInt(value)
}
