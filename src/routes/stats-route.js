import express from 'express';
import { getStatsController } from '../controllers/stats-controller.js';

const router = express.Router();

// Add logging middleware
router.use((req, res, next) => {
  console.log('Stats route hit:', req.method, req.url);
  next();
});

// Get all statistics
router.get('/', getStatsController);

export default router; 