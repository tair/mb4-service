import { getStats } from '../util/stats-cache.js';

export const getStatsController = async (req, res) => {
  try {
    const stats = await getStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
};

// Individual stats endpoints for public access
export const getProjectViewsForLast30Days = async (req, res) => {
  try {
    const stats = await getStats();
    res.json({ count: stats.numProjectViews });
  } catch (error) {
    console.error('Error fetching project views:', error);
    res.status(500).json({ error: 'Failed to fetch project views' });
  }
};

export const getMediaViewsForLast30Days = async (req, res) => {
  try {
    const stats = await getStats();
    res.json({ count: stats.numMediaViews });
  } catch (error) {
    console.error('Error fetching media views:', error);
    res.status(500).json({ error: 'Failed to fetch media views' });
  }
};

export const getMatrixDownloadsForLast30Days = async (req, res) => {
  try {
    const stats = await getStats();
    res.json({ count: stats.numMatrixDownloads });
  } catch (error) {
    console.error('Error fetching matrix downloads:', error);
    res.status(500).json({ error: 'Failed to fetch matrix downloads' });
  }
};

export const getDocDownloadsForLast30Days = async (req, res) => {
  try {
    const stats = await getStats();
    res.json({ count: stats.numProjectDownloads });
  } catch (error) {
    console.error('Error fetching document downloads:', error);
    res.status(500).json({ error: 'Failed to fetch document downloads' });
  }
};
