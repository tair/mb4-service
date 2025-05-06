import { validationResult } from 'express-validator'
import { Sequelize } from 'sequelize'
import { models } from '../models/init-models.js'
import sequelizeConn from '../util/db.js'

function searchInstitutions(req, res) {
  const searchTerm = req.query.searchTerm
  models.Institution.findAll({
    attributes: ['institution_id', 'name'],
    where: {
      name: {
        [Sequelize.Op.like]: '%' + searchTerm + '%',
      },
    },
  })
    .then((institutions) => {
      return res.status(200).json(institutions)
    })
    .catch((err) => {
      console.log(err)
      if (!err.statusCode) {
        err.statusCode = 500
      }
      res
        .status(500)
        .json({ error: 'An error occurred while searching for institutions.' })
    })
}

function searchProjects(req, res) {
  const searchTerm = req.query.searchTerm
  console.log(searchTerm)

  const query =
    'SELECT project_id, name, article_authors, journal_year, article_title, journal_title, journal_volume article_pp FROM projects WHERE name LIKE :searchTerm AND deleted = 0 AND published = 1'

  sequelizeConn
    .query(query, {
      replacements: { searchTerm: `%${searchTerm}%` },
      type: Sequelize.QueryTypes.SELECT,
    })
    .then((projects) => {
      return res.status(200).json({
        projectMembers: [],
        projects: projects,
        media: [],
      })
    })
    .catch((err) => {
      console.log(err)
      res
        .status(500)
        .json({ error: 'An error occurred while searching for projects.' })
    })
}

export { searchInstitutions, searchProjects }
