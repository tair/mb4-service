import { TilepicParser } from '../lib/tilepic-parser.js'

export async function getTilePic(req, res) {

  const path = req.query.p    
  if (!path) {
    console.log('Path is not defined')
    res.sendStatus(400)
    return
  }

  const tile = parseInt(req.query.t)
  if (!tile) {
    console.log('Tile is not defined')
    res.sendStatus(400)
    return
  }

  try {
    const parser = new TilepicParser(path)
    const image = await parser.getTilePic(tile)

    res.set({
      'Content-Type': 'image/jpeg',
      'Content-Length': image.byteLength,
    })
    res.status(200)
    res.write(image)
    res.end()
  } catch(e) {
    console.log('Error getting tilepic:', e)
    res.sendStatus(404)
  }
}