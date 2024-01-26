import express from 'express'

import sql from 'mssql'
import sqlconfig from './sqlconfig.js'
import sqlproc from './sqlproc.js'


import cors from 'cors'
import bodyParser from 'body-parser'

import { v4 as uuidv4, NIL as uuidNil } from 'uuid'

import conn from './connections.js'

import datestr from './datestr.js'

import fs from "fs"

const config = sqlconfig.config

process.env.TZ = 'Europe/Moscow'


const app = express()

app.use(cors())
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }))
app.use(bodyParser.json({limit: '50mb'}))
app.use(bodyParser.raw({limit: '50mb'}))



const port = conn.port

app.get('/', (req, res) => {
  res.send('Hello World!!!!!!!')
})


app.listen(port, () => {
    console.log(`Listening on port ${port}`)
})
  
  
  

