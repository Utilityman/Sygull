'use strict';

let escapeRegExp = function (text) {
  if (typeof text === 'string') {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s']/g, '\\$&');
  } else {
    return text;
  }
};

let sygullUtil = require('./sygull.util');
/**
 *  This file provides tools for insert SQL queries.
 */

let buildInsertStatement = function (table, fKeys, fields, saveObject, includes) {
  let insertStatement = 'INSERT INTO ' + table + ' (';
  for (let prop in fields) {
    if (prop === 'id') continue;
    insertStatement += '`' + prop + '`,';
  }

  let fKeyValues = [];
  if (fKeys) {
    for (let i = 0; i < fKeys.length; i++) {
      if (!fKeys[i]['relation']._junction && !fKeys[i]['relation']._ignored) {
        let locProp = fKeys[i].model.toLowerCase();
        if (includes) {
          for (let i = 0; i < includes.length; i++) {
            if (includes[i][locProp]) {
              locProp = includes[i][locProp];
              break;
            }
          }
        }

        if (saveObject[locProp]) {
          insertStatement += fKeys[i].model + 'Id,';

          if (typeof saveObject[locProp] === 'undefined') {
            fKeyValues.push(null);
          } else if (typeof saveObject[locProp] === 'object') {
            if (typeof saveObject[locProp].id === 'undefined') {
              fKeyValues.push(null);
            } else {
              fKeyValues.push(saveObject[locProp].id);
            }
          } else {
            fKeyValues.push(saveObject[locProp]);
          }
        }
      }
    }
  }

  insertStatement = insertStatement.slice(0, insertStatement.length - 1);
  insertStatement += ') VALUES (';

  for (let prop in fields) {
    if (prop === 'id') continue;
    if (typeof saveObject[prop] === 'undefined') {
      insertStatement += 'NULL,';
    } else if (typeof saveObject[prop] === 'number' || typeof saveObject[prop] === 'boolean') {
      insertStatement += saveObject[prop] + ',';
    } else {
      insertStatement += '\'' + escapeRegExp(saveObject[prop]) + '\',';
    }
  }

  for (let i = 0; i < fKeyValues.length; i++) {
    if (fKeyValues[i] === null) insertStatement += 'NULL,';
    else insertStatement += '\'' + escapeRegExp(fKeyValues[i]) + '\',';
  }

  insertStatement = insertStatement.slice(0, insertStatement.length - 1);
  insertStatement += ');';

  return insertStatement;
};

module.exports = {
  add: function (sygull, model, object, options, callback) {
    let fields = model.fields;

    let error = sygullUtil.validateFields(fields, object);
    if (error instanceof Error) return callback(new Error('Err in validation of ' + model.table + ' ' + error));

    // make the insert statement
    let sqlAddQuery = buildInsertStatement(model.table, model.fKeys, fields, object, options.include);
    if (typeof sqlAddQuery !== 'undefined') {
      // start that transaction!
      // insert the root object
      sygullUtil.log(sqlAddQuery);
      sygull.db.query(sqlAddQuery, function (err, results) {
        if (err) return callback(err);

        let asyncLoops = function (iterator, callback) {
          let doneCount = 0;

          let counter = function (err) {
            if (err) return callback(err);
            doneCount++;
            if (doneCount === Object.keys(options).length) {
              callback();
            }
          };

          for (let prop in options) {
            iterator(sygull, model, object, options[prop], results.insertId, function (err) {
              counter(err);
            });
          }
        };

        if (!Object.keys(options).length) return callback(null, results);
        asyncLoops(sygullUtil.handleIncludes, function (err) {
          if (err) return callback(err);
          return callback(null, results);
          // TODO:
          // model.findById(results.insertId, function (err, results) {
          //   if (err) return callback(err);
          //   return callback(null, results);
          // });
        });
      });
    } else {
      callback(new Error('Insert Statement Failed to Create'));
    }
  }
};
