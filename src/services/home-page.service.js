const { Project, MediaFile, Announcement, Tool, Press, ApplicationVar, FeaturedProject } = require('../models');
const { Op } = require('sequelize');

class HomePageService {
  async getFeaturedProjects() {
    try {
      const featuredProjects = await Project.findAll({
        include: [{
          model: MediaFile,
          required: false,
          attributes: ['media_id', 'media_type', 'media']
        }],
        where: {
          published: true
        },
        order: Project.sequelize.random(),
        limit: 5,
        raw: true
      });

      return featuredProjects.map(project => ({
        project_id: project.project_id,
        name: project.name,
        description: project.description,
        media: project['MediaFiles.media'] || null
      }));
    } catch (error) {
      console.error('Error fetching featured projects:', error);
      return [];
    }
  }

  async getMatrixImages() {
    try {
      const matrixImages = await MediaFile.findAll({
        where: {
          media_type: 'matrix_image'
        },
        order: MediaFile.sequelize.random(),
        limit: 1
      });

      return matrixImages.map(image => ({
        media: image.media,
        image_id: image.media_id,
        project_id: image.project_id
      }));
    } catch (error) {
      console.error('Error fetching matrix images:', error);
      return [];
    }
  }

  async getAnnouncements() {
    try {
      const now = new Date();
      const announcements = await Announcement.findAll({
        where: {
          start_date: {
            [Op.lt]: now
          },
          end_date: {
            [Op.gt]: now
          }
        },
        order: [['start_date', 'DESC']]
      });

      return announcements.map(announcement => ({
        announcement_id: announcement.announcement_id,
        title: announcement.title,
        description: announcement.description,
        link: announcement.link,
        start_date: announcement.start_date,
        end_date: announcement.end_date
      }));
    } catch (error) {
      console.error('Error fetching announcements:', error);
      return [];
    }
  }

  async getTools() {
    try {
      const tools = await Tool.findAll({
        order: Tool.sequelize.random()
      });

      return tools.map(tool => ({
        media: tool.media,
        title: tool.title,
        description: tool.description,
        tool_id: tool.tool_id,
        link: tool.link
      }));
    } catch (error) {
      console.error('Error fetching tools:', error);
      return [];
    }
  }

  async getPress() {
    try {
      const press = await Press.findAll({
        where: {
          featured: true
        },
        order: Press.sequelize.random(),
        limit: 2
      });

      return press.map(item => ({
        press_id: item.press_id,
        title: item.title,
        author: item.author,
        publication: item.publication,
        link: item.link,
        media: item.media
      }));
    } catch (error) {
      console.error('Error fetching press:', error);
      return [];
    }
  }

  async getMaintenanceStatus() {
    try {
      const maintenanceMode = await ApplicationVar.findOne({
        where: {
          name: 'maintenance_mode'
        }
      });

      const maintenanceMessage = await ApplicationVar.findOne({
        where: {
          name: 'maintenance_message'
        }
      });

      const scheduleEnabled = await ApplicationVar.findOne({
        where: {
          name: 'maintenance_mode_schedule_enabled'
        }
      });

      // Calculate next maintenance date (second Friday of next month)
      const now = new Date();
      let nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      let day = nextMonth.getDay();
      let daysUntilFriday = (5 - day + 7) % 7;
      let secondFriday = new Date(nextMonth);
      secondFriday.setDate(secondFriday.getDate() + daysUntilFriday + 7);

      return {
        enabled: maintenanceMode ? maintenanceMode.value === '1' : false,
        message: maintenanceMessage ? maintenanceMessage.value : '',
        nextDate: secondFriday.toISOString(),
        scheduleEnabled: scheduleEnabled ? scheduleEnabled.value === '1' : false
      };
    } catch (error) {
      console.error('Error fetching maintenance status:', error);
      return {
        enabled: false,
        message: '',
        nextDate: null,
        scheduleEnabled: false
      };
    }
  }
}

module.exports = new HomePageService(); 