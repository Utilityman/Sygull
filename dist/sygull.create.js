'use strict';

let sygullUtils = require('./sygull.util');

// TODO: Default key: 'id'
// TODO: DELETE ON CASCADE option? please fix
// TODO Multiple Ids? Or Single id primary
// TODO: If the database isnt found, create it and then wait for the user to rerun.

function checkFlags (property, statement) {
  if (property['autoIncrement']) {
    statement += 'AUTO_INCREMENT ';
  }

  if (property['notNull']) {
    statement += 'NOT NULL ';
  }

  if (typeof property['default'] !== 'undefined') {
    statement += 'DEFAULT ' + property['default'] + ' ';
  }

  return statement;
}

function addFieldAlterStatement (model, fields) {
  let str = 'ALTER TABLE ' + model.table;
  for (let prop in fields) {
    str += ' ADD COLUMN ';
    let type;
    if (typeof fields[prop]['type'] === 'undefined') type = fields[prop];
    else type = fields[prop]['type'];

    str += prop + ' ' + type.toSql() + ' ';
    str = checkFlags(prop, str) + ', ';
  }
  str = str.slice(0, -2) + ';';
  console.log(str);
  return str;
}

function createFKeyAlterStatement (sygull, table, fKey) { // user -> company id: {params}
  if (typeof fKey.key === 'undefined') fKey.key = 'id'; // default key = id //FIXME patchwerk
  let fModel = sygull.get(fKey.model);
  let columnName = '`' + fKey.model.toLowerCase() + 'Id`';
  let str = 'ALTER TABLE ' + table + ' ADD COLUMN ';

  // TODO: line 52 breaks when the the fModel is undefined. It is undefined when it is not properly
  // required or added to sygull. Instead of crashing, perhaps return an error saying that fKey.model
  // has an undefined Model and that it was added incorrectly.
  str += columnName + ' ' + fModel.fields[fKey.key]['type'].toSql();

  if (fKey.required) {
    str += ' NOT NULL';
  }
  str += ', ADD INDEX (' + columnName + ')';
  str += ', ADD FOREIGN KEY (' + columnName + ') REFERENCES ';
  str += fModel.table + '(' + fKey.key + ') ';
  str += 'ON UPDATE CASCADE ON DELETE CASCADE;';
  return str;
}

function createJunction (sygull, model, fKey) {
  // if (typeof fKey.key === 'undefined') fKey.key = 'id'; // default key = id //FIXME patchwerk

  let str = 'CREATE TABLE IF NOT EXISTS `' + fKey.relation._junction.toLowerCase() + '` (';
  // let parentPKey = 'id' // model._primaryKey[0];

  let pMod = model.table.toLowerCase() + 'Id';
  str += pMod + ' ' + model.fields['id'].type.toSql();
  str += ' NOT NULL, ';

  let fObject = sygull.get(fKey.model);
  let fMod = fObject.table.toLowerCase() + 'Id';
  str += fMod + ' ' + fObject.fields['id'].type.toSql();
  str += ' NOT NULL, ';

  str += 'PRIMARY KEY (' + pMod + ', ' + fMod + '), ';

  str += 'INDEX (' + pMod + '), FOREIGN KEY (' + pMod;
  str += ') REFERENCES ' + model.table.toLowerCase() + '(id)';
  str += 'ON UPDATE CASCADE ON DELETE CASCADE, ';

  str += 'INDEX (' + fMod + '), FOREIGN KEY (' + fMod;
  str += ') REFERENCES ' + fObject.table.toLowerCase() + '(id)';
  str += 'ON UPDATE CASCADE ON DELETE CASCADE';

  str += ') ENGINE=InnoDB;';
  return str;
}

function buildCreateStatement (model) {
  let statement = 'CREATE TABLE IF NOT EXISTS `' + model.table + '` (';

  let primaryKey = '';
  for (let prop in model.fields) {
    let tableCol = model.fields[prop];
    if (typeof tableCol['type'] !== 'undefined') {
      tableCol = model.fields[prop]['type'];
    }

    if (typeof tableCol.toSql === 'function') {
      statement += '`' + prop + '` ' + tableCol.toSql() + ' ';
      statement = checkFlags(model.fields[prop], statement);
      statement += ',';

      if (prop === 'id') { // if (model.fields[prop]['primary']) {
        primaryKey += '`' + prop + '`,';
      }
    } else {
      sygullUtils.handleFatalError(new Error('Error: Bad Model definition for model: ' + model.table + ' at prop: ' + prop), 'Bad Model');
    }
  }
  primaryKey = primaryKey.slice(0, -1);
  model._primaryKey = primaryKey.split(',');
  statement += 'PRIMARY KEY (' + primaryKey + ')';
  statement += ') ENGINE=InnoDB;';

  return statement;
}

module.exports = {
  createTable: function (sygull, model, callback) {
    let buildCreateQuery = buildCreateStatement(model);
    sygullUtils.log(buildCreateQuery);
    sygull.db.query(buildCreateQuery, function (err, results) {
      if (err) sygullUtils.handleFatalError(err, 'Failed to Create SQL Table for model: ' + model.table);
      callback();
    });
  },
  createAltersAndJunctions: function (sygull, model, callback) {
    for (let i = 0; i < model.fKeys.length; i++) {
      if (typeof model.fKeys[i]['relation'] !== 'undefined') {
        if (model.fKeys[i]['relation'] instanceof sygull.relation.JUNCTION) {
          if (!sygull._junctions.includes(model.fKeys[i]['relation']._junction)) {
            sygull._junctions.push(model.fKeys[i]['relation']._junction);
            let juncQuery = createJunction(sygull, model, model.fKeys[i]);
            sygullUtils.log(juncQuery);
            sygull.db.query(juncQuery, function (err, results) {
              if (err) sygullUtils.handleFatalError(err, 'Failed to Create Junction Table for junction: ' + model.fKeys[i].junction);
            });
          }
        } else if (!model.fKeys[i]['relation']._ignored) {
          let alterStatement = createFKeyAlterStatement(sygull, model.table, model.fKeys[i]);
          if (alterStatement === 'undefined') return callback();
          sygullUtils.log(alterStatement);
          sygull.db.query(alterStatement, function (err, results) {
            if (err) sygullUtils.handleFatalError(err, 'Failed to Create Alter Statement for model: ' + model.table);
          });
        }
      } else {
        sygullUtils.handleFatalError(new Error('Incorrect Model Definition: Relation Required for ' + model.table + ' fKey: ' + model.fKeys[i]), ' Bad');
      }
    } callback();
  },
  checkExistsAndUpdate: function (sygull, model, callback) {
    // Query Sql Check If eXists
    let qscix = 'SELECT * FROM information_schema.tables' +
                ' WHERE table_schema =\'' + sygull.db.config.database + '\'' +
                ' AND table_name = \'' + model.table + '\' LIMIT 1;';
    sygullUtils.log(qscix);
    sygull.db.query(qscix, function (err, resultsTables) {
      if (err) return sygullUtils.handleFatalError(err, 'Failed to Locate Table');
      if (!resultsTables.length) {
        if (typeof sygull._modelsToCreate === 'undefined') sygull._modelsToCreate = [];
        sygull._modelsToCreate.push(model);
        callback();
      } else {
        // Query Sql get all of the columns
        let qsgaotc = 'select * from information_schema.columns' +
                      ' WHERE table_schema =\'' + sygull.db.config.database + '\'' +
                      ' AND table_name = \'' + model.table + '\';';
        sygull.db.query(qsgaotc, function (err, results) {
          if (err) return sygullUtils.handleFatalError(err, 'Failed to retrieve columns for table ' + model.table);
          // TODO: Check New Columns in model that don't exist in database,
          // TODO: Check modified model types?
          let checkFields = Object.assign({}, model.fields);

          for (let i = 0; i < results.length; i++) {
            if (typeof checkFields[results[i]['COLUMN_NAME']] === 'undefined')
              ;// TODO: Alter database to delete column  removeFieldAlterStatement
            else {
              // console.log(results[i]);  // TODO: Alter column to correct datatype
              delete checkFields[results[i]['COLUMN_NAME']];  // delete property, it exists
            }
          }

          for (let i = 0; i < model.fKeys.length; i++) {
            if (model.fKeys[i]['relation'] instanceof sygull.relation.JUNCTION) { // have to use model.fKeys for check as it carries its type
              // check if junction table exists
              let junctionCheck = 'SELECT * FROM information_schema.tables' +
                          ' WHERE table_schema =\'' + sygull.db.config.database + '\'' +
                          ' AND table_name = \'' + model.fKeys[i].relation._junction + '\' LIMIT 1;';
              sygull.db.query(junctionCheck, function (err, junctionCheck) {
                if (err) return sygullUtils.handleFatalError(err, 'Failed to query junction table ' + model.fKeys[i].relation._junction);
                if (!junctionCheck.length) {
                  sygull.db.query(createJunction(sygull, model, model.fKeys[i]), function (err, junctionResult) {
                    if (err) return sygullUtils.handleFatalError(err, 'Failed to create junction table ' + model.fKeys[i].relation._junction);
                  });
                }
              });
            } else {
              // No junction
              let name = model.fKeys[i].model.toLowerCase() + 'Id';
              let found = false;
              // console.log(model.fKeys[i]['relation']);
              for (let j = 0; j < results.length; j++) {
                if (name === results[j]['COLUMN_NAME']) {
                  found = true;
                  break;
                }
              }

              if (!found && (model.fKeys[i]['relation'] instanceof sygull.relation.ONE_BELONGS_TO ||
                            model.fKeys[i]['relation'] instanceof sygull.relation.MANY_BELONG_TO)) {
                console.log(model.table + ' ensure in table: ' + model.fKeys[i].model);
                sygull.db.query(createFKeyAlterStatement(sygull, model.table, model.fKeys[i]), function (err, fKeyObjectResult) {
                  if (err) return sygullUtils.handleFatalError(err, 'Failed to Foreign Key:' + model.fKeys[i].model + ' to table ' + model.table);
                });
              }
            }
          }

          if (Object.keys(checkFields).length) {
            sygull.db.query(addFieldAlterStatement(model, checkFields), function (err, results) {
              if (err) return sygullUtils.handleFatalError(err, 'Failed to Add Properties:' + checkFields + ' to table ' + model.table);
              // console.log(results);
              callback();
            });
          } else callback();
        });
      }
    });
  }
};
