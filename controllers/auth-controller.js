import bcrypt from 'bcrypt'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import process from 'node:process'
import { Buffer } from 'node:buffer'
import { models } from '../models/init-models.js'
import { validationResult } from 'express-validator'
import config from '../config.js'
import axios from 'axios'
import qs from 'qs'
import { Op } from 'sequelize'
import Sequelize from 'sequelize'


function isTokenExpired(token) {
  return Math.floor(new Date().getTime() / 1000) >= getTokenExpiry(token)
}

function getTokenExpiry(token) {
  const payload = Buffer.from(token.split('.')[1], 'base64')
  const expiry = JSON.parse(payload).exp // expiry in seconds
  return expiry
}

function authenticateToken(req, res, next) {
  const authHeader = req.cookies['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  // Return 401 when token is not present in the header.
  if (token == null) {
    return res.status(401).json({ message: 'Auth token not found.' })
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    // Return 403 when the token is present but invalid.
    if (err) {
      return res.status(403).json({ message: 'Auth token is invalid.' })
    }

    if (isTokenExpired(token)) {
      return res.status(403).json({ message: 'Auth token expired.' })
    }

    req.user = user
    next()
  })
}

async function maybeAuthenticateToken(req, res, next) {
  const authHeader = req.cookies['authorization']
  const token = authHeader && authHeader.split(' ')[1]
  if (token == null) {
    next()
    return
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    if (!err) {
      req.user = user
    }
    next()
  })
}

async function login(req, res, next) {
  const errors = validationResult(req.body)
  if (!errors.isEmpty()) {
    const error = new Error('Validation failed.')
    error.statusCode = 422
    error.data = errors.array()
    throw error
  }

  const email = req.body.email

  const user = await models.User.findOne({ where: { email: email } })

  if (!user) {
    const error = new Error('A user with this email could not be found.')
    error.statusCode = 401
    next(error)
    return
  }

  const password = req.body.password
  const passwordHash = crypto.createHash('md5').update(password).digest('hex')

  // The password stored in the MorphoBank database uses the password_hash and password_verify
  // methods which use the Crypt algorithm instead. To make this compatible with the Bcrypt
  // algorithm, we replace the algorithm part of the string, as suggested by:
  // https://stackoverflow.com/questions/23015043
  const storedPassword = user.password_hash.replace('$2y$', '$2a$')

  const passwordMatch = await bcrypt.compare(passwordHash, storedPassword)
  if (!passwordMatch) {
    const error = new Error('Wrong password!')
    error.statusCode = 401
    next(error)
    return
  }

  const userResponse = {
    email: user.email,
    user_id: user.user_id,
    name: user.getName(),
  }
  const accessToken = generateAccessToken(userResponse)
  const expiry = getTokenExpiry(accessToken)
  res.cookie('authorization', `Bearer ${accessToken}`, {
    expires: new Date(expiry * 1000),
    httpOnly: true,
  })
  res.status(200).json({ accessToken: accessToken, user: userResponse })
}

function generateAccessToken(user) {
  return jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: process.env.JWT_TOKEN_EXPIRES_IN,
  })
}

async function getORCIDAuthUrl(req, res) {
  const url = `${config.orcid.domain}/oauth/authorize?client_id=${config.orcid.clientId}\
&response_type=code&scope=/authenticate&redirect_uri=${config.orcid.redirect}`
  res.status(200).json({ url: url})
}

async function authenticateORCID(req, res) {
  // find the current logged in user
  let loggedInUser = null

  try {
    if (req.user) {
      loggedInUser = await models.User.findByPk(req.user.user_id)
    }
  } catch(error) {
    console.error(error);
    let status = 400;
    if (error.response && error.response.status) status = error.response.status
    res.status(status).json(error)
    return
  }

  // compose ORCID authentication request
  const authCode = req.body.authCode
  const url = `${config.orcid.domain}/oauth/token`
  const data = {
    client_id: config.orcid.clientId,
    client_secret: config.orcid.cliendSecret,
    grant_type: 'authorization_code',
    redirect_uri: config.orcid.redirect,
    code: authCode
  }
  const options = {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  }

  axios.post(url, qs.stringify(data), options)
  .then(async response => {
    const orcid = response.data.orcid
    const name = response.data.name

    // check if a user is already linked to the ORCID
    // if so, login the user
    let user = await models.User.findOne({ where: { orcid: orcid } })

    // in case the orcid user and the logged in user is not the same account - shall not happen
    if (user && loggedInUser && loggedInUser.user_id != user.user_id) 
      throw new Error("User by ORCID and the current user is different.")
    
    if (loggedInUser) {
      if (loggedInUser.orcid) {
        // in case current user's orcid is different - shall not happen
        if (loggedInUser.orcid != orcid) throw new Error("ORCID is different from the ORCID of the current user")
      } else {
        // add orcid to the current user
        loggedInUser.orcid = orcid
        try {
          await loggedInUser.save({ user:loggedInUser }) // need user for changelog hook
        } catch (error) {
          console.error(error)
          res.status(400).json(error)
          return
        }
        user = loggedInUser
      }
    }

    if (user) {
      let userResponse = {
        email: user.email,
        user_id: user.user_id,
        name: user.getName(),
      }
      const accessToken = generateAccessToken(userResponse)
      const expiry = getTokenExpiry(accessToken)
      res.cookie('authorization', `Bearer ${accessToken}`, {
        expires: new Date(expiry * 1000),
        httpOnly: true,
      })
      res.status(200).json({ 
        accessToken: accessToken, 
        user: userResponse,
        orcidProfile: response.data
      })
      return
    }

    // find potential users by name
    const potentialUsers = await models.User.findAll({
      where: Sequelize.where(
        Sequelize.fn('LOWER', Sequelize.fn('concat', Sequelize.col('fname'), ' ', Sequelize.col('lname'))),
        { [Op.like]: `%${name.toLowerCase()}%` }
      )
    });

    if (potentialUsers) {
      const potentialUsersArray = potentialUsers.map(user => ({
        email: user.email,
        user_id: user.user_id,
        name: user.getName()
      }));
      res.status(200).json({
        user: null,
        potentialUsers: potentialUsersArray,
        profile: response.data
      })
      return
    }

    // return the orcid profile only when no associated user and no potential user
    res.status(200).json({
      profile: response.data
    })

  }).catch(error => {
    console.error(error);
    let status = 400;
    if (error.response && error.response.status) status = error.response.status
    res.status(status).json(error)
  });
}

export { authenticateToken, login, maybeAuthenticateToken, getORCIDAuthUrl, authenticateORCID }
