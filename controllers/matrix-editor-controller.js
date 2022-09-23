// TODO(alvaro): Implement this
function getMatrixData(req, res) {
  const projectId = req.params.projectId
  const matrixId = req.params.matrixId
  try {
    const data = {
      projectId: projectId,
      matrixId: matrixId,
    }
    res.status(200).json(data)
  } catch (e) {
    console.error('Error while getting matrix list.', e)
    res.status(500).json({ message: 'Error while fetching matrix list.' })
  }
}

export {getMatrixData}