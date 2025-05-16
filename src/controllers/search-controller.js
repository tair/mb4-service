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
  const published = req.query.published == 'false' ? 0 : 1

  let query =
    'SELECT project_id, name, article_authors, journal_year, article_title, journal_title, journal_volume article_pp, published FROM projects WHERE (name LIKE :searchTerm OR description LIKE :searchTerm OR journal_title LIKE :searchTerm OR article_title LIKE :searchTerm) AND deleted = 0'
  if (published === 1) {
    query += ' AND published = 1'
  }
  query += ' ORDER BY published_on desc'

  sequelizeConn
    .query(query, {
      replacements: { searchTerm: `%${searchTerm}%` },
      type: Sequelize.QueryTypes.SELECT,
    })
    .then((projects) => {
      return res.status(200).json({
        projects: projects,
      })
    })
    .catch((err) => {
      console.log(err)
      res
        .status(500)
        .json({ error: 'An error occurred while searching for projects.' })
    })
}

function searchMedia(req, res) {
  const searchTerm = req.query.searchTerm
  const published = req.query.published == 'false' ? 0 : 1
  let query = `SELECT m.media_id, m.media, m.notes, 
    p.name as project_name, p.project_id, p.published,
    s.specimen_id, s.description, s.reference_source, s.institution_code, s.collection_code, s.catalog_number,
    t.genus, t.specific_epithet
    FROM media_files m
    INNER JOIN specimens s ON m.specimen_id = s.specimen_id
    INNER JOIN taxa_x_specimens AS txs ON s.specimen_id = txs.specimen_id
    INNER JOIN taxa AS t ON t.taxon_id = txs.taxon_id
    LEFT JOIN projects p ON m.project_id = p.project_id
    WHERE (m.notes LIKE :searchTerm OR s.description LIKE :searchTerm OR t.genus LIKE :searchTerm OR t.specific_epithet LIKE :searchTerm) AND p.deleted = 0`
  if (published === 1) {
    query += ' AND p.published = 1'
  }

  sequelizeConn
    .query(query, {
      replacements: { searchTerm: `%${searchTerm}%`, published: published },
      type: Sequelize.QueryTypes.SELECT,
    })
    .then((media) => {
      return res.status(200).json({
        media: media,
      })
    })
    .catch((err) => {
      console.log(err)
      res
        .status(500)
        .json({ error: 'An error occurred while searching for media files.' })
    })
}

function searchMediaViews(req, res) {
  const searchTerm = req.query.searchTerm
  const published = req.query.published == 'false' ? 0 : 1
  let query = `SELECT
    mv.view_id,
    mv.name AS view_name,
    p.name AS project_name,
    p.project_id AS project_id,
    p.published
  FROM
    media_views mv
  INNER JOIN
    projects p ON mv.project_id = p.project_id
  WHERE
    (mv.name LIKE :searchTerm OR p.name LIKE :searchTerm) AND p.deleted = 0`
  if (published === 1) {
    query += ' AND p.published = :published'
  }

  sequelizeConn
    .query(query, {
      replacements: { searchTerm: `%${searchTerm}%`, published: published },
      type: Sequelize.QueryTypes.SELECT,
    })
    .then((mediaViews) => {
      return res.status(200).json({
        mediaViews: mediaViews,
      })
    })
    .catch((err) => {
      console.log(err)
      res
        .status(500)
        .json({ error: 'An error occurred while searching for media views.' })
    })
}

function searchSpecimens(req, res) {
  const searchTerm = req.query.searchTerm
  const published = req.query.published == 'false' ? 0 : 1
  let query = `SELECT 
    s.specimen_id, s.description, s.reference_source, s.institution_code, s.collection_code, s.catalog_number,
    p.name as project_name,
    p.project_id,
    p.published,
    t.genus,
    t.specific_epithet
    FROM specimens s
    INNER JOIN projects p ON s.project_id = p.project_id
    LEFT JOIN taxa_x_specimens txs ON s.specimen_id = txs.specimen_id
    LEFT JOIN taxa t ON txs.taxon_id = t.taxon_id
    WHERE
      (s.description LIKE :searchTerm OR
     s.institution_code LIKE :searchTerm OR
     s.catalog_number LIKE :searchTerm OR
     s.collection_code LIKE :searchTerm OR
     s.occurrence_id LIKE :searchTerm OR
     t.genus LIKE :searchTerm OR
     t.specific_epithet LIKE :searchTerm OR
     t.notes LIKE :searchTerm OR
     p.name LIKE :searchTerm)
    AND p.deleted = 0`
  if (published === 1) {
    query += ' AND p.published = :published'
  }

  sequelizeConn
    .query(query, {
      replacements: { searchTerm: `%${searchTerm}%`, published: published },
      type: Sequelize.QueryTypes.SELECT,
    })
    .then((specimens) => {
      return res.status(200).json({
        specimens: specimens,
      })
    })
    .catch((err) => {
      console.log(err)
      res
        .status(500)
        .json({ error: 'An error occurred while searching for specimens.' })
    })
}

function searchCharacters(req, res) {
  const searchTerm = req.query.searchTerm
  const published = req.query.published == 'false' ? 0 : 1
  let query = `SELECT c.character_id, c.name, c.description, p.name as project_name, p.project_id, p.published FROM characters c
    INNER JOIN projects p ON c.project_id = p.project_id
    WHERE
      (c.name LIKE :searchTerm OR
      c.description LIKE :searchTerm OR
      p.name LIKE :searchTerm) AND
      p.deleted = 0`
  if (published === 1) {
    query += ' AND p.published = :published'
  }

  sequelizeConn
    .query(query, {
      replacements: { searchTerm: `%${searchTerm}%`, published: published },
      type: Sequelize.QueryTypes.SELECT,
    })
    .then((characters) => {
      return res.status(200).json({
        characters: characters,
      })
    })
    .catch((err) => {
      console.log(err)
      res
        .status(500)
        .json({ error: 'An error occurred while searching for characters.' })
    })
}

function searchTaxa(req, res) {
  const searchTerm = req.query.searchTerm
  const published = req.query.published == 'false' ? 0 : 1
  let query = `SELECT t.taxon_id, t.genus, t.specific_epithet, t.notes, p.name as project_name, p.project_id, p.published FROM taxa t
    INNER JOIN projects p ON t.project_id = p.project_id
    WHERE
      (t.genus LIKE :searchTerm OR
      t.notes LIKE :searchTerm OR
      t.specific_epithet LIKE :searchTerm OR
      t.otu LIKE :searchTerm OR
      p.name LIKE :searchTerm) AND
      p.deleted = 0`
  if (published === 1) {
    query += ' AND p.published = :published'
  }

  sequelizeConn
    .query(query, {
      replacements: { searchTerm: `%${searchTerm}%`, published: published },
      type: Sequelize.QueryTypes.SELECT,
    })
    .then((taxa) => {
      return res.status(200).json({
        taxa: taxa,
      })
    })
    .catch((err) => {
      console.log(err)
      res
        .status(500)
        .json({ error: 'An error occurred while searching for taxa.' })
    })
}

function searchMatrices(req, res) {
  const searchTerm = req.query.searchTerm
  const published = req.query.published == 'false' ? 0 : 1
  let query = `SELECT m.matrix_id, m.title, p.name as project_name, p.project_id, p.published FROM matrices m
    INNER JOIN projects p ON m.project_id = p.project_id
    WHERE
      (m.title LIKE :searchTerm OR
      m.title_extended LIKE :searchTerm OR
      m.notes LIKE :searchTerm OR
      m.otu LIKE :searchTerm) AND
      p.deleted = 0`
  if (published === 1) {
    query += ' AND p.published = :published'
  }

  sequelizeConn
    .query(query, {
      replacements: { searchTerm: `%${searchTerm}%`, published: published },
      type: Sequelize.QueryTypes.SELECT,
    })
    .then((matrices) => {
      return res.status(200).json({
        matrices: matrices,
      })
    })
    .catch((err) => {
      console.log(err)
      res
        .status(500)
        .json({ error: 'An error occurred while searching for matrices.' })
    })
}

function searchReferences(req, res) {
  const searchTerm = req.query.searchTerm
  const published = req.query.published == 'false' ? 0 : 1
  let query = `SELECT b.*, p.name as project_name, p.published FROM bibliographic_references b
    INNER JOIN projects p ON b.project_id = p.project_id
    WHERE
      (b.article_title LIKE :searchTerm OR
      b.journal_title LIKE :searchTerm OR
      b.monograph_title LIKE :searchTerm OR
      b.publisher LIKE :searchTerm OR
      b.abstract LIKE :searchTerm OR
      b.description LIKE :searchTerm OR
      b.keywords LIKE :searchTerm OR
      p.name LIKE :searchTerm) AND
      p.deleted = 0`
  if (published === 1) {
    query += ' AND p.published = :published'
  }

  sequelizeConn
    .query(query, {
      replacements: { searchTerm: `%${searchTerm}%`, published: published },
      type: Sequelize.QueryTypes.SELECT,
    })
    .then((references) => {
      return res.status(200).json({
        references: references,
      })
    })
    .catch((err) => {
      console.log(err)
      res
        .status(500)
        .json({ error: 'An error occurred while searching for references.' })
    })
}

export {
  searchInstitutions,
  searchProjects,
  searchMedia,
  searchMediaViews,
  searchSpecimens,
  searchCharacters,
  searchTaxa,
  searchMatrices,
  searchReferences,
}
