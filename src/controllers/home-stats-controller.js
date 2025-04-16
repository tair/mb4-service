import { getStats } from '../util/stats-cache.js';

export const getHomeStatsController = async (req, res) => {
  try {
    const stats = await getStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching home stats:', error);
    res.status(500).json({ error: 'Failed to fetch home statistics' });
  }
};
