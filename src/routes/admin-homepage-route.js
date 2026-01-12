import express from 'express'
import multer from 'multer'
import { authenticateToken } from './auth-interceptor.js'
import { authorizeUser } from './user-interceptor.js'
import { requireAdmin } from '../lib/auth-middleware.js'
import * as homepageController from '../controllers/admin-homepage-controller.js'

const router = express.Router()

// Configure multer for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
    ]
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(
        new Error(
          'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'
        ),
        false
      )
    }
  },
})

// All routes require authentication and admin privileges
router.use(authenticateToken)
router.use(authorizeUser)
router.use(requireAdmin)

// =============================================================================
// GET ALL HOMEPAGE CONTENT
// =============================================================================

/**
 * @route GET /admin/homepage
 * @desc Get all homepage content for admin dashboard
 * @access Admin only
 */
router.get('/', homepageController.getAllHomepageContent)

// =============================================================================
// TOOLS ROUTES
// =============================================================================

/**
 * @route POST /admin/homepage/tools
 * @desc Create a new tool
 * @access Admin only
 */
router.post('/tools', upload.single('image'), homepageController.createTool)

/**
 * @route PUT /admin/homepage/tools/:id
 * @desc Update an existing tool
 * @access Admin only
 */
router.put('/tools/:id', upload.single('image'), homepageController.updateTool)

/**
 * @route DELETE /admin/homepage/tools/:id
 * @desc Delete a tool
 * @access Admin only
 */
router.delete('/tools/:id', homepageController.deleteTool)

// =============================================================================
// ANNOUNCEMENTS ROUTES
// =============================================================================

/**
 * @route POST /admin/homepage/announcements
 * @desc Create a new announcement
 * @access Admin only
 */
router.post('/announcements', homepageController.createAnnouncement)

/**
 * @route PUT /admin/homepage/announcements/:id
 * @desc Update an existing announcement
 * @access Admin only
 */
router.put('/announcements/:id', homepageController.updateAnnouncement)

/**
 * @route DELETE /admin/homepage/announcements/:id
 * @desc Delete an announcement
 * @access Admin only
 */
router.delete('/announcements/:id', homepageController.deleteAnnouncement)

// =============================================================================
// MATRIX IMAGES (HERO IMAGES) ROUTES
// =============================================================================

/**
 * @route POST /admin/homepage/matrix-images
 * @desc Create a new matrix image (hero image)
 * @access Admin only
 */
router.post(
  '/matrix-images',
  upload.single('image'),
  homepageController.createMatrixImage
)

/**
 * @route DELETE /admin/homepage/matrix-images/:id
 * @desc Delete a matrix image
 * @access Admin only
 */
router.delete('/matrix-images/:id', homepageController.deleteMatrixImage)

// =============================================================================
// FEATURED PROJECTS ROUTES
// =============================================================================

/**
 * @route POST /admin/homepage/featured-projects
 * @desc Add a project to the featured list
 * @access Admin only
 */
router.post('/featured-projects', homepageController.addFeaturedProject)

/**
 * @route DELETE /admin/homepage/featured-projects/:id
 * @desc Remove a project from the featured list
 * @access Admin only
 */
router.delete('/featured-projects/:id', homepageController.removeFeaturedProject)

// =============================================================================
// PRESS ROUTES
// =============================================================================

/**
 * @route POST /admin/homepage/press
 * @desc Create a new press item
 * @access Admin only
 */
router.post('/press', upload.single('image'), homepageController.createPress)

/**
 * @route PUT /admin/homepage/press/:id
 * @desc Update an existing press item
 * @access Admin only
 */
router.put('/press/:id', upload.single('image'), homepageController.updatePress)

/**
 * @route DELETE /admin/homepage/press/:id
 * @desc Delete a press item
 * @access Admin only
 */
router.delete('/press/:id', homepageController.deletePress)

// Error handling for multer
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size exceeds the maximum allowed limit of 10MB',
      })
    }
    return res.status(400).json({
      success: false,
      message: `Upload error: ${err.message}`,
    })
  }
  if (err.message && err.message.includes('Invalid file type')) {
    return res.status(400).json({
      success: false,
      message: err.message,
    })
  }
  next(err)
})

export default router

