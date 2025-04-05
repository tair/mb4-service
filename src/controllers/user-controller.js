import { validationResult } from 'express-validator'
import { models } from '../models/init-models.js'
import { Sequelize } from 'sequelize'

function getUsers(req, res, next) {
  models.User.findAll({ attributes: ['user_id', 'email'] })
    .then((users) => {
      return res.status(200).json(users)
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 500
      }
      next(err)
    })
}

function getProfile(req, res, next) {
  models.User.findByPk(req.credential.user_id, {
    attributes: ['fname', 'lname', 'email', 'orcid'],
    include: [
      {
        model: models.Institution,
        as: 'institutions',
        attributes: ['institution_id', 'name'],
      },
    ],
  })
    .then((profile) => {
      return res.status(200).json(profile)
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 500
      }
      next(err)
    })
}

async function updateProfile(req, res, next) {
  const errors = validationResult(req.body)
  if (!errors.isEmpty()) {
    const error = new Error('Validation failed.')
    error.statusCode = 422
    error.data = errors.array()
    throw error
  }

  try {
    let user = await models.User.findByPk(req.credential.user_id)
    const currTime = new Date().getTime()
    // save timestamp in seconds
    user.last_confirmed_profile_on = Math.floor(currTime / 1000)
    if (req.body.email) {
      user.email = req.body.email
    }
    if (req.body.firstName) {
      user.fname = req.body.firstName
    }
    if (req.body.lastName) {
      user.lname = req.body.lastName
    }
    if (req.body.newPassword) {
      let passwordHash = await models.User.hashPassword(req.body.newPassword)
      user.password_hash = passwordHash
    }
    await user.save({ user: user })
    // save affiliated institutions
    if (req.body.institutions) {
      const instIds = req.body.institutions.map(
        (institution) => institution.institution_id
      )
      //get all the affiliated institutions
      const affiliatedInstitutions = await models.InstitutionsXUser.findAll({
        where: {
          user_id: user.user_id,
        },
      })
      const affiliatedIds = affiliatedInstitutions.map(
        (institution) => institution.institution_id
      )
      const recordsToDelete = affiliatedInstitutions.filter(
        (record) => !instIds.includes(record.institution_id)
      )
      const recordsToAdd = instIds.filter(
        (value) => !affiliatedIds.includes(value)
      )
      if (recordsToAdd) {
        await models.InstitutionsXUser.bulkCreate(
          recordsToAdd.map((id) => ({
            institution_id: id,
            user_id: user.user_id,
          }))
        )
      }
      if (recordsToDelete) {
        // Delete the filtered InstitutionXUser records
        await models.InstitutionsXUser.destroy({
          where: {
            institution_id: recordsToDelete.map(
              (record) => record.institution_id
            ),
          },
        })
      }
    }
    const updatedUser = await models.User.findByPk(user.user_id, {
      attributes: ['fname', 'lname', 'email', 'orcid'],
      include: [
        {
          model: models.Institution,
          as: 'institutions',
          attributes: ['institution_id', 'name'],
        },
      ],
    })
    res.status(200).json({
      message: 'User update!',
      user: updatedUser,
    })
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500
    }
    next(err)
  }
}

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

function signup(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    // Convert validation errors into a single message
    const errorMessages = errors
      .array()
      .map((error) => error.msg)
      .join('. ')
    return res.status(422).json({
      message: errorMessages,
    })
  }

  const email = req.body.email
  const firstName = req.body.fname
  const lastName = req.body.lname
  const password = req.body.password
  const orcid = req.body.orcid
  const accessToken = req.body.accessToken
  const refreshToken = req.body.refreshToken

  // First check if the email already exists
  models.User.findOne({ where: { email: email } })
    .then((existingUser) => {
      if (existingUser) {
        // Email already exists, return a 400 error
        return res.status(400).json({
          message: 'E-Mail address already exists!',
        })
      }

      // Email doesn't exist, proceed with password hashing and user creation
      return models.User.hashPassword(password)
    })
    .then((passwordHash) => {
      if (!passwordHash) {
        return res.status(500).json({
          message: 'Error hashing password',
        })
      }

      const userModel = new models.User({
        email: email,
        password_hash: passwordHash,
        fname: firstName,
        lname: lastName,
        orcid: orcid,
        orcid_access_token: accessToken,
        orcid_refresh_token: refreshToken,
        active: true, // Assuming a new user should be active. Change this based on your requirements.
      })
      return userModel.save({ user: userModel })
    })
    .then((result) => {
      if (!result) {
        return res.status(500).json({
          message: 'Error creating user',
        })
      }

      res.status(201).json({
        message: 'User created!',
        userId: result._id,
      })
    })
    .catch((err) => {
      console.error('Error in signup:', err)
      return res.status(500).json({
        message: 'An error occurred during user registration',
        error: err.message,
      })
    })
}

export { getUsers, signup, getProfile, updateProfile, searchInstitutions }
