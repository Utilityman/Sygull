'use strict';

let sygullUtil = require('./sygull.util');

function createFKeySelect (fKey) {
  let str = '';
  let modelName = fKey.model.toLowerCase();
  if (fKey.select) {
    for (let j = 0; j < fKey.select.length; j++) {
      str += modelName + '.' + fKey.select[j] + ', ';
    }
  } else {
    str += modelName + '.*, ';
  }

  if (fKey.junction) {
    str += fKey.junction + '.*, ';
  }

  return str;
}

function createFKeyJoin (table, fKey) {
  let str = '';
  str += ('  LEFT JOIN ');
  let modelName = fKey.model.toLowerCase();
  if (fKey.relation._junction) {
    str += fKey.relation._junction + ' ON ' + fKey.relation._junction + '.' + table + 'Id = ' + table + '.id';
    str += (' LEFT JOIN ') + modelName + ' ON ' + modelName + '.id = ' + fKey.relation._junction + '.' + modelName + 'Id';
  } else if (fKey.relation._isArray) {
    str += modelName + ' ON ' + table + '.id = ' + modelName + '.' + table + 'Id';
  } else {
    if (fKey.relation._hasKey) {
      str += modelName + ' ON ' + table + '.' + modelName + 'Id = ' + modelName + '.id'; // DEFAULT
    } else {
      str += modelName + ' ON ' + modelName + '.' + table + 'Id = ' + table + '.id';
    }
  }
  return str;
}

function handleCoalesceIncludes (obj, result, include, checkDup) {
  for (let j = 0; j < include.length; j++) {
    for (let prop in include[j]) {
      if (checkDup) {
        if (obj[include[j][prop]]) {
          if (Array.isArray(obj[include[j][prop]])) {
            let found = false;
            for (let k = 0; k < obj[include[j][prop]].length; k++) {
              if (obj[include[j][prop]][k].id === result[prop].id) {
                found = true;
                break;
              }
            }

            if (!found) {
              if (result[prop].id !== null) {
                obj[include[j][prop]].push(result[prop]);
              }
            }
          }
        }
      } else {
        if (typeof result[prop] !== 'undefined') {
          if (result[prop].id !== null) {
            if (include[j]._modelRelation._isArray) {
              obj[include[j][prop]] = [result[prop]];
            } else {
              obj[include[j][prop]] = result[prop];
            }
          } else {
            if (include[j]._modelRelation._isArray) {
              obj[include[j][prop]] = [];
            } else {
              obj[include[j][prop]] = {};
            }
          }
        }
      }
    }

    // if (typeof include[j].include !== 'undefined') {
    //   if (Array.isArray(obj[include[j][targetProp]])) {
    //     for (let i = 0; i < obj[include[j][targetProp]].length; i++) {
    //       handleCoalesceIncludes(obj[include[j][targetProp]][i], result, include[j].include, checkDup);
    //     }
    //   } else {
    //     handleCoalesceIncludes(obj[include[j][targetProp]], result, include[j].include, checkDup);
    //   }
    // }
  }
}

function coalesceMajor (rootObj, childObj, include) {
  for (let i = 0; i < rootObj.length; i++) {
    if (Array.isArray(rootObj[i][include[include._model.toLowerCase()]])) {
      for (let k = 0; k < rootObj[i][include[include._model.toLowerCase()]].length; k++) {
        for (let j = 0; j < childObj.length; j++) {
          if (rootObj[i][include[include._model.toLowerCase()]][k]) {
            if (rootObj[i][include[include._model.toLowerCase()]][k].id === childObj[j].id) {
              rootObj[i][include[include._model.toLowerCase()]][k] = childObj[j];
            }
          }
        }
      }
    } else {
      for (let j = 0; j < childObj.length; j++) {
        if (rootObj[i][include[include._model.toLowerCase()]]) {
          if (rootObj[i][include[include._model.toLowerCase()]].id === childObj[j].id) {
            rootObj[i][include[include._model.toLowerCase()]] = childObj[j];
          }
        }
      }
    }
  }
  return rootObj;
}

function coalesce (model, include, results) {
  sygullUtil.time('coalesce');
  let coalescedObjects = {};
  let tableName = model.table;
  for (let i = 0; i < results.length; i++) {
    // if main model result does not exsist add it
    if (!coalescedObjects[results[i][tableName].id]) {
      coalescedObjects[results[i][tableName].id] = results[i][tableName];
      // add its includes
      handleCoalesceIncludes(coalescedObjects[results[i][tableName].id], results[i], include);
    } else {
      handleCoalesceIncludes(coalescedObjects[results[i][tableName].id], results[i], include, true);
    }
  }

  // convert back to array
  let coalescedResults = [];
  for (let prop in coalescedObjects) {
    coalescedResults.push(coalescedObjects[prop]);
  }

  sygullUtil.timeEnd('coalesce');

  return coalescedResults;
}

function handleIncludes (sygull, model, include, includeStrings) {
  let includeCounts = 0;
  if (Object.keys(include).length) {
    // loop through valid fkeys
    for (let i = 0; i < model.fKeys.length; i++) {
      // check if that matches an include
      for (let j = 0; j < include.length; j++) {
        for (let prop in include[j]) {
          let lowerCaseProp = prop.toLowerCase();
          if (lowerCaseProp === model.fKeys[i].model.toLowerCase()) {
            if (lowerCaseProp !== prop) {
              Object.defineProperty(include[j], lowerCaseProp, Object.getOwnPropertyDescriptor(include[j], prop));
              delete include[j][prop];
            }
          }
        }
        if (include[j][model.fKeys[i].model.toLowerCase()]) {
          includeCounts++;
          includeStrings.selectStrAddition += createFKeySelect(model.fKeys[i]);
          includeStrings.joinStrAddition += createFKeyJoin(model.table, model.fKeys[i]);
          // save relation so we dont have to do this loop again later
          include[j]._modelRelation = model.fKeys[i].relation;
          include[j]._model = model.fKeys[i].model;
          /*
          if (include[j].include) {
            let fModel = sygull.get(model.fKeys[i].model);
            handleIncludes(sygull, fModel, include[j].include, includeStrings);
          }
          */
        }
      }
    }
  }
  return includeCounts;
}

function handleSelectIncludes (sygull, options, parObject, callback) {
  for (let i = 0; i < options['include'].length; i++) {
    if (options['include'][i].include && options['include'][i]._model) {
      let fModel = sygull.get(options['include'][i]._model);
      doSelectQuery(sygull, fModel, options['include'][i], function (err, results) {
        if (err) {
          callback(err);
        } else {
          callback(null, coalesceMajor(parObject, results, options['include'][i]));
        }
      });
    } else {
      callback(null, parObject);
    }
  }
}

function doSelectQuery (sygull, model, options, callback) {
  if (typeof options.selectCols === 'undefined') {
    options.selectCols = [model.table + '.*'];
  }

  if (typeof options.conditionals === 'undefined') {
    options.conditionals = null;
  }

  if (typeof options.include === 'undefined') {
    options.include = {};
  }

  // check to see if options.selectCols is passed in, then that options.selectCols is a list
  if (!options.selectCols || !Array.isArray(options.selectCols)) {
    return (new Error('Select Columns must be an Array'));
  }

  let str = 'SELECT ';
  for (let i = 0; i < options.selectCols.length; i++) {
    str += (options.selectCols[i] + ', ');
  }

  // handle includes
  let includeStrings = {
    joinStrAddition: '',
    selectStrAddition: ''
  };

  let asyncCount = handleIncludes(sygull, model, options.include, includeStrings);

  // add on selects based on includes
  str += includeStrings.selectStrAddition;
  str = str.slice(0, -2);
  str = str + ' FROM ' + model.table;

  // add on joins based on includes;
  str += includeStrings.joinStrAddition + ' ';

  let selectBy = '';
  if (options.conditionals) {
    for (let prop in options.conditionals) {
      selectBy += String(prop) + '="' + options.conditionals[prop] + '" && ';
    }
    selectBy = selectBy.slice(0, -4);
  } else {
    selectBy = null;
  }

  if (selectBy) {
    str += (' WHERE ' + model.table + '.' + selectBy);
  }

  sygullUtil.log(str);
  sygull.db.query({sql: str, nestTables: true}, function (err, results) {
    if (err) {
      callback(err);
    } else {
      let coalescedSelect = coalesce(model, options.include, results);

      let asyncLoops = function (callback) {
        if (!asyncCount) {
          return callback(null, coalescedSelect);
        }
        let doneCount = 0;

        let counter = function (err, results) {
          if (err) callback(err);
          doneCount++;

          if (doneCount === asyncCount) {
            callback(null, results);
          }
        };

        handleSelectIncludes(sygull, options, coalescedSelect, counter);
      };
      asyncLoops(function (err, results) {
        if (err) return callback(err);
        else {
          callback(null, results);
        }
      });
      // asyncloopscallback(null, coalescedSelect);
    }
  });
}

module.exports = {
  find: function (sygull, model, options, callback) {
    // validateOptions(options);
    doSelectQuery(sygull, model, options, function (err, results) {
      if (err) callback(err);
      else {
        callback(null, results);
      }
    });
  }
};
