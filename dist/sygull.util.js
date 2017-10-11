'use strict';

function checkEmpty (value) {
  return (typeof value === 'undefined' || value === null || value === '');
}

let handleInclude = function (sygull, originTable, object, fKey, field, sourceId, callback) {
  // TODO: This breaks if the user named the field incorrectly. insertObj will be undefined. Return an error
  // that does not crash the system and will help the user fix their problem
  let insertObj = object[field[fKey.model.toLowerCase()]];
  let fModel = sygull.get(fKey.model);
  let options = {};
  if (field.include) options.include = field.include;

  if (Array.isArray(insertObj)) {
    let asyncLoops = function (callback) {
      let doneCount = 0;

      let counter = function (err) {
        if (err) return callback(err);
        doneCount++;
        if (doneCount === insertObj.length) {
          callback(null);
        }
      };
      for (let i = 0; i < insertObj.length; i++) {
        insertObj[i][originTable] = sourceId;
        fModel._noTransactionSave(insertObj[i], options, function (err, results) { // TODO: Save
          if (err) return callback(err);
          if (results.id) {
            if (fKey.relation instanceof sygull.relation.JUNCTION) {
              createJunction(sygull, originTable, fModel.table, fKey.relation._junction, sourceId, results.id, function (err) {
                return counter(err);
              });
            } else counter(null);
          } else {
            counter(null);
          }
        });
      }
    };
    if (insertObj.length === 0) return callback();
    asyncLoops(callback);
  } else {
    if (typeof insertObj !== 'undefined' || insertObj != null) {
      insertObj[originTable] = sourceId;
      fModel._noTransactionSave(insertObj, options, function (err, results) {  // TODO: Save
        if (err) return callback(err);
        if (results.id) {
          if (fKey.relation instanceof sygull.relation.JUNCTION) {
            createJunction(sygull, originTable, fModel.table, fKey.relation._junction, sourceId, results.id, function (err) {
              callback(err);
            });
          } else callback(null);
        } else {
          callback(null);
        }
      });
    } else {
      console.log('THIS WAS WHAT WE DIDNT ADD?!?!?');
      console.log('insertObj', insertObj);
      console.log('originTable', originTable);
      callback(null);
    }
  }
};

let createJunction = function (sygull, leftTable, rightTable, junction, leftId, rightId, callback) {
  let queryString = 'INSERT IGNORE INTO ' + junction + ' (' + leftTable + 'Id, ' + rightTable + 'Id) ' +
                    'VALUES (' + leftId + ', ' + rightId + ')';
  console.log(queryString);
  sygull.db.query(queryString, function (err, results) {
    if (err) {
      console.log(err);
      return callback(err);
    }
    callback(null);
  });
};

module.exports = {
  log: function (msg) {
    process.stdout.write('(sygull) ');
    console.log(msg);
  },
  time: function (code) {
    console.time(code);
  },
  timeEnd: function (code) {
    process.stdout.write('(sygull) ');
    console.timeEnd(code);
  },
  handleFatalError: function (err, msg) {
    console.log(err);
    console.log(new Error(msg));
    process.exit(Math.floor(Math.random() * 100) - 25); // -25 to 75
  },
  validateFields: function (fields, object) {
    // for all of the field properties, run some checks and validations
    for (let prop in fields) {
      let field = fields[prop];
      let passedProperty = object[prop];

      if (field['default']) {
        if (typeof passedProperty === 'undefined') {
          passedProperty = field['default'];
        }
      }

      if (field['required'] && checkEmpty(passedProperty)) { // REQUIRED CHECK
        return new Error(prop + ' required value passed in was ' + passedProperty);
      }

      if (typeof passedProperty === 'undefined' || passedProperty === null) continue;

      if (!field['type'].validate(passedProperty)) {
        return new Error(prop + ' had incorrect data type for ' + passedProperty + ', expected ' + field['type'].toString());
      }

      // special date check to convert date strings so sql is happy
      if (field['type'].toString() === 'Date') {
        let dateObj = new Date(object[prop]);
        // sql wants YYYY-MM-DD
        let month = dateObj.getUTCMonth() + 1; // months from 1-12
        let day = dateObj.getUTCDate();
        let year = dateObj.getUTCFullYear();
        object[prop] = year + '-' + month + '-' + day;
      }

      if (field['trim']) {
        if (typeof passedProperty === 'string') {
          object[prop] = passedProperty.trim();
        }
      }

      if (field['validation']) {
        if (Array.isArray(field.validation)) {
            // Many validation functions
          for (let i = 0; i < field.validation.length; i++) {
            if (typeof field.validation[i] === 'function' && !field.validation[i](passedProperty)) {
              return new Error('Error: Validation failed for property:\'' + prop + '\' with value:\'' + passedProperty + '\'');
            }
          }
        } else {
            // A Single Validation Function
          if (typeof field.validation === 'function' && !field.validation(passedProperty)) {
            return new Error('Error: Validation failed for property:\'' + prop + '\' with value:\'' + passedProperty + '\'');
          }
        }
      }
    }
    return true;
  },
  normalizeModelProps: function (fields) {
    for (let prop in fields) {
      if (typeof fields[prop]['type'] === 'undefined') {
        let ourTypeVal = fields[prop];
        delete fields[prop];
        fields[prop] = { type: ourTypeVal };
      }
      if (typeof fields[prop]['type'] === 'function') {
        fields[prop]['type'] = fields[prop]['type']();
      }
    }
    return fields;
  },
  normalizeFKeys: function (fKeys) {
    if (typeof fKeys === 'undefined') return [];
    for (let i = 0; i < fKeys.length; i++) {
      if (typeof fKeys[i].key === 'undefined') fKeys[i].key = 'id';
      if (typeof fKeys[i].relation === 'function') {
        fKeys[i].relation = fKeys[i].relation();
      }
    }
    return fKeys;
  },
  waitForConnection: function (sygull, callback) {
    (function waitFor (callback, maxTimeout, it) {
      if (sygull.status !== 2 || sygull.db._inTransaction) {  // !== connected
        if (sygull.status !== 2) it++;
        if (it === maxTimeout) {
          callback(new Error('Server has not completed initializtion'));
        }
        setTimeout(function () {
          waitFor(callback, maxTimeout, it);
        }, 250);
      } else {
        callback();
      }
    })(callback, sygull._maxTimeout, 0);
  },
  handleIncludes: function (sygull, model, object, include, sourceId, callback) {
    if (!Array.isArray(include)) return callback(new Error('Include must be an array passed in ' + include + ' for ' + model.table + ' insert'));
    // compare include prop against fkeys models
    let includesToHandle = [];
    for (let i = 0; i < model.fKeys.length; i++) {
      for (let j = 0; j < include.length; j++) {
        if (include[j][model.fKeys[i].model.toLowerCase()]) {
          includesToHandle.push({fKey: model.fKeys[i], include: include[j]});
        }
      }
    }

    let asyncLoops = function (includeToHandle, callback) {
      let doneCount = 0;

      let counter = function (err) {
        if (err) return callback(err);

        doneCount++;
        if (doneCount === includeToHandle.length) {
          callback(null);
        }
      };
      for (let i = 0; i < includeToHandle.length; i++) {
        handleInclude(sygull, model.table, object, includeToHandle[i].fKey, includeToHandle[i].include, sourceId, function (err) {
          counter(err);
        });
      }
    };

    if (includesToHandle.length === 0) return callback();
    asyncLoops(includesToHandle, callback);
  },
  normalizeOptionTopLevelProps: function (options) {
    if (typeof options === 'object') {
      for (let prop in options) {
        if (prop === 'include') {
          for (let i = 0; i < options.include.length; i++) {
            for (let innerProp in options.include[i]) {
              if (innerProp.toLowerCase() !== innerProp) {
                Object.defineProperty(options.include[i], innerProp.toLowerCase(), Object.getOwnPropertyDescriptor(options.include[i], innerProp));
                delete options.include[i][innerProp];
              }
            }
          }
        }
      }
    }
  }
};
