const { transaction } = require('objection')
const _ = require('lodash')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')

const { trimSpacesGlobally } = require('util/string')
const error = require('error')

const userRepo = require('repo/user')
const User = require('db/model/User')
const knex = User.knex()

async function signToken (data) {
  return jwt.sign(data, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE })
}

async function signunp ({ fullname, ...data }) {
  return transaction(knex, async (trx) => {
    const generateUsername = generateUsernameFromFullname(trx)

    const user = await userRepo.trx(trx).create({
      username: await generateUsername(fullname),
      fullname,
      ...data,
    })

    return signToken({ user })
  })
}

async function signin ({ email, password }) {
  const { password: hashedPw, ...user } = await userRepo.getByEmail(email)

  return bcrypt.compare(password, hashedPw)
  .then(r => {
    if (!r) throw error('user.password_wrong')
    return { token: signToken({ user }) }
  })
}

function generateUsernameFromFullname (trx = knex) {
  return async fullname => {
    const user = await userRepo.trx(trx).getByFullname(fullname)
    const len = user.length

    let generatedUsername

    if (len === 1) {
      generatedUsername = `${trimSpacesGlobally(fullname)}1`
    } else if (len > 1) {
      const { username } = _.last(user)
      const lastChar = _.last(_.split(username, ''))

      generatedUsername = `${trimSpacesGlobally(fullname)}${_.toNumber(lastChar) + 1}`
    } else {
      generatedUsername = trimSpacesGlobally(fullname)
    }

    return generatedUsername
  }
}

module.exports = {
  generateUsernameFromFullname,
  signin,
  signunp,
}
