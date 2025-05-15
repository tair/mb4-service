import express from 'express'
import { getHomeStatsController } from '../controllers/home-stats-controller.js'

const router = express.Router()

// // Add logging middleware
// router.use((req, res, next) => {
//   console.log('Home Stats route hit:', req.method, req.url);
//   next();
// });

// Home stats routes
router.get('/home', getHomeStatsController)

export default router
