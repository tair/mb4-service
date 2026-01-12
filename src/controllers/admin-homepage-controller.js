import { models } from '../models/init-models.js'
import { Op } from 'sequelize'
import sharp from 'sharp'
import s3Service from '../services/s3-service.js'
import config from '../config.js'
import { time } from '../util/util.js'

/**
 * Admin Homepage Controller
 *
 * Provides administrative endpoints for managing homepage content:
 * - Tools
 * - Announcements
 * - Matrix Images (Hero Images)
 * - Featured Projects
 * - Press
 *
 * All endpoints require admin authentication.
 */

// =============================================================================
// GET ALL HOMEPAGE CONTENT
// =============================================================================

/**
 * Get all homepage content for admin dashboard
 * GET /admin/homepage
 */
export async function getAllHomepageContent(req, res) {
  try {
    const [tools, announcements, matrixImages, featuredProjects, press, publishedProjects] =
      await Promise.all([
        models.Tool.findAll({
          order: [['tool_id', 'DESC']],
        }),
        models.Announcement.findAll({
          order: [['sdate', 'DESC']],
        }),
        models.MatrixImage.findAll({
          include: [
            {
              model: models.Project,
              as: 'project',
              attributes: ['project_id', 'name'],
            },
          ],
          order: [['image_id', 'DESC']],
        }),
        models.FeaturedProject.findAll({
          include: [
            {
              model: models.Project,
              as: 'project',
              attributes: ['project_id', 'name'],
            },
          ],
          order: [['featured_project_id', 'DESC']],
        }),
        models.Press.findAll({
          order: [['press_id', 'DESC']],
        }),
        // Get published projects for dropdowns
        models.Project.findAll({
          where: {
            published: 1,
            deleted: { [Op.or]: [0, null] },
          },
          attributes: ['project_id', 'name'],
          order: [['project_id', 'DESC']],
        }),
      ])

    res.json({
      success: true,
      data: {
        tools: tools.map(formatTool),
        announcements: announcements.map(formatAnnouncement),
        matrixImages: matrixImages.map(formatMatrixImage),
        featuredProjects: featuredProjects.map(formatFeaturedProject),
        press: press.map(formatPress),
        publishedProjects: publishedProjects.map((p) => ({
          project_id: p.project_id,
          name: p.name,
        })),
      },
    })
  } catch (error) {
    console.error('Error fetching homepage content:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch homepage content',
    })
  }
}

// =============================================================================
// TOOLS CRUD
// =============================================================================

/**
 * Create a new tool
 * POST /admin/homepage/tools
 */
export async function createTool(req, res) {
  try {
    const { title, description, link } = req.body
    const file = req.file

    // Validate required fields
    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: 'Title and description are required',
      })
    }

    if (title.length > 30) {
      return res.status(400).json({
        success: false,
        message: 'Title must not exceed 30 characters',
      })
    }

    // Create tool record first to get the ID
    const tool = await models.Tool.create({
      title,
      description,
      link: link || null,
      media: null, // Will be updated after image upload
    }, { user: req.user })

    // Process and upload image if provided
    if (file) {
      const mediaJson = await processAndUploadImage(
        file,
        'hp_tools',
        tool.tool_id
      )
      tool.media = JSON.stringify(mediaJson)
      await tool.save({ user: req.user })
    }

    res.status(201).json({
      success: true,
      message: 'Tool created successfully',
      data: formatTool(tool),
    })
  } catch (error) {
    console.error('Error creating tool:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to create tool',
    })
  }
}

/**
 * Update an existing tool
 * PUT /admin/homepage/tools/:id
 */
export async function updateTool(req, res) {
  try {
    const toolId = parseInt(req.params.id)
    const { title, description, link } = req.body
    const file = req.file

    const tool = await models.Tool.findByPk(toolId)
    if (!tool) {
      return res.status(404).json({
        success: false,
        message: 'Tool not found',
      })
    }

    // Validate fields
    if (title && title.length > 30) {
      return res.status(400).json({
        success: false,
        message: 'Title must not exceed 30 characters',
      })
    }

    // Update fields
    if (title !== undefined) tool.title = title
    if (description !== undefined) tool.description = description
    if (link !== undefined) tool.link = link || null

    // Process and upload new image if provided
    if (file) {
      const mediaJson = await processAndUploadImage(file, 'hp_tools', toolId)
      tool.media = JSON.stringify(mediaJson)
    }

    await tool.save({ user: req.user })

    res.json({
      success: true,
      message: 'Tool updated successfully',
      data: formatTool(tool),
    })
  } catch (error) {
    console.error('Error updating tool:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to update tool',
    })
  }
}

/**
 * Delete a tool
 * DELETE /admin/homepage/tools/:id
 */
export async function deleteTool(req, res) {
  try {
    const toolId = parseInt(req.params.id)

    const tool = await models.Tool.findByPk(toolId)
    if (!tool) {
      return res.status(404).json({
        success: false,
        message: 'Tool not found',
      })
    }

    await tool.destroy({ user: req.user })

    res.json({
      success: true,
      message: 'Tool deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting tool:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to delete tool',
    })
  }
}

// =============================================================================
// ANNOUNCEMENTS CRUD
// =============================================================================

/**
 * Create a new announcement
 * POST /admin/homepage/announcements
 */
export async function createAnnouncement(req, res) {
  try {
    const { title, description, link, startDate, endDate } = req.body

    // Validate required fields
    if (!description) {
      return res.status(400).json({
        success: false,
        message: 'Description is required',
      })
    }

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required',
      })
    }

    const sdate = new Date(startDate)
    const edate = new Date(endDate)

    if (edate <= sdate) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after start date',
      })
    }

    const announcement = await models.Announcement.create({
      title: title || '',
      description,
      link: link || '',
      sdate,
      edate,
    }, { user: req.user })

    res.status(201).json({
      success: true,
      message: 'Announcement created successfully',
      data: formatAnnouncement(announcement),
    })
  } catch (error) {
    console.error('Error creating announcement:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to create announcement',
    })
  }
}

/**
 * Update an existing announcement
 * PUT /admin/homepage/announcements/:id
 */
export async function updateAnnouncement(req, res) {
  try {
    const announcementId = parseInt(req.params.id)
    const { title, description, link, startDate, endDate } = req.body

    const announcement = await models.Announcement.findByPk(announcementId)
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found',
      })
    }

    // Update fields
    if (title !== undefined) announcement.title = title
    if (description !== undefined) announcement.description = description
    if (link !== undefined) announcement.link = link || ''

    if (startDate !== undefined) {
      announcement.sdate = new Date(startDate)
    }
    if (endDate !== undefined) {
      announcement.edate = new Date(endDate)
    }

    // Validate dates
    if (announcement.edate <= announcement.sdate) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after start date',
      })
    }

    await announcement.save({ user: req.user })

    res.json({
      success: true,
      message: 'Announcement updated successfully',
      data: formatAnnouncement(announcement),
    })
  } catch (error) {
    console.error('Error updating announcement:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to update announcement',
    })
  }
}

/**
 * Delete an announcement
 * DELETE /admin/homepage/announcements/:id
 */
export async function deleteAnnouncement(req, res) {
  try {
    const announcementId = parseInt(req.params.id)

    const announcement = await models.Announcement.findByPk(announcementId)
    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found',
      })
    }

    await announcement.destroy({ user: req.user })

    res.json({
      success: true,
      message: 'Announcement deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting announcement:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to delete announcement',
    })
  }
}

// =============================================================================
// MATRIX IMAGES (HERO IMAGES) CRUD
// =============================================================================

/**
 * Create a new matrix image
 * POST /admin/homepage/matrix-images
 */
export async function createMatrixImage(req, res) {
  try {
    const { projectId } = req.body
    const file = req.file

    // Validate required fields
    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: 'Project ID is required',
      })
    }

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'Image file is required',
      })
    }

    // Verify project exists and is published
    const project = await models.Project.findByPk(projectId)
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      })
    }

    if (!project.published) {
      return res.status(400).json({
        success: false,
        message: 'Only published projects can be linked to matrix images',
      })
    }

    // Get the next available ID (needed for S3 path before creating record)
    const maxIdResult = await models.MatrixImage.max('image_id')
    const nextId = (maxIdResult || 0) + 1

    // Process and upload image first (using the next ID)
    const mediaJson = await processAndUploadImage(
      file,
      'matrix_images',
      nextId
    )

    // Create matrix image record with media already set
    const matrixImage = await models.MatrixImage.create({
      project_id: projectId,
      media: mediaJson,
    }, { user: req.user })

    // Reload with project association
    await matrixImage.reload({
      include: [
        {
          model: models.Project,
          as: 'project',
          attributes: ['project_id', 'name'],
        },
      ],
    })

    res.status(201).json({
      success: true,
      message: 'Matrix image created successfully',
      data: formatMatrixImage(matrixImage),
    })
  } catch (error) {
    console.error('Error creating matrix image:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to create matrix image',
    })
  }
}

/**
 * Delete a matrix image
 * DELETE /admin/homepage/matrix-images/:id
 */
export async function deleteMatrixImage(req, res) {
  try {
    const imageId = parseInt(req.params.id)

    const matrixImage = await models.MatrixImage.findByPk(imageId)
    if (!matrixImage) {
      return res.status(404).json({
        success: false,
        message: 'Matrix image not found',
      })
    }

    await matrixImage.destroy({ user: req.user })

    res.json({
      success: true,
      message: 'Matrix image deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting matrix image:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to delete matrix image',
    })
  }
}

// =============================================================================
// FEATURED PROJECTS CRUD
// =============================================================================

/**
 * Add a project to featured list
 * POST /admin/homepage/featured-projects
 */
export async function addFeaturedProject(req, res) {
  try {
    const { projectId } = req.body

    // Validate required fields
    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: 'Project ID is required',
      })
    }

    // Verify project exists and is published
    const project = await models.Project.findByPk(projectId)
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      })
    }

    if (!project.published) {
      return res.status(400).json({
        success: false,
        message: 'Only published projects can be featured',
      })
    }

    // Check if project is already featured
    const existingFeatured = await models.FeaturedProject.findOne({
      where: { project_id: projectId },
    })

    if (existingFeatured) {
      return res.status(409).json({
        success: false,
        message: 'This project is already featured',
      })
    }

    // Create featured project record
    const featuredProject = await models.FeaturedProject.create({
      project_id: projectId,
      description: '',
      created_on: time(),
    }, { user: req.user })

    // Reload with project association
    await featuredProject.reload({
      include: [
        {
          model: models.Project,
          as: 'project',
          attributes: ['project_id', 'name'],
        },
      ],
    })

    res.status(201).json({
      success: true,
      message: 'Project added to featured list',
      data: formatFeaturedProject(featuredProject),
    })
  } catch (error) {
    console.error('Error adding featured project:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to add featured project',
    })
  }
}

/**
 * Remove a project from featured list
 * DELETE /admin/homepage/featured-projects/:id
 */
export async function removeFeaturedProject(req, res) {
  try {
    const featuredProjectId = parseInt(req.params.id)

    const featuredProject =
      await models.FeaturedProject.findByPk(featuredProjectId)
    if (!featuredProject) {
      return res.status(404).json({
        success: false,
        message: 'Featured project not found',
      })
    }

    await featuredProject.destroy({ user: req.user })

    res.json({
      success: true,
      message: 'Project removed from featured list',
    })
  } catch (error) {
    console.error('Error removing featured project:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to remove featured project',
    })
  }
}

// =============================================================================
// PRESS CRUD
// =============================================================================

/**
 * Create a new press item
 * POST /admin/homepage/press
 */
export async function createPress(req, res) {
  try {
    const { title, author, publication, link, featured } = req.body
    const file = req.file

    // Validate required fields
    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Title is required',
      })
    }

    // Create press record first to get the ID
    const press = await models.Press.create({
      title,
      author: author || null,
      publication: publication || null,
      link: link || null,
      featured: featured || false,
      media: null, // Will be updated after image upload
    }, { user: req.user })

    // Process and upload image if provided
    if (file) {
      const mediaJson = await processAndUploadImage(
        file,
        'press',
        press.press_id
      )
      press.media = JSON.stringify(mediaJson)
      await press.save({ user: req.user })
    }

    res.status(201).json({
      success: true,
      message: 'Press item created successfully',
      data: formatPress(press),
    })
  } catch (error) {
    console.error('Error creating press item:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to create press item',
    })
  }
}

/**
 * Update an existing press item
 * PUT /admin/homepage/press/:id
 */
export async function updatePress(req, res) {
  try {
    const pressId = parseInt(req.params.id)
    const { title, author, publication, link, featured } = req.body
    const file = req.file

    const press = await models.Press.findByPk(pressId)
    if (!press) {
      return res.status(404).json({
        success: false,
        message: 'Press item not found',
      })
    }

    // Update fields
    if (title !== undefined) press.title = title
    if (author !== undefined) press.author = author || null
    if (publication !== undefined) press.publication = publication || null
    if (link !== undefined) press.link = link || null
    if (featured !== undefined) press.featured = featured

    // Process and upload new image if provided
    if (file) {
      const mediaJson = await processAndUploadImage(file, 'press', pressId)
      press.media = JSON.stringify(mediaJson)
    }

    await press.save({ user: req.user })

    res.json({
      success: true,
      message: 'Press item updated successfully',
      data: formatPress(press),
    })
  } catch (error) {
    console.error('Error updating press item:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to update press item',
    })
  }
}

/**
 * Delete a press item
 * DELETE /admin/homepage/press/:id
 */
export async function deletePress(req, res) {
  try {
    const pressId = parseInt(req.params.id)

    const press = await models.Press.findByPk(pressId)
    if (!press) {
      return res.status(404).json({
        success: false,
        message: 'Press item not found',
      })
    }

    await press.destroy({ user: req.user })

    res.json({
      success: true,
      message: 'Press item deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting press item:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to delete press item',
    })
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Process an image and upload to S3 in multiple sizes
 */
async function processAndUploadImage(file, folder, itemId) {
  const bucket = config.aws.defaultBucket
  const baseKey = `media_files/${folder}/${itemId}`

  const sizes = {
    original: null, // No resizing
    large: { width: 800, height: 800 },
    thumbnail: { width: 120, height: 120 },
  }

  const mediaJson = {
    ORIGINAL_FILENAME: file.originalname,
  }

  for (const [sizeName, dimensions] of Object.entries(sizes)) {
    try {
      let outputBuffer
      let outputWidth
      let outputHeight

      const image = sharp(file.buffer || file.path)
      const metadata = await image.metadata()

      if (sizeName === 'original') {
        // Keep original
        if (file.buffer) {
          outputBuffer = file.buffer
        } else {
          const fs = await import('fs')
          outputBuffer = await fs.promises.readFile(file.path)
        }
        outputWidth = metadata.width
        outputHeight = metadata.height
      } else if (sizeName === 'large') {
        // Resize maintaining aspect ratio
        outputBuffer = await image
          .resize(dimensions.width, dimensions.height, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .jpeg({ quality: 85 })
          .toBuffer()
        const resizedMeta = await sharp(outputBuffer).metadata()
        outputWidth = resizedMeta.width
        outputHeight = resizedMeta.height
      } else if (sizeName === 'thumbnail') {
        // Resize to exact dimensions with cover
        outputBuffer = await image
          .resize(dimensions.width, dimensions.height, {
            fit: 'cover',
          })
          .jpeg({ quality: 85 })
          .toBuffer()
        outputWidth = dimensions.width
        outputHeight = dimensions.height
      }

      const extension = sizeName === 'original' ? getExtension(file.originalname) : 'jpg'
      const s3Key = `${baseKey}/${itemId}_${sizeName}.${extension}`
      const contentType = sizeName === 'original' ? file.mimetype : 'image/jpeg'

      const result = await s3Service.putObject(
        bucket,
        s3Key,
        outputBuffer,
        contentType
      )

      mediaJson[sizeName] = {
        S3_KEY: s3Key,
        S3_ETAG: result.etag,
        WIDTH: outputWidth,
        HEIGHT: outputHeight,
        FILESIZE: outputBuffer.length,
        MIMETYPE: contentType,
        EXTENSION: extension,
        PROPERTIES: {
          height: outputHeight,
          width: outputWidth,
          mimetype: contentType,
          filesize: outputBuffer.length,
          version: sizeName,
        },
      }
    } catch (error) {
      console.error(`Error processing ${sizeName} variant:`, error)
      throw error
    }
  }

  return mediaJson
}

/**
 * Get file extension from filename
 */
function getExtension(filename) {
  const parts = filename.split('.')
  return parts.length > 1 ? parts.pop().toLowerCase() : 'jpg'
}

/**
 * Format tool for API response
 */
function formatTool(tool) {
  let media = tool.media
  if (typeof media === 'string') {
    try {
      media = JSON.parse(media)
    } catch (e) {
      media = null
    }
  }

  // Build URLs: prefer media JSON S3_KEY if available, otherwise construct direct path
  // Always provide the URL - frontend will handle 404 with error handler
  const id = tool.tool_id
  const thumbnailUrl = media?.thumbnail?.S3_KEY
    ? `/s3/${media.thumbnail.S3_KEY}`
    : `/s3/media_files/hp_tools/${id}/${id}_thumbnail.jpg`
  const largeUrl = media?.large?.S3_KEY
    ? `/s3/${media.large.S3_KEY}`
    : `/s3/media_files/hp_tools/${id}/${id}_large.jpg`

  return {
    tool_id: tool.tool_id,
    title: tool.title,
    description: tool.description,
    link: tool.link,
    media: media,
    thumbnailUrl,
    largeUrl,
  }
}

/**
 * Format announcement for API response
 */
function formatAnnouncement(announcement) {
  const now = new Date()
  const isActive = announcement.sdate <= now && announcement.edate >= now

  return {
    announcement_id: announcement.announcement_id,
    title: announcement.title,
    description: announcement.description,
    link: announcement.link,
    startDate: announcement.sdate,
    endDate: announcement.edate,
    isActive,
  }
}

/**
 * Format matrix image for API response
 */
function formatMatrixImage(matrixImage) {
  let media = matrixImage.media
  if (typeof media === 'string') {
    try {
      media = JSON.parse(media)
    } catch (e) {
      media = null
    }
  }

  // Build URLs: prefer media JSON S3_KEY if available, otherwise construct direct path
  // Always provide the URL - frontend will handle 404 with error handler
  const id = matrixImage.image_id
  const thumbnailUrl = media?.thumbnail?.S3_KEY
    ? `/s3/${media.thumbnail.S3_KEY}`
    : `/s3/media_files/matrix_images/${id}/${id}_thumbnail.jpg`
  const largeUrl = media?.large?.S3_KEY
    ? `/s3/${media.large.S3_KEY}`
    : `/s3/media_files/matrix_images/${id}/${id}_large.jpg`

  return {
    image_id: matrixImage.image_id,
    project_id: matrixImage.project_id,
    projectName: matrixImage.project?.name || null,
    media: media,
    thumbnailUrl,
    largeUrl,
  }
}

/**
 * Format featured project for API response
 */
function formatFeaturedProject(featuredProject) {
  return {
    featured_project_id: featuredProject.featured_project_id,
    project_id: featuredProject.project_id,
    projectName: featuredProject.project?.name || null,
    description: featuredProject.description,
    createdOn: featuredProject.created_on
      ? new Date(featuredProject.created_on * 1000).toISOString()
      : null,
  }
}

/**
 * Format press for API response
 */
function formatPress(press) {
  let media = press.media
  if (typeof media === 'string') {
    try {
      media = JSON.parse(media)
    } catch (e) {
      media = null
    }
  }

  // Build URLs: prefer media JSON S3_KEY if available, otherwise construct direct path
  // Always provide the URL - frontend will handle 404 with error handler
  const id = press.press_id
  const thumbnailUrl = media?.thumbnail?.S3_KEY
    ? `/s3/${media.thumbnail.S3_KEY}`
    : `/s3/media_files/press/${id}/${id}_thumbnail.jpg`
  const largeUrl = media?.large?.S3_KEY
    ? `/s3/${media.large.S3_KEY}`
    : `/s3/media_files/press/${id}/${id}_large.jpg`

  return {
    press_id: press.press_id,
    title: press.title,
    author: press.author,
    publication: press.publication,
    link: press.link,
    featured: press.featured,
    media: media,
    thumbnailUrl,
    largeUrl,
  }
}

