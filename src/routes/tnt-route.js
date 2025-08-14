import express from 'express'
import multer from 'multer'
import * as tntController from '../controllers/tnt-controller.js'
import { maybeAuthenticateToken } from './auth-interceptor.js'
import { authorizeUser } from './user-interceptor.js'

const tntRouter = express.Router({ mergeParams: true })

// Configure multer for file uploads (store in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept .tnt and .txt files
    const allowedExtensions = ['.tnt', '.txt']
    const fileExtension = file.originalname
      .toLowerCase()
      .substring(file.originalname.lastIndexOf('.'))

    if (allowedExtensions.includes(fileExtension)) {
      cb(null, true)
    } else {
      cb(new Error('Only .tnt and .txt files are allowed'), false)
    }
  },
})

// Apply authentication middleware
tntRouter.use(maybeAuthenticateToken)
tntRouter.use(authorizeUser)

// TNT endpoints
tntRouter.post(
  '/validate',
  upload.single('file'),
  tntController.validateTntFile
)
tntRouter.post('/species', upload.single('file'), tntController.extractSpecies)
tntRouter.post('/analyze', upload.single('file'), tntController.analyzeTntFile)

// TNT download endpoint - downloads matrix data in TNT format
tntRouter.get('/matrices/:matrixId/download', tntController.download)

// TNT matrix validation and species extraction endpoint - converts matrix to TNT, validates, and extracts species
tntRouter.post(
  '/matrices/:matrixId/validate',
  tntController.validateMatrixAndExtractSpecies
)

// TNT analysis endpoint using cached content - analyzes previously validated matrix TNT content
tntRouter.post('/cached/:cacheKey/analyze', tntController.analyzeMatrixTnt)

// Error handling middleware for multer
tntRouter.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large. Maximum size is 10MB.',
      })
    }
    return res.status(400).json({
      error: `File upload error: ${error.message}`,
    })
  } else if (error.message === 'Only .tnt and .txt files are allowed') {
    return res.status(400).json({
      error: 'Invalid file type. Only .tnt and .txt files are allowed.',
    })
  }
  next(error)
})

export default tntRouter
