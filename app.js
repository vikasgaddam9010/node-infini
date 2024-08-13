const express = require('express')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const path = require('path')
const bcrypt = require('bcrypt')
const jwttoken = require('jsonwebtoken')
const cors = require('cors')

const app = express()
app.use(cors({origin: '*'}))
app.use(express.json())

let dataBase

const serverStart = async () => {
  try {
    dataBase = await open({
      filename: path.join(__dirname, 'photoShopeData.db'),
      driver: sqlite3.Database,
    })
    console.log('Server has started...')
  } catch (e) {
    console.log(e.message)
    process.exit(1)
  }
}

serverStart()

const check = (req, res, next) => {
  const jwt = req.headers.authorization.split(' ')[1]
  if (jwt === undefined) {
    res.status(401)
    res.send('Invalid JWT Token')
  } else {
    jwttoken.verify(jwt, 'encryptedKey', async (err, payload) => {
      if (err) {
        res.status(401)
        res.send('Invalid JWT Token')
      } else {
        req.username = payload.username
        next()
      }
    })
  }
}

app.post('/register/', async (req, res) => {
  const {id, username, password} = req.body
  //console.log(id, username, password)

  const checkUserNameInDb = await dataBase.get(
    `SELECT * FROM users WHERE username = '${username}';`,
  )
  if (checkUserNameInDb === undefined) {
    const hasedPassword = await bcrypt.hash(password, 10)
    await dataBase.run(
      `INSERT INTO users (id, username, password) VALUES ('${id}', '${username}', '${hasedPassword}');`,
    )
    res.status(200).send({message: 'User Added'})
  } else {
    res.status(400).send({message: 'Username already Existing.'})
  }
})

//API - 1
app.post('/log-in/', async (req, res) => {
  const {username, password} = req.body
  const dbRes = await dataBase.get(
    `SELECT * FROM users WHERE username = '${username}';`,
  )

  if (dbRes === undefined) {
    res.status(400).send({message: 'Invalid user'})
  } else {
    const checkPassword = await bcrypt.compare(password, dbRes.password)
    if (checkPassword) {
      const jwtToken = jwttoken.sign({username}, 'encryptedKey')
      res.status(200).send({message: 'Sucess', jwtToken})
    } else {
      res.status(400).send({message: 'Invalid Password'})
    }
  }
})

//API - 2
app.get('/get-events/', check, async (req, res) => {
  try {
    const username = req.username

    const query = `SELECT * FROM user_uploaded WHERE username = ?`
    const params = [username]

    const dbRes = await dataBase.all(query, params)

    const queryID = `SELECT * FROM users WHERE username = ?`
    const paramsID = [username]

    const dbResID = await dataBase.get(queryID, paramsID)

    if (dbRes.length === 0) {
      return res.status(404).send({
        message: 'No records found for the specified username.',
        dbRes: [],
      })
    }

    res.status(200).json({dbRes, username: req.username, id: dbResID.id})
  } catch (error) {
    console.error('Database query error:', error.message)

    res
      .status(500)
      .send({message: 'An error occurred while processing your request.'})
  }
})

//API - 3
app.post('/add-events/', check, async (req, res) => {
  const {eventId, eventTitle, fileUrls} = req.body
  const dbRes = await dataBase.run(
    `INSERT INTO user_uploaded (event_id, username, event_title, uploads) VALUES ('${eventId}', '${req.username}', '${eventTitle}', '${fileUrls}');`,
  )
  res
    .status(200)
    .send({message: 'Event Details Added...', dbRes, username: req.username})
})

app.get('/all-items/:event_id/', check, async (req, res) => {
  const {event_id} = req.params
  const dbRes = await dataBase.get(
    `SELECT * FROM user_uploaded WHERE event_id = '${event_id}';`,
  )
  res.status(200).send({dbRes})
})

app.listen(3000)

module.exports = app
