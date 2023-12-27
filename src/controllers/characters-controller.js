import * as characterService from '../services/character-service.js'

export async function getCharacters(req, res) {
  const projectId = req.params.projectId
  const characters = await characterService.getCharactersInProject(projectId)
  const data = {
    characters: Array.from(characters.values()),
  }
  res.status(200).json(data)
}
