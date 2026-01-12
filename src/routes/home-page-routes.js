import express from 'express'
import { models } from '../models/init-models.js'
import { Op, literal } from 'sequelize'

const router = express.Router()

// Get home page data
router.get('/', async (req, res) => {
  try {
    const now = new Date()

    // Get featured projects from hp_featured_projects table (randomly select 5)
    const featuredProjects = await models.FeaturedProject.findAll({
      include: [
        {
          model: models.Project,
          as: 'project',
          required: true,
          where: {
            published: true,
          },
          include: [
            {
              model: models.MediaFile,
              as: 'media_files',
              required: false,
              attributes: ['media_id', 'media_type', 'media'],
            },
          ],
        },
      ],
      order: literal('RAND()'),
      limit: 5,
    })

    // Get matrix images
    const matrixImages = await models.MatrixImage.findAll({
      order: literal('RAND()'),
      limit: 1,
    })

    // Get announcements
    const announcements = await models.Announcement.findAll({
      where: {
        sdate: {
          [Op.lt]: now,
        },
        edate: {
          [Op.gt]: now,
        },
      },
      order: [['sdate', 'DESC']],
    })

    // Get tools
    const tools = await models.Tool.findAll({
      order: literal('RAND()'),
    })

    // Get press
    const press = await models.Press.findAll({
      where: {
        featured: true,
      },
      order: [['press_id', 'DESC']],
      limit: 10,
    })

    // Get maintenance mode status
    const appVars = await models.CaApplicationVar.findOne({
      attributes: ['vars'],
      raw: true,
    })
    let vars = {}
    if (appVars && appVars.vars) {
      try {
        vars =
          typeof appVars.vars === 'string'
            ? JSON.parse(appVars.vars)
            : appVars.vars
      } catch (e) {
        console.error('Error parsing vars JSON:', e)
      }
    }

    // Simple maintenance mode check - just enabled/disabled with message
    const maintenanceEnabled =
      vars.maintenance_mode === '1' || vars.maintenance_mode === 1

    res.json({
      featuredProjects: featuredProjects.map((fp) => ({
        featured_project_id: fp.featured_project_id,
        project_id: fp.project_id,
        name: fp.project?.name,
        description: fp.description || fp.project?.description,
        media_id: fp.project?.media_files?.[0]?.media_id,
        media: fp.project?.media_files?.[0]?.media,
      })),
      matrixImages: matrixImages.map((mi) => ({
        image_id: mi.image_id,
        project_id: mi.project_id,
        media: mi.media,
      })),
      announcements: announcements.map((a) => ({
        announcement_id: a.announcement_id,
        title: a.title,
        description: a.description,
        link: a.link,
        start_date: a.sdate,
        end_date: a.edate,
      })),
      tools: tools.map((t) => ({
        tool_id: t.tool_id,
        title: t.title,
        description: t.description,
        media: t.media,
        link: t.link,
      })),
      press: press.map((p) => ({
        press_id: p.press_id,
        title: p.title,
        author: p.author,
        publication: p.publication,
        media: p.media,
        link: p.link,
      })),
      maintenanceStatus: {
        enabled: maintenanceEnabled,
        message: vars.maintenance_message || '',
      },
    })
  } catch (error) {
    console.error('Error fetching home page data:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
