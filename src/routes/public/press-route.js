import express from 'express'
import { models } from '../../models/init-models.js'

const router = express.Router()

// Get all press items (public, no auth required)
router.get('/', async (req, res) => {
  try {
    const press = await models.Press.findAll({
      order: [['press_id', 'DESC']],
    })

    res.json(
      press.map((p) => ({
        press_id: p.press_id,
        title: p.title,
        author: p.author,
        publication: p.publication,
        media: p.media,
        link: p.link,
        featured: p.featured,
      }))
    )
  } catch (error) {
    console.error('Error fetching press items:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
