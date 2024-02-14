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

app.post('/login', cors(), (req, res) => {

    const user = req.body.user
    const password = req.body.password

    saveExecDelete(res, req, 'POST', (pool, callback) => { 

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

app.post('/insertrecord', cors(), (req, res) => {

    saveExecDelete(res, req, 'POST', (pool, callback) => { 

        const params = req.body
  
        if (params.name == 'route_journal') {
          params.record.ip =  req.header("x-forwarded-for") || req.socket.remoteAddress
        }
  
        sqlproc.insertRecord(pool, params, err => {
              
           callback( err ) 
  
        })
  
  
    })
  
  })
  
app.post('/updaterecord', cors(), (req, res) => {

    saveExecDelete(res, req, 'POST', (pool, callback) => { 

        const params = req.body
  
        const idName = params.fields[0]
  
        var objectParams = {
          table: params.name,
          name: idName, 
          type: sql.Char, 
          value: params.record[idName],
          author_id: params.record.author_of_changes_id
      }
  
      sqlproc.savePredVersion(pool, objectParams, err => {
  
          if (err) { 
            callback( err ) 
        } 
          else { 
              
            sqlproc.updateRecord(pool, params, err => {
              
                callback( err ) 
            })
  
        }
  
      })
    
  
    })
  
  })
  
  


  app.post('/gettable', cors(), (req, res) => {

    saveExecDelete(res, req, 'POST', (pool, callback) => { 
  
       getTableData(pool, req.body, (err, result) => {

           callback( err, result ) 
        
       })
  
  
    })
  
  })
  
  function getTableData(pPool, bTable, callback) {
    
        var curTop = bTable.top || 20
  
        var curTableName = bTable.name
        var curfields = bTable.fields || []
        var curSearch = bTable.search
        var curFilter = bTable.filter || []
        var curAccessFilter = bTable.accessFilter
        var curOrder = bTable.order
        var curGroup = bTable.group
        var curJoins = bTable.joins || []
        var curParams = bTable.params || []
  
  
        if(curAccessFilter){
  
            curAccessFilter.forEach(f => {
  
                curFilter.push(f)
  
            })
  
        }
  
        var strFields = []
        var strJoins = []
        var strSearchs = []
        var strXlsFields = []
  
        curfields.forEach((field, index) =>{
  
            if (typeof(field) == 'string') {
                
                strFields.push(curTableName + '.' + field)
  
                strXlsFields.push(field)
  
                if(curSearch){
  
                    strSearchs.push(curTableName + '.' + field + ' like \'%' + curSearch + '%\'')
  
                }
  
            } else {
                
                strFields.push(curTableName + '.' + field.name)
  
                if (field.table) {
                    
                    const curFields = field.fields || []
  
                    let curAlias = field.table + index.toString()
  
                    if (field.description && typeof(field.description) == 'object') {
                        
                        var curDesc = []
  
                        field.description.forEach(d => {
                        
                            curDesc.push(curAlias + '.' + d)
                            curDesc.push('\' \'')
                            
                        })
  
                        strFields.push('(' + curDesc.join('+') + ')' + ' as ' + field.name + '_str')
  
                    } else {
                        
                        strFields.push(curAlias + '.' + (field.description || 'name') + ' as ' + field.name + '_str')
                    }
  
                    strJoins.push('left join ' + field.table + ' as ' + curAlias + ' on ' + curTableName + '.' + field.name + '=' + curAlias + '.' + (field.key || 'id'))
  
                    strXlsFields.push(field.name + '_str')
  
                    if(curSearch){
  
                        strSearchs.push(curAlias + '.name like \'%' + curSearch + '%\'')
  
                    }
  
                    curFields.forEach(cf => {
  
                        strFields.push(curAlias + '.' + cf + ' as ' + field.table + '_' + cf)
  
                        strXlsFields.push(field.table + '_' + cf)
                        
  
                    })
  
                }
  
  
            }
  
  
        })
  
        curJoins.forEach(curj => {
  
            if ( Array.isArray(curj.field) ) {
                
                curj.field.forEach(f => {
                
                    strFields.push(f)
                    
                    let cfield = f.split(' as ')
  
                    strXlsFields.push(cfield[cfield.length - 1])
  
                })
  
            } else {
                
                strFields.push(curj.field)
  
                let cfield = curj.field.split(' as ')
  
                strXlsFields.push(cfield[cfield.length - 1])
  
            }
  
            strJoins.push(curj.table)
            
        })
  
        let filterStr = (curFilter && curFilter.length) ? curFilter.join(' and ') : null 
        let searchStr = (strSearchs && strSearchs.length) ? strSearchs.join(' or ') : null 
  
        let queryText = 'select top ' + curTop + ' ' + (strFields.length ? strFields.join(', ') : '*') + ' from ' + curTableName + (strJoins ? ' ' + strJoins.join(' ') : '') 
  
                + (filterStr || searchStr ? ' where ' + (filterStr ? filterStr : '') 
                    + (filterStr && searchStr ? ' and ( ' : '') + (searchStr ? searchStr : '') : '') + (filterStr && searchStr ? ' ) ' : '')
            
                + (curGroup ? ' group by ' + curGroup.join(', ') : '')
                + (curOrder ? ' order by ' + curOrder.join(', ') : '')
  
        curParams.forEach(cp => { 
          if (cp.name == undefined || cp.value == undefined) {
            for (let key in cp) {
              cp.name = key
              cp.value = cp[key];
            }
          }
          cp.type = sql[cp.type ? cp.type : 'Char'] 
  
        });
  
        sqlproc.sqlreq(pPool, curParams, queryText, (err, result) => {
  
            callback(err, err ? [] : result.recordset)

          })
  
  
  }
  
    
  function writeToFile(file_exist, id, req, callback, callbackerror) {

    let filespath = 'I:\\Attachments\\'
  
    if(file_exist){
  
        fs.appendFile(filespath + id + '.tmp', req.body, function (err, data) {
  
            if (err) {
  
                callbackerror(err)
  
            } else {
  
                callback()
  
            }
  
        })
  
    } else {
  
        fs.writeFile(filespath + id + '.tmp', req.body, function (err, data) {
  
            if (err) {
  
                callbackerror(err)
  
            } else {
  
                callback()
  
            }
  
        })
    }
  }
  
  app.post('/upload', cors(), (req, res) => {
  
    var id = ''
    var filename = ''
    var part = ''
    var size = ''
    var user_id = ''
    var user = ''
    var owner_name = ''
    var owner_id = ''
    req.rawHeaders.forEach((element, index, array) => {
        if(element === 'id')
            id = array[index + 1]
            
        if(element === 'filename')
            filename = array[index + 1]
            
        if(element === 'part')
            part = Number(array[index + 1])
        
        if(element === 'size')
            size = Number(array[index + 1])
  
        if(element === 'user_id')
          user_id = (array[index + 1])
  
        if(element === 'user')
          user = (array[index + 1])
  
        if(element === 'owner_name')
            owner_name = (array[index + 1])
  
        if(element === 'owner_id')
            owner_id = (array[index + 1])
  
        })
  
    var pPool = null
  
    var file_exist = false
  
    sql.connect(config).then(pool => {
  
        pPool = pool
  
        return pool.request()
            .input('id', id)
            .query('select * from files where id = @id')
  
    }).then(result => {
  
        file_exist = result.recordset.length > 0
  
        writeToFile(file_exist, id, req, () => {
  
            if(file_exist) {
  
                pPool.request()
                    .input('id', id)
                    .input('size', result.recordset[0].size + size)
                    .query('update files set size = @size where id = @id')
                    .then(result => {
                        
                        res.json({ 'success': true, 'message': '' })
                    })
                    .catch(err => {
  
                        res.json({ 'success': false, 'message': err.message })
                
                    })
  
            } else {
  
                let words = filename.split('.')
                let ext = words[words.length - 1]
  
                words.splice(words.length - 1, 1)
  
                filename = words.join('.')
  
                pPool.request()
                .input('user_id', sql.Char, user_id)
                .input('user', sql.Char, user)
                .query('select * from users where id = @user_id or name = @user')
                    .then(result => {
  
                        var user_id = result.recordset[0].id
  
                        pPool.request()
                            .input('id', sql.Char, id)
                            .input('name', sql.Char, decodeURIComponent(filename))
                            .input('ext', sql.Char, ext)
                            .input('comment', sql.Char, '')
                            .input('size', sql.Int, size)
                            .input('date', sql.Char, datestr.dateToStr(new Date()))
                            .input('is_deleted', sql.Bit, 0)
                            .input('is_folder', sql.Bit, 0)
                            .input('parent_id', sql.Char, uuidNil)
                            .input('author_id', sql.Char, user_id)
                            .query('insert into files (id, name, ext, comment, size, date, is_deleted, is_folder, parent_id, author_id) '
                                + 'values (@id, @name, @ext, @comment, @size, @date, @is_deleted, @is_folder, @parent_id, @author_id) ')
                            .then(result => {
  
                                if(owner_id){
  
                                    if(owner_name === 'file_versions'){
  
                                        pPool.request()
                                            .input('file_id', sql.Char, owner_id)
                                            .query('select top 1 * from file_versions where file_id = @file_id order by number desc')
                                            .then(result => {
  
                                                var lastNumber = 0
                                                if(result.recordset.length > 0){
                                                
                                                    lastNumber = result.recordset[0].number
                                                    
                                                }
  
  
                                                pPool.request()
                                                    .input('id', sql.Char, id)
                                                    .input('file_id', sql.Char, owner_id)
                                                    .input('number', sql.SmallInt, lastNumber + 1)
                                                    .input('comment', sql.Char, '')
                                                    .input('date', sql.Char, datestr.dateToStr(new Date()))
                                                    .input('is_deleted', sql.Bit, 0)
                                                    .input('author_id', sql.Char, user_id)
                                                    .query('insert into file_versions (id, file_id, number, comment, date, is_deleted, author_id) '
                                                        + 'values (@id, @file_id, @number, @comment, @date, @is_deleted, @author_id) ')
                                                    .then(result => {
        
                                                        res.json({ 'success': true, 'message': ''})
                                                        
                                                    })
                                                    .catch(err => {
        
                                                        res.json({ 'success': false, 'message': err.message })
        
                                                    })
                                                
                                            })
                                            .catch(err => {
  
                                                res.json({ 'success': false, 'message': err.message })
  
                                            })
  
                                    } else {
  
                                        pPool.request()
                                            .input('id', sql.Char, uuidv4())
                                            .input('file_id', sql.Char, id)
                                            .input('owner_name', sql.Char, decodeURIComponent(owner_name))
                                            .input('owner_id', sql.Char, owner_id)
                                            .input('comment', sql.Char, '')
                                            .input('date', sql.Char, datestr.dateToStr(new Date()))
                                            .input('is_deleted', sql.Bit, 0)
                                            .input('author_id', sql.Char, user_id)
                                            .query('insert into file_owners (id, file_id, owner_name, owner_id, comment, date, is_deleted, author_id) '
                                                + 'values (@id, @file_id, @owner_name, @owner_id, @comment, @date, @is_deleted, @author_id) ')
                                            .then(result => {
  
                                                res.json({ 'success': true, 'message': ''})
                                                
                                            })
                                            .catch(err => {
  
                                                res.json({ 'success': false, 'message': err.message })
  
                                            })
                                            
                                    }
  
                                } else {
  
                                    res.json({ 'success': true, 'message': ''})
  
                                }
  
                            }).catch(err => {
  
                                res.json({ 'success': false, 'message': err.message })
  
                            })
  
                    }).catch(err => {
  
                        res.json({ 'success': false, 'message': err.message })
  
                    })
  
            }
  
        }, (err) => {
            
            res.json({ 'success': false, 'message': err.message })
  
        })
  
    })
  
  })
  
  app.get('/getattachment', cors(), (req, res) => {
  
      var locationhref = ''
  
      let filespath = 'I:\\Attachments\\'
  
      if (req.query.disp) {
          
          res.setHeader("Content-Type", "image/" + req.query.ext)
          res.setHeader("Content-Disposition", "inline")
  
          //res.send(Buffer.from(fs.readFile(filespath + req.query.id + '.tmp', 'cb')))
  
          fs.readFile(filespath + req.query.id + '.tmp', function read(err, data) {
              if (err) {
                  return res.status(500).send({ 'success': false, 'message': err.message })  
              }
              return res.send(data)
          })
  
  
  
      } else {
          
          res.setHeader("Content-Type", "application/octet-stream")
          res.setHeader("Content-Disposition", "attachment; filename=" + encodeURIComponent(req.query.full_name) + '.' + req.query.ext)
          
          return res.download(filespath + req.query.id + '.tmp', (req.query.full_name) + '.' + req.query.ext)
  
      }
  
  })
  
  function getFilesWithVersions(Ids, callback, callbackerror) {
  
      sql.connect(config).then(pool => {
  
          //pPool = pool
  
          return pool.request()
              .input('owner_id', '\'' + Ids.join('\',\'') + '\'')
              .query('select file_owners.owner_id, files.id, isnull(file_versions.id, files.id) as version_id, files.name, '
                  + 'isnull(file_versions.ext, files.ext) as ext, files.comment, '
                  + 'files.date, users.name as username, isnull(file_versions.number, 0) as number from file_owners '
                  + 'inner join files on file_owners.file_id = files.id '
                  + 'left join users on file_owners.author_id = users.id '
                  + 'left join (select fvid.id, files.ext, file_versions.file_id, file_versions.number '
                  + 'from (select file_versions.file_id, max(file_versions.number) as number from file_versions group by file_id) as file_versions '
                  + '    inner join file_versions as fvid on fvid.file_id = file_versions.file_id and fvid.number = file_versions.number '
                  + '    inner join files on files.id = fvid.id) as file_versions '
                  + 'on files.id = file_versions.file_id '
                  + 'where owner_id IN (' + '\'' + Ids.join('\',\'') + '\'' + ') '
                  + 'order by files.date')
  
      }).then(result => {
  
          callback(result)
  
      }).catch(err => {
  
          callbackerror(err)
  
          //res.json({ 'success': false, 'message': err.message })
  
      })
  
  }
  
  function picByExt(ext){
  
      if(ext == 'pdf'){
          return 'pdf.png'
      }
      if(ext == 'jpg' || ext == 'jpeg'){
          return 'jpg.png'
      }
      if(ext == 'xls' || ext == 'xlsx'){
          return 'xls.png'
      }
      if(ext == 'doc' || ext == 'docx'){
          return 'doc.png'
      }
  
      return '';
  
  }
  
  
  app.get('/files', cors(), (req, res) => {
  
      let Ids = []
  
      if (req.query.id) {
          
          Ids.push(req.query.id)
  
          getFilesWithVersions(Ids, result => {
  
              result.recordset.forEach(felement => {
  
                  felement.pic = picByExt(felement.ext)
                  
              })
  
              return res.send({ success: true, message: '', result: result.recordset })  
  
          }, (err) => {
              
              return res.status(500).send({ success: false, message: err.message })  
  
          })
      } else {
          return res.send({ success: false, message: 'id required', result: [] }) 
      }
  })
    
app.listen(port, () => {
    console.log(`Listening on port ${port}`)
})
  
  
  

