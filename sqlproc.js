import sql from 'mssql'

import sqlconfig from './sqlconfig.js'

import { v4 as uuidv4, NIL as uuidNil } from 'uuid'

import datestr from './datestr.js'


function sqlreq(pool, params, query, callback) {

    var req = pool.request()

    params.forEach(param => {

        req.input(param.name, param.type, param.value)

    })
    
    req.query(query)
        .then(result => { 
            callback(false, result) 
        })
        .catch(err => { callback( err, null ) })

}

function getConstantValue(pPool, constantName, callback) {

    const sqlText = 'select * from constants where name = @name'
    const sqlParams = [{ name: 'name', type: sql.Char, value: constantName }]

    sqlreq(pPool, sqlParams, sqlText, (err, result) => { 
    
        if (err) { callback(err) } else {

            var arResult = result.recordset

            if (arResult.length) {

                callback(false, arResult[0].value) 
                
            } else {
                
                callback(false, undefined) 

            }
            
        }

    })
    
}

function deleteRequest(pPool, reqUid, callback) {

    const sqlText = 'delete from requests where id = @id'
    const sqlParams = [{ name: 'id', type: sql.Char, value: reqUid }]

    sqlreq(pPool, sqlParams, sqlText, (err, result) => { 
    
        if (err) { 
            
            callback(err) 
        
        } else {

            callback(false) 
            
        }

    })
    
}

function deleteRequestAfterExecute(pPool, reqUid, callback) {

    getConstantValue(pPool, 'delete_request_after_execute', (error, result) => {

        if (error) {
            
            callback(error)

        } else if(result == '1'){

            deleteRequest(pPool, reqUid, error => {

                if (error) {
                    
                    callback(error)

                } else {

                    callback(false)

                }

            })

            
        } else {

            pPool.request()
            .input('id', reqUid)
            .input('executed', true)
            .query('update requests set executed = @executed where id = @id')
            .then(() => {

                callback(false)

            })
            .catch((error) => {
                
                callback(error)
                
            })

        }

    })

}

function saveIncomeData(req, method, callback) {
  
    const reqUid = uuidv4()
    var pPool = null

    sql.connect(sqlconfig.config).then(pool => {

        pPool = pool

        const ip = req.header("x-forwarded-for")
            || req.socket.remoteAddress

        return pool.request()
            .input('id', reqUid)
            .input('date', datestr.dateToStrWM(new Date()))
            .input('ip', ip.split(':')[0] )
            .input('headers', JSON.stringify(req.rawHeaders))
            .input('url', req.originalUrl)
            .input('method', method)
            .input('query', JSON.stringify(req.query))
            .input('body', JSON.stringify(req.body))
            .query('insert into income_data (id, date, ip, headers, url, method, query, body) values (@id, @date, @ip, @headers, @url, @method, @query, @body) ')
          }).then(result => { callback(false, reqUid, pPool) })
          .catch(err => { callback( err, reqUid, pPool ) })

}

function saveRequestToId(reqUid, pPool, data, callback) {
  
    pPool.request()
        .input('id', reqUid)
        .input('date', datestr.dateToStr(new Date()))
        .input('data', JSON.stringify(data))
        .input('executed', false)
        .input('error', false)
        .input('message', '')
        .query('insert into requests (id, date, data, executed, error, message) values (@id, @date, @data, @executed, @error, @message) ')
    .then(result => { callback(false, reqUid, pPool) })
    .catch(err => { callback( err, reqUid, pPool ) })

}




function sqlTextInsert(tablename, params) {

    var res = []

    params.forEach(el => {

        res.push(el.name)

    })
    
    return 'insert into ' + tablename + ' (' + res.join(', ') + ') values (@' + res.join(', @') + ')'

}

function sqlTextUpdate(tablename, params, searchField) {

    var res = []

    params.forEach(el => {

        res.push(el.name + ' = @' + el.name)

    })
    
    return 'update ' + tablename + ' set ' + res.join(', ') + ' where ' + searchField + ' = @' + searchField

}



function searchInsertObjectWithoutHistory(pPool, objectParams, callback) {

    const sqlText = 'select * from ' + objectParams.table + ' where ' + objectParams.name + ' = @' + objectParams.name
    const sqlParams = [{ name: objectParams.name, type: objectParams.type, value: objectParams.value }]

    sqlreq(pPool, sqlParams, sqlText, (err, result) => { 
    
        if (err) { callback(err) } else {

            var arResult = result.recordset

            if (arResult.length) {

                savePredVersion(pPool, objectParams, err => {
        
                    if (err) { callback(err) }
                    else { 
                        
                        objectParams.sqlParams.filter(p => p.name == 'id')[0].value = arResult[0].id

                        sqlreq(pPool, objectParams.sqlParams, sqlTextUpdate(objectParams.table, objectParams.sqlParams, 'id'), (err, result) => { 
                        
                            if (err) { callback(err) } else { callback(false) }
                
                        })
                    }

                })

            } else {
                
                sqlreq(pPool, objectParams.sqlParams, sqlTextInsert(objectParams.table, objectParams.sqlParams), (err, result) => { 
                
                    if (err) { callback(err) } else { callback(false) }

                })
            }
            
        }

    })
    
}

function insertRecordWithTypes(pPool, objectParams, record, callback) {
    
        sqlreq(pPool, objectParams.fields, sqlTextInsert(objectParams.name, objectParams.fields), (err, result) => {

            callback( err )  

        })


}

function insertRecords(pPool, objectParams, records, index, callback) {
    
    if (records.length > index) {

        objectParams.fields.forEach(f => {

            f.type = sql[f.type]

        })

        insertRecordWithTypes(pPool, objectParams, records[index], err => {

            if (err) {
                
                callback(err)
            } else {
                insertRecords(pPool, objectParams, records, index + 1, callback) 
            }

        })

    } else {
            
        callback()

    }



}


function saveRequest(data, callback) {
  
    const reqUid = uuidv4()
    var pPool = null

    sql.connect(sqlconfig.config).then(pool => {

        pPool = pool

        return pool.request()
            .input('id', reqUid)
            .input('date', datestr.dateToStr(new Date()))
            .input('data', JSON.stringify(data))
            .input('executed', false)
            .input('error', false)
            .input('message', '')
            .query('insert into requests (id, date, data, executed, error, message) values (@id, @date, @data, @executed, @error, @message) ')
          }).then(result => { callback(false, reqUid, pPool) })
          .catch(err => { callback( err, reqUid, pPool ) })

}

function searchSetDeletedObject(pPool, objectParams, callback) {

    const sqlText = 'select * from ' + objectParams.table + ' where ' + objectParams.name + ' = @' + objectParams.name
    const sqlParams = [{ name: objectParams.name, type: objectParams.type, value: objectParams.value }]

    sqlreq(pPool, sqlParams, sqlText, (err, result) => { 
    
        if (err) { callback(err) } else {

            var arResult = result.recordset

            if (arResult.length) {

                const svParams = {
                    object_type: objectParams.table,
                    object_id: arResult[0].id,
                    object_data: JSON.stringify(arResult[0]),
                    author_id: objectParams.author_id ? objectParams.author_id : ''
                }

                saveVersion(pPool, svParams, err => {

                    if (err) { callback(err) } else {
                        
                        const sqlParamsDel = [
                            { name: 'id', type: sql.Char, value: arResult[0].id },
                            { name: 'is_deleted', type: sql.Bit, value: 1 }
                        ]

                        sqlreq(pPool, sqlParamsDel, sqlTextUpdate(objectParams.table, sqlParamsDel, 'id'), (err, result) => { 
                        
                            if (err) { callback(err) } else { callback(false) }
                
                        })
                    }

                })
                
            } else {
                
                callback(false) 

            }
            
        }

    })
    
}

function saveVersion(pPool, objectParams, callback) {
    
    const sqlText = 'select max(version_number) as version_number from object_history where object_type = @object_type and object_id = @object_id'
    const sqlParams = [
        { name: 'object_type', type: sql.Char, value: objectParams.object_type },
        { name: 'object_id', type: sql.Char, value: objectParams.object_id }
    ]

    sqlreq(pPool, sqlParams, sqlText, (err, result) => {
        
        if (err) { callback(err) } else {
            
            const arResult = result.recordset

            const nextVersionNumber = arResult[0].version_number == null ? 0 : arResult[0].version_number + 1

            const sqlParamsIns = [
                { name: 'id', type: sql.Char, value: uuidv4() },
                { name: 'date', type: sql.Char, value: datestr.dateToStr(new Date()) },
                { name: 'version_number', type: sql.Int, value: nextVersionNumber },
                { name: 'object_type', type: sql.Char, value: objectParams.object_type },
                { name: 'object_id', type: sql.Char, value: objectParams.object_id },
                { name: 'object_data', type: sql.NVarChar, value: objectParams.object_data },
                { name: 'author_id', type: sql.Char, value: objectParams.author_id }
            ]
            
            sqlreq(pPool, sqlParamsIns, sqlTextInsert('object_history', sqlParamsIns), (err, result) => {

                if (err) { callback(err) } else { callback(false) }
        
            })
        }
        
    })
}

function savePredVersion(pPool, objectParams, callback) {
    
    const sqlText = 'select * from ' + objectParams.table + ' where ' + objectParams.name + ' = @' + objectParams.name
    const sqlParams = [{ name: objectParams.name, type: objectParams.type, value: objectParams.value }]

    sqlreq(pPool, sqlParams, sqlText, (err, result) => { 
    
        if (err) { callback(err) } else {

            var arResult = result.recordset

            if (arResult.length) {

                const svParams = {
                    object_type: objectParams.table,
                    object_id: arResult[0].id,
                    object_data: JSON.stringify(arResult[0]),
                    author_id: objectParams.author_id ? objectParams.author_id : ''
                }

                saveVersion(pPool, svParams, err => { if (err) { callback(err) } else { callback(false) } })

            } else { callback(false) }
        }
    })
                        
}

function searchInsertObject(pPool, objectParams, callback) {

    const sqlText = 'select * from ' + objectParams.table + ' where ' + objectParams.name + ' = @' + objectParams.name
    const sqlParams = [{ name: objectParams.name, type: objectParams.type, value: objectParams.value }]

    sqlreq(pPool, sqlParams, sqlText, (err, result) => { 
    
        if (err) { callback(err) } else {

            var arResult = result.recordset

            if (arResult.length) {

                const svParams = {
                    object_type: objectParams.table,
                    object_id: arResult[0].id,
                    object_data: JSON.stringify(arResult[0])
                }

                saveVersion(pPool, svParams, err => {

                    if (err) { callback(err) } else {
                        
                        objectParams.sqlParams.filter(p => p.name == 'id')[0].value = arResult[0].id

                        sqlreq(pPool, objectParams.sqlParams, sqlTextUpdate(objectParams.table, objectParams.sqlParams, 'id'), (err, result) => { 
                        
                            if (err) { callback(err) } else { callback(false) }
                
                        })
                    }

                })
                
            } else {
                
                sqlreq(pPool, objectParams.sqlParams, sqlTextInsert(objectParams.table, objectParams.sqlParams), (err, result) => { 
                
                    if (err) { callback(err) } else { callback(false) }

                })
            }
            
        }

    })
    
}

function insertTableRow(pPool, params, table_index, table_records, curTable, rowIndex, callback, callbackerror) {
    
    if(table_records.length > rowIndex) {

        var request = pPool.request()

        var strValues = []
        var strFields = []

        curTable.fields.forEach(field => {

            let curField = typeof(field) == 'string' ? field : field.name

            strFields.push(curField)
            strValues.push('@' + curField)

            request.input(curField, table_records[rowIndex][curField])

        })

        request.query('insert into ' + curTable.name + '(' + strFields.join(', ') + ') values (' + strValues.join(', ') + ')')
            .then(result => {

                insertTableRow(pPool, params, table_index, table_records, curTable, rowIndex + 1, callback, callbackerror)

            }).catch(err => {

                callbackerror(err)

            })

    } else {

        callback(pPool, params, table_index)

    }

}

function insertTable(pPool, params, table_index, callback, callbackerror) {
    
    if(params.tables.length > table_index) {

        var curTable = params.tables[table_index]

        insertTableRow(pPool, params, table_index, params.record[curTable.name], curTable, 0, 
            (pPool, params, table_index) => { insertTable(pPool, params, table_index + 1, callback, callbackerror) }, 
            (err) => callbackerror(err) )

    } else {

        callback()

    }

}

function updateTable(pPool, params, table_index, callback, callbackerror) {
    
    if(params.tables.length > table_index) {

        var curTable = params.tables[table_index]

        pPool.request()
            .input(curTable.key, params.record.id)
            .query('delete from ' + curTable.name + ' where ' + curTable.key + ' = @' + curTable.key)
            .then(result => {

                insertTableRow(pPool, params, table_index, params.record[curTable.name], curTable, 0, 
                    (pPool, params, table_index) => { updateTable(pPool, params, table_index + 1, callback, callbackerror) }, 
                    (err) => callbackerror(err) )

            }).catch(err => {

                callbackerror(err)

            })

    } else {

        callback()

    }

}

function updateRecord(pPool, params, callback) {
    
    var request = pPool.request()

    var strValues = []

    params.fields.forEach(field => {

      let curField = typeof(field) == 'string' ? field : field.name
      let autoinc = typeof(field) == 'string' ? false : field.autoinc

      if (!autoinc) {
          
          strValues.push(curField + ' = @' + curField)

          request.input(curField, params.record[curField])
      }


    })

    request.query('update ' + params.name + ' set ' + strValues.join(', ') + ' where ' + params.fields[0] + ' = @' + params.fields[0])
        .then(result => {

            if(params.tables){

                updateTable(pPool, params, 0, () => {

                    callback()

                }, (err) => {

                    callback(err)
                    
                })
            } else {
            
                callback()
                
            }

        }).catch(err => {

            callback(err)

        })


}

function insertRecord(pPool, params, callback) {

    var request = pPool.request()

    var strValues = []
    var strFields = []

    params.fields.forEach(field => {

            let curField = typeof(field) == 'string' ? field : field.name
            let autoinc = typeof(field) == 'string' ? false : field.autoinc

            if (!autoinc) {
                
                strFields.push(curField)
                strValues.push('@' + curField)

                request.input(curField, params.record[curField])

            }

    })

    request.query('insert into ' + params.name + '(' + strFields.join(', ') + ') values (' + strValues.join(', ') + ')')
        .then(result => {

            if(params.tables){

                insertTable(pPool, params, 0, () => {

                    callback()

                }, (err) => {

                    callback(err)
                    
                })

            } else {

                callback()

            }

        }).catch(err => {

            callback(err)

        })

}

export default {

    saveRequest,
    deleteRequestAfterExecute,
    sqlreq,

    saveIncomeData,
    saveRequestToId,

    getConstantValue,

    sqlTextInsert,

    sqlTextUpdate,

    searchInsertObjectWithoutHistory,

    searchSetDeletedObject,
    savePredVersion,

    insertRecords,

    updateRecord, insertRecord, insertRecordWithTypes, insertTable, updateTable

}