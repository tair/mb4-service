import express from 'express';
import bcrypt from 'bcrypt';
import userModel from '../models/user.js';
import {validationResult} from 'express-validator';

function getUsers(req, res, next) {
  userModel
    .findAll({ attributes: ['user_id', 'email'] })
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

function signup(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    const error = new Error('Validation failed.')
    error.statusCode = 422
    error.data = errors.array()
    throw error
  }

  const email = req.body.email
  const name = req.body.name
  const password = req.body.password

  bcrypt
    .hash(password, 10)
    .then((hashedPw) => {
      const user = new userModel({
        email: email,
        password: hashedPw,
        name: name,
      })
      return user.save()
    })
    .then((result) => {
      res.status(201).json({ message: 'User created!', userId: result._id })
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 500
      }
      next(err)
    })
}

export {getUsers, signup}
