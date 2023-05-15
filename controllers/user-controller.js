import bcrypt from 'bcrypt'
import crypto from 'crypto'
import { validationResult } from 'express-validator'
import { models } from '../models/init-models.js'

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
  models.User.findByPk(req.user.user_id, {
      attributes: ['fname', 'lname', 'email', 'orcid'],
      include: [{ 
        model: models.Institution,
        as: 'institutions',
        attributes: ['institution_id', 'name'] 
      }],
  }).then ((profile) => {
    return res.status(200).json(profile)
  })   
  .catch((err) => {
    if (!err.statusCode) {
      err.statusCode = 500
    }
    next(err)
  })
}

function signup(req, res, next) {
  const errors = validationResult(req.body)
  if (!errors.isEmpty()) {
    const error = new Error('Validation failed.')
    error.statusCode = 422
    error.data = errors.array()
    throw error
  }

  const email = req.body.email
  const firstName = req.body.fname
  const lastName = req.body.lname
  const password = req.body.password
  const md5Password = crypto.createHash('md5').update(password).digest('hex')
  bcrypt
    .hash(md5Password, 10)
    .then((passwordHash) => {
      const userModel = new models.User({
        email: email,
        password_hash: passwordHash,
        fname: firstName,
        lname: lastName,
      })
      return userModel.save()
    })
    .then((result) => {
      res.status(201).json({
        message: 'User created!',
        userId: result._id,
      })
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 500
      }
      next(err)
    })
}

export { getUsers, signup, getProfile }
