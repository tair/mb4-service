/**
 * This class represents the clients that have loaded the matrix editor. This
 * is used to retain the HTTP response to provide Server-side events and the
 * last sync time.
 */
export class MatrixClients {
  constructor() {
    this.matrices = new Map()
  }

  add(matrixId, client) {
    if (!this.matrices.has(matrixId)) {
      this.matrices.set(matrixId, new Map())
    }
    const clients = this.matrices.get(matrixId)
    const clientId = generateClientId(client)
    clients.set(clientId, client)
    return clientId
  }

  getClient(matrixId, clientId) {
    const clients = this.matrices.get(matrixId)
    if (clients == null) {
      return null
    }
    return clients.get(clientId)
  }

  getClients(matrixId) {
    const clients = this.matrices.get(matrixId)
    return clients ? Array.from(clients.values()) : []
  }

  remove(matrixId, clientId) {
    const clients = this.matrices.get(matrixId)
    if (clients == null) {
      return
    }

    if (!clients.has(clientId)) {
      return
    }

    clients.delete(clientId)
    if (clients.size == 0) {
      this.matrices.delete(matrixId)
    }
  }
}

function getRandomInt(max) {
  return Math.floor(Math.random() * max)
}

/**
 * Generates an identifier for the client to distinguish seperate clients
 * regardless of the user.
 * The form of the client is alphanumeric string: xxxx.xxx.xxx
 */
function generateClientId(client) {
  return (
    getRandomInt(0xffff).toString(36) +
    '.' +
    client.creationTime.toString(36) +
    '.' +
    client.userId.toString(36)
  )
}
