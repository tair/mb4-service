const homePageService = require('../services/home-page-service.js');

class HomePageController {
  async getHomePageData(req, res) {
    try {
      const [
        featuredProjects,
        matrixImages,
        announcements,
        tools,
        press,
        maintenanceStatus
      ] = await Promise.all([
        homePageService.getFeaturedProjects(),
        homePageService.getMatrixImages(),
        homePageService.getAnnouncements(),
        homePageService.getTools(),
        homePageService.getPress(),
        homePageService.getMaintenanceStatus()
      ]);

      res.json({
        featuredProjects,
        matrixImages,
        announcements,
        tools,
        press,
        maintenanceStatus
      });
    } catch (error) {
      console.error('Error fetching home page data:', error);
      res.status(500).json({ error: 'Failed to fetch home page data' });
    }
  }
}

module.exports = new HomePageController(); 