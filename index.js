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

function saveExecDelete(res, req, httpMethod, method) {
    
    sqlproc.saveIncomeData(req, httpMethod, (err, reqUid, pPool) => {

        if (err) {
            
            return res.send( { success: false, error: err } )
            
        } else {
            
            sqlproc.saveRequestToId( reqUid, pPool, req.query, (error, reqUid, pPool) => {
        
                if (error) {
                    
                    res.json({ success: false, message: error.message })

                } else {

                    method(pPool, (error, result) => {

                        if (error) {
                            
                            pPool.request()
                            .input('id', reqUid)
                            .input('error', true)
                            .input('message', error.message)
                            .query('update requests set error = @error, message = @message where id = @id')
                            .then(() => {
            
                                res.json({ success: false, message: error.message })
            
                            })
                            .catch((error) => {
                                
                                res.json({ success: false, message: error.message })
                                
                            })

                        } else {

                            sqlproc.deleteRequestAfterExecute(pPool, reqUid, error => {

                                if (error) {
                                    
                                    res.json({ success: false, message: error.message })

                                } else {

                                    res.json({ success: true, result })

                                }

                            })

                        }

                    })

                            
                }

            })

        }

    })


}


app.get('/', cors(), (req, res) => {

    saveExecDelete(res, req, 'GET', (pool, callback) => { 
        callback(false, []) 
    })

})

app.get('/login', cors(), (req, res) => {

    saveExecDelete(res, req, 'GET', (pool, callback) => { 

        const user = req.query.user
        const password = req.query.password

        pool.request()
          .input('name', sql.Char, user)
          .input('password', sql.Char, password)
          .query('select * from users where name = @name and password = @password')

        .then(result => {

            if (result.recordset.length) {

                callback(false, result.recordset[0])

            } else {

                callback( { message: 'not found' } )

            }

        }).catch(err => {

            callback( err.message )

        })
        
    })

})
  
  
app.listen(port, () => {
    console.log(`Listening on port ${port}`)
})
  
  
  

