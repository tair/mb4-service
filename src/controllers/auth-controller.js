import jwt from 'jsonwebtoken'
import axios from 'axios'
import qs from 'qs'
import Sequelize, { Op } from 'sequelize'
import { Buffer } from 'node:buffer'
import { validationResult } from 'express-validator'
import { models } from '../models/init-models.js'
import { EmailManager } from '../lib/email-manager.js'
import { getFormattedDateTime } from '../util/util.js'
import UserAuthenticationHandler from '../lib/user-authentication-handler.js'
import ReviewerAuthenticationHandler from '../lib/reviewer-authentication-handler.js'
import config from '../config.js'

// The types of handlers that are accepted by Morphobank.
const authenticationHandlers = [
  new UserAuthenticationHandler(),
  new ReviewerAuthenticationHandler(),
]

async function login(req, res, next) {
  const errors = validationResult(req.body)
  if (!errors.isEmpty()) {
    const error = new Error('Validation failed.')
    error.statusCode = 422
    error.data = errors.array()
    throw error
  }

  const email = req.body.email
  const password = req.body.password

  if (!email || !password) {
    const error = new Error('Missing email or password.')
    error.statusCode = 401
    next(error)
    return
  }

  try {
    for (const handler of authenticationHandlers) {
      if (handler.canHandle(email)) {
        const userResponse = await handler.handle(email, password)
        // link with orcid profile
        if (req.body.orcid) {
          let user = await models.User.findOne({ where: { email: email } })
          if (!user.orcid) {
            const orcidProfile = req.body.orcid
            user.orcid = orcidProfile.orcid
            user.orcid_access_token = orcidProfile.accessToken
            user.orcid_refresh_token = orcidProfile.refreshToken
            try {
              await user.save({ user: user }) // need user for changelog hook
            } catch (error) {
              console.log('Save user orcid failed')
              console.error(error)
            }
          }
        }
        const accessToken = generateAccessToken(userResponse)
        const expiry = getTokenExpiry(accessToken)
        res.cookie('authorization', `Bearer ${accessToken}`, {
          expires: new Date(expiry * 1000),
          httpOnly: true,
        })
        res.status(200).json({
          accessToken: accessToken,
          accessTokenExpiry: expiry,
          user: userResponse,
        })
        return
      }
    }

    const error = new Error('Not a valid user name')
    error.statusCode = 401
    next(error)
    return
  } catch (e) {
    next(e)
  }
}

function logout(req, res) {
  res.clearCookie('authorization')
  res.status(200).json({ message: 'Log out succeeded!' })
}

async function resetPassword(req, res) {
  const errors = validationResult(req.body)
  if (!errors.isEmpty()) {
    const error = new Error('Validation failed.')
    error.statusCode = 422
    error.data = errors.array()
    throw error
  }

  const email = req.body.email

  // unlikely to happen, UI requires an email addressx
  if (!email) {
    res.status(400).json({message: 'Missing email.'})
    return
  }

  try {

    let user = await models.User.findOne({ where: { email: email } })

    if (!user) {
      res.status(400).json({message: 'Email address does not exist.'})
      return
    }

    const resetKey = user.getResetPasswordKey()
    const resetPasswordUrl = `${config.app.frontendDomain}/users/set-new-password?key=${resetKey}`

    const emailManager = new EmailManager()
    // not using the message for now
    const message = await emailManager.email('reset_password_instruction', {
      resetPasswordUrl,
      to: email,
    })

    res.status(200).json({
      message: "Sent reset password email!"
    })
  } catch (error) {
    console.log('Send reset password email failed!')
    console.error(error)
    let status = 400
    if (error.response && error.response.status)
      status = error.response.status
    res.status(status).json(error)
    return
  }

}

async function validateResetKey(req, res) {
  const resetKey = req.query.resetKey

  if (!resetKey) {
    res.status(400).json({message: 'Missing reset key.'})
    return
  }

  try {
    let resetKeyClean = resetKey.replace(/[^A-Za-z0-9]+/g, '');
    let users = await findUserByResetKey(resetKeyClean);

    // in case a user is not found or find more than one users
    if (users.length != 1) {
      res.status(400).json({"message": "Invalid reset key"})
    } else {
      res.status(200).json({"message": "Valid reset key"})
    }
  } catch (error) {
    console.log('Validate Reset key failed')
    console.error(error)
    let status = 400
    if (error.response && error.response.status)
      status = error.response.status
    res.status(status).json(error)
    return
  }
}

async function findUserByResetKey(resetKey) {
  const users = await models.User.findAll({
    attributes: ['user_id', 'email'],
    where: Sequelize.where(
      Sequelize.fn(
        'md5',
        Sequelize.fn('concat', Sequelize.col('user_id'), '/', Sequelize.fn('IFNULL', Sequelize.col('password_hash'), ''))
      ),
      resetKey
    )
  });
  return users;
}

async function setNewPassword(req, res) {
  const resetKey = req.body.resetKey
  const password = req.body.password

  if (!resetKey) {
    res.status(400).json({message: 'Missing reset key.'})
    return
  }

  if (!password) {
    res.status(400).json({message: 'Missing password'})
    return
  }

  try {
    let resetKeyClean = resetKey.replace(/[^A-Za-z0-9]+/g, '');
    let users = await findUserByResetKey(resetKeyClean);

    // in case a user is not found or find more than one users
    if (users.length != 1) {
      res.status(400).json({"message": "Invalid reset key"})
      return
    }

    let user = users[0]
    let passwordHash = await models.User.hashPassword(password)
    user.password_hash = passwordHash
    await user.save({ user: user })

    const emailManager = new EmailManager()
    let time = getFormattedDateTime()
    // not using the message for now
    const message = await emailManager.email('reset_password_notification', {
      time,
      to: user.email,
    })

    res.status(200).json({
      message: "Set new password succeeded!"
    })
  } catch (error) {
    console.log('Validate Reset key failed')
    console.error(error)
    let status = 400
    if (error.response && error.response.status)
      status = error.response.status
    res.status(status).json(error)
    return
  }
}


async function getORCIDAuthUrl(req, res) {
  const url = `${config.orcid.domain}/oauth/authorize?client_id=${config.orcid.clientId}\
&response_type=code&scope=/authenticate&redirect_uri=${config.orcid.redirect}`
  // url below is available for member API
  // const url = `${config.orcid.domain}/oauth/authorize?client_id=${config.orcid.clientId}\
  // &response_type=code&scope=/read-limited&redirect_uri=${config.orcid.redirect}`
  res.status(200).json({ url: url })
}

async function authenticateORCID(req, res) {
  // find the current logged in user
  let loggedInUser = null

  try {
    if (req.credential) {
      loggedInUser = await models.User.findByPk(req.credential.user_id)
    }
  } catch (error) {
    console.log('Get logged in user failed')
    console.error(error)
    let status = 400
    if (error.response && error.response.status) status = error.response.status
    res.status(status).json(error)
    return
  }

  // compose ORCID authentication request
  const authCode = req.body.authCode
  const authUrl = `${config.orcid.domain}/oauth/token`
  const data = {
    client_id: config.orcid.clientId,
    client_secret: config.orcid.cliendSecret,
    grant_type: 'authorization_code',
    redirect_uri: config.orcid.redirect,
    code: authCode,
  }
  const options = {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  }

  axios
    .post(authUrl, qs.stringify(data), options)
    .then(async (response) => {
      const orcid = response.data.orcid
      const name = response.data.name
      const orcidAccessToken = response.data.access_token
      const orcidRefreshToken = response.data.refresh_token
      const orcidProfile = {
        orcid: orcid,
        name: name,
        access_token: orcidAccessToken,
        refresh_token: orcidRefreshToken,
      }

      // check if a user is already linked to the ORCID
      // if so, login the user
      let userWithOrcid = await models.User.findOne({ where: { orcid: orcid } })
      // flag to instruct frontend whether to redirect to profile page
      let redirectToProfile = false

      // in case the orcid user and the logged in user is not the same account - happens if two users try to
      // link the same ORCID profile
      if (
        userWithOrcid &&
        loggedInUser &&
        loggedInUser.user_id != userWithOrcid.user_id
      ) {
        res.status(400).json({
          message:
            'Another user with the same ORCID already exists in our system.',
        })
        return
      }

      // handle case when the logged in user links ORCID to their profile
      if (loggedInUser) {
        if (loggedInUser.orcid) {
          // in case current user's orcid is different - shall not happen since we do not display link option
          // for users who already have ORCID
          if (loggedInUser.orcid != orcid) {
            res.status(400).json({
              message:
                'The ORCID you linked is different from the ORCID of the current user.',
            })
            return
          }
        } else {
          // add orcid and 3-legged access token to the current user
          loggedInUser.orcid = orcid
          loggedInUser.orcid_access_token = orcidAccessToken
          loggedInUser.orcid_refresh_token = orcidRefreshToken
          try {
            await loggedInUser.save({ user: loggedInUser }) // need user for changelog hook
          } catch (error) {
            console.log('Save user orcid failed')
            console.error(error)
            res.status(400).json(error)
            return
          }
          userWithOrcid = loggedInUser
          // redirect to profile page since the user just linked their ORCID
          redirectToProfile = true
        }
      }

      if (userWithOrcid) {
        let userResponse = {
          name: userWithOrcid.getName(),
          email: userWithOrcid.email,
          user_id: userWithOrcid.user_id,
        }
        const accessToken = generateAccessToken(userResponse)
        const expiry = getTokenExpiry(accessToken)
        res.cookie('authorization', `Bearer ${accessToken}`, {
          expires: new Date(expiry * 1000),
          httpOnly: true,
        })
        res.status(200).json({
          accessToken: accessToken,
          accessTokenExpiry: expiry,
          user: userResponse,
          orcidProfile: orcidProfile,
          redirectToProfile: redirectToProfile,
        })
        return
      }

      // find potential users by email
      const userRecordUrl = `${config.orcid.apiDomain}/v3.0/${orcid}/email`
      const recordReqOptions = {
        headers: {
          Accept: 'application/orcid+json',
          Authorization: `Bearer ${config.orcid.clientAccessToken}`,
        },
      }

      try {
        const emailRes = await axios.get(userRecordUrl, recordReqOptions)
        if (emailRes.data && emailRes.data.email) {
          const emails = emailRes.data.email.map((email) => email.email)
          for (let i in emails) {
            const potentialUserByEmail = await models.User.findOne({
              where: { email: emails[i] },
              attributes: ['user_id', 'email'],
            })
            if (potentialUserByEmail) {
              res.status(200).json({
                user: null,
                potentialUserByEmail: potentialUserByEmail,
                orcidProfile: orcidProfile,
              })
              return
            }
          }
        }
      } catch (error) {
        console.log('Get user orcid emails failed')
        console.error(error)
        let status = 400
        if (error.response && error.response.status)
          status = error.response.status
        res.status(status).json(error)
        return
      }

      // find potential users by name
      const potentialUsers = await models.User.findAll({
        where: Sequelize.where(
          Sequelize.fn(
            'LOWER',
            Sequelize.fn(
              'concat',
              Sequelize.col('fname'),
              ' ',
              Sequelize.col('lname')
            )
          ),
          { [Op.like]: `%${name.toLowerCase()}%` }
        ),
      })

      if (potentialUsers && potentialUsers.length > 0) {
        const potentialUsersArray = potentialUsers.map((user) => ({
          email: user.email,
          user_id: user.user_id,
          name: user.getName(),
        }))
        res.status(200).json({
          user: null,
          potentialUsersByName: potentialUsersArray,
          orcidProfile: orcidProfile,
        })
        return
      }

      // return the orcid profile alone when no associated user and no potential user
      res.status(200).json({
        orcidProfile: orcidProfile,
      })
    })
    .catch((error) => {
      console.log('authenticate orcid user failed')
      console.error(error)
      let status = 400
      if (error.response && error.response.status)
        status = error.response.status
      res.status(status).json(error)
    })
}

function generateAccessToken(user) {
  return jwt.sign(user, config.auth.accessTokenSecret, {
    expiresIn: config.auth.jwtTokenExpiresIn,
  })
}

function getTokenExpiry(token) {
  const payload = Buffer.from(token.split('.')[1], 'base64')
  const expiry = JSON.parse(payload).exp // expiry in seconds
  return expiry
}

export { login, logout, getORCIDAuthUrl, authenticateORCID, resetPassword, validateResetKey, setNewPassword }
