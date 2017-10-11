'use strict';

let escapeRegExp = function (text) {
  if (typeof text === 'string') {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s']/g, '\\$&');
  } else {
    return text;
  }
};

// object[prop].toString().replace('\\', '\\\\').replace("'", "\\'")
let sygullUtil = require('./sygull.util');

let buildUpdateStatement = function (table, fKeys, fields, object, includes) {
  let str = 'UPDATE ' + table + ' SET ';

  for (let prop in fields) {
    if (typeof object[prop] === 'undefined' || object[prop] === null) {
      str += prop + '=NULL,';
    } else if (typeof object[prop] === 'number' || typeof object[prop] === 'boolean') {
      str += '`' + prop + '`=' + object[prop] + ',';
    } else {
      str += '`' + prop + '`="' + escapeRegExp(object[prop]) + '",';
    }
  }

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
        if (object[locProp]) {
          str += '`' + fKeys[i].model + 'Id`=';
          if (typeof object[locProp] === 'object') {
            if (typeof object[locProp].id === 'undefined') str += 'NULL,';
            else str += '"' + object[locProp].id + '",';
          } else {
            str += '"' + object[locProp] + '",';
          }
        }
      }
    }
  }

  str = str.slice(0, str.length - 1);
  str += ' WHERE id=' + object.id + ';';
  return str;
};

function deleteJunction (sygull, junction, sourceModel, sourceObj, fModelName, fObject, callback) {
  if (typeof fObject === 'undefined') return callback();
  let delJunctionQuery = 'DELETE FROM ' + junction + ' WHERE ';
  delJunctionQuery += fModelName + 'Id=' + fObject.id + ' && ';
  delJunctionQuery += sourceModel.table + 'Id=' + sourceObj.id;
  sygullUtil.log(delJunctionQuery);
  sygull.db.query(delJunctionQuery, function (err, results) {
    if (err) return callback(err);
    else {
      callback();
    }
  });
}

function deleteJunctions (sygull, junction, sourceModel, sourceObj, fModelName, fObjects, callback) {
  let count = fObjects.length;
  if (count === 0) return callback();
  for (let i = 0; i < fObjects.length; i++) {
    if (!Object.keys(fObjects[i]).length) {
      count--;
      if (!count) {
        callback();
      }
    } else {
      deleteJunction(sygull, junction, sourceModel, sourceObj, fModelName, fObjects[i], function (err) {
        if (err) return callback(err);
        else {
          count--;
          if (!count) {
            callback();
          }
        }
      });
    }
  }
}

function clearDuplicateIds (source, target) {
  for (let k = 0; k < source.length; k++) {
    for (let l = 0; l < target.length; l++) {
      if (source[k].id === target[l].id) {
        target[l] = {};
      }
    }
  }
  return target;
}

let updateJunctions = function (sygull, model, object, options, id, callback) {
  let count = model.fKeys.length;

  for (let i = 0; i < model.fKeys.length; i++) {
    if (model.fKeys[i].relation instanceof sygull.relation.JUNCTION) {
      for (let j = 0; j < options.length; j++) {
        let found = false;
        for (let prop in options[j]) {
          if (prop.toLowerCase() === model.fKeys[i].model.toLowerCase()) {
            found = true;
            let includeObj = {};
            includeObj[prop] = options[j][prop];
            model.findById(id, {include: [includeObj]}, function (err, oldObj) {
              if (err) {
                return callback(err);
              } else {
                let oldJunctionField = oldObj[options[j][prop]];
                let newJunctionField = object[options[j][prop]];
                oldJunctionField = clearDuplicateIds(newJunctionField, oldJunctionField);

                // anything left in oldJunctionField are objects that exist in the old object
                // but are no longer represented in the new one -- should be deleted
                deleteJunctions(sygull, model.fKeys[i].relation._junction, model, object, prop, oldJunctionField, function (err) {
                  if (err) return callback(err);
                  count--;
                  if (!count) {
                    callback(null);
                  }
                });
              }
            });
          }
        }
        if (!found) {
          count--;
          if (!count) {
            callback(null);
          }
        }
      }
    } else {
      count--;
      if (!count) {
        callback(null);
      }
    }
  }
  // callback(null);
};

// update company set name="Gaagle", abbr="GAAG", logo="/path/from/logo.png", startPayCycle="updated rules", endPayCycle="updated end cycle rules", payDate="updated payDate rules", periodLength = 3 where id=2;
module.exports = {
  update: function (sygull, model, object, options, callback) {
    let fields = model.fields;

    let error = sygullUtil.validateFields(fields, object);
    if (error instanceof Error) return callback(new Error('Err in validation of ' + model.table + ' ' + error));
    if (!object.id) return callback(new Error('You must update an existing object in the database'));

    // make the insert statement
    let updateQuery = buildUpdateStatement(model.table, model.fKeys, fields, object, options.include);

    if (typeof updateQuery !== 'undefined') {
      sygull.db.query(updateQuery, function (err, results) {
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

          if (Object.keys(options).length === 0) return callback();
          for (let prop in options) {
            iterator(sygull, model, object, options[prop], object.id, function (err) {
              counter(err);
            });
          }
        };
        asyncLoops(updateJunctions, function (err) {
          if (err) return callback(err);
          if (!Object.keys(options).length) return callback(null, results);
          asyncLoops(sygullUtil.handleIncludes, function (err) {
            if (err) return callback(err);
            return callback(null, results);
          });
        });
      });
    } else {
      callback(new Error('Insert Statement Failed to Create'));
    }
  }
};
