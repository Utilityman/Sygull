'use strict';

let mysql = require('mysql2');
let sygullCreate = require('./sygull.create');
let sygullTypes = require('./sygull.types');
let sygullRelations = require('./sygull.relations');
let sygullUtil = require('./sygull.util');
let sygullAdd = require('./sygull.add');
let sygullFind = require('./sygull.select');
let sygullUpdate = require('./sygull.update');
let _ = require('lodash');

class Model {
  constructor (fields, fKeys) {
    // TODO: Make sure defaults are added here and not assumed
    // TODO: Iterate over fKEys and add defaults

    this.fields = fields;
    if (typeof fKeys === 'undefined') this.fKeys = [];
    else this.fKeys = fKeys;
    this.table = undefined;
    this.data = {};

    if (typeof this.fields['id'] === 'undefined') {
      this.fields['id'] = {
        autoIncrement: true,
        type: sygullTypes.UNSIGNED_INT,
        unsigned: true,
        notNull: true
      };
    }

    this.fields = sygullUtil.normalizeModelProps(this.fields);
    this.fKeys = sygullUtil.normalizeFKeys(this.fKeys);
  }

  // options {conditionals: {}, selectCols: [], include: {}}
  find (options, callback) {
    sygullUtil.normalizeOptionTopLevelProps(options);

    let localOptions = {};

    if (typeof callback === 'undefined') {
      callback = options;
    } else {
      localOptions = _.cloneDeep(options);
    }

    let model = this;
    sygullUtil.waitForConnection(sygull, function () {
      sygullFind.find(sygull, model, localOptions, function (err, results) {
        if (err) return callback(err);
        else {
          callback(null, results);
        }
      });
    });
  }

  // // FIND BY ID
  findById (id, options, callback) {
    sygullUtil.normalizeOptionTopLevelProps(options);

    let localOptions = {};

    if (typeof callback === 'undefined') {
      callback = options;
    } else {
      localOptions = _.cloneDeep(options);
    }

    localOptions.conditionals = {};
    localOptions.conditionals['id'] = id;

    let model = this;
    sygullUtil.waitForConnection(sygull, function () {
      sygullFind.find(sygull, model, localOptions, function (err, results) {
        if (err) return callback(err);
        else {
          if (results.length === 1) {
            callback(null, results[0]);
          } else callback(null, {});
        }
      });
    });
  }

  findOne (options, callback) {
    sygullUtil.normalizeOptionTopLevelProps(options);

    let localOptions = {};

    if (typeof callback === 'undefined') {
      callback = options;
    } else {
      localOptions = _.cloneDeep(options);
    }

    let model = this;
    sygullUtil.waitForConnection(sygull, function () {
      sygullFind.find(sygull, model, localOptions, function (err, results) {
        if (err) return callback(err);
        else {
          if (results.length) {
            callback(null, results[0]);
          } else callback(null, {});
        }
      });
    });
  }

  findOrSave (object, options, callback) {
    sygullUtil.normalizeOptionTopLevelProps(options);

    let model = this;
    model.find(options, function (err, results) {
      if (err) callback(err);
      else {
        if (results.length === 1) object.id = results[0].id;
        if (results.length <= 1) {
          model.save(object, function (err, reuslts) {
            if (err) callback(err);
            else callback(null, results);
          });
        } else {
          callback(new Error('Results of findOrSave ambiguous - more than one result found'));
        }
      }
    });
  }

  add (object, options, callback) {
    let localOptions = {};

    if (typeof callback === 'undefined') {
      callback = options;
    } else {
      localOptions = _.cloneDeep(options);
    }
    sygullUtil.normalizeOptionTopLevelProps(localOptions);
    let model = this;
    sygullUtil.waitForConnection(sygull, function () {
      sygull._inTransaction = true;
      // TODO: If no includes, no need for transaction - just DO IT
      sygull.db.beginTransaction(function (err) {
        if (err) callback(err);
        sygullAdd.add(sygull, model, object, localOptions, function (err, results) {
          if (err) {
            return sygull.db.rollback(function () {
              callback(err);
            });
          }
          sygull.db.commit(function (err) {
            sygull._inTransaction = false;
            if (err) {
              return sygull.db.rollback(function () {
                callback(err);
              });
            }
            model.findById(results.insertId, localOptions, function (err, results) {
              if (err) return callback(err);
              else return callback(null, results);
            });
          });
        });
      });
    });
  }

  _noTransactionAdd (object, options, callback) {
    let instance = this;
    if (typeof callback === 'undefined') {
      callback = options;
      options = {};
    }

    sygullUtil.normalizeOptionTopLevelProps(options);
    let model = this;
    sygullUtil.waitForConnection(sygull, function () {
      sygullAdd.add(sygull, model, object, options, function (err, results) {
        if (err) return callback(err);
        else {
          instance.findById(results.insertId, function (err, result) {
            if (err) return callback(err);
            callback(null, result);
          });
          // return callback(null, results);
        }
      });
    });
  }

  update (object, options, callback) {
    let localOptions = {};

    if (typeof callback === 'undefined') {
      callback = options;
    } else {
      localOptions = _.cloneDeep(options);
    }
    sygullUtil.normalizeOptionTopLevelProps(localOptions);

    let model = this;
    sygullUtil.waitForConnection(sygull, function () {
      sygull._inTransaction = true;
      // TODO: If no includes, no need for transaction - just DO IT
      sygull.db.beginTransaction(function (err) {
        if (err) callback(err);

        sygullUpdate.update(sygull, model, object, localOptions, function (err, results) {
          if (err) {
            return sygull.db.rollback(function () {
              callback(err);
            });
          }
          sygull.db.commit(function (err) {
            sygull._inTransaction = false;
            if (err) {
              return sygull.db.rollback(function () {
                callback(err);
              });
            }
            model.findById(object.id, localOptions, function (err, results) {
              if (err) return callback(err);
              else return callback(null, results);
            });
          });
        });
      });
    });
  }

  _noTransactionUpdate (object, options, callback) {
    let instance = this;
    if (typeof callback === 'undefined') {
      callback = options;
      options = {};
    }
    sygullUtil.normalizeOptionTopLevelProps(options);

    let model = this;
    sygullUtil.waitForConnection(sygull, function () {
      sygullUpdate.update(sygull, model, object, options, function (err, results) {
        if (err) return callback(err);
        else {
          instance.findById(object.id, function (err, result) {
            if (err) return callback(err);
            callback(null, result);
          });
          // return callback(null, results);
        }
      });
    });
  }

  save (object, options, callback) {
    let localOptions = {};

    if (typeof callback === 'undefined') {
      callback = options;
    } else {
      localOptions = _.cloneDeep(options);
    }

    sygullUtil.normalizeOptionTopLevelProps(localOptions);
    let model = this;
    if (object.id) {
      // check to see if id is valid;
      model.update(object, localOptions, function (err, results) {
        if (err) {
          return callback(err);
        } else {
          callback(null, results);
        }
      });
    } else {
      model.add(object, localOptions, function (err, results) {
        if (err) {
          return callback(err);
        } else {
          callback(null, results);
        }
      });
    }
  }

  _noTransactionSave (object, options, callback) {
    sygullUtil.normalizeOptionTopLevelProps(options);

    let model = this;
    if (object.id) {
      model._noTransactionUpdate(object, options, function (err, results) {
        if (err) {
          return callback(err);
        } else {
          callback(null, results);
        }
      });
    } else {
      model._noTransactionAdd(object, options, function (err, results) {
        if (err) {
          return callback(err);
        } else {
          callback(null, results);
        }
      });
    }
  }

  delete (id, callback) {
    let model = this;
    sygullUtil.waitForConnection(sygull, function () {
      let deleteStatment = 'DELETE FROM ' + model.table + ' where id=' + id;
      sygull.db.query(deleteStatment, function (err, results) {
        callback(err, results);
      });
    });
  }
}

let sygull = {
  db: undefined,
  status: 0,  // 0: disconnected -> 1: connecting -> 2: connected, error -> 3
  connect: function (config) {
    if (typeof this.db === 'undefined' && !this.status) {
      this.status = 1;

      sygull.db = mysql.createConnection(config);

      let instance = this;

      if (config.logging === false) { // if we're not logging, don't log
        sygullUtil.log = function () {};
        sygullUtil.time = function () {};
        sygullUtil.timeEnd = function () {};
      }

      // async loops
      let iterateOverObjectOnSource = function (source, object, iterator, callback) {
        let doneCount = 0;
        function counter () {
          doneCount++;
          if (doneCount === Object.keys(object).length) {
            callback();
          }
        }
        for (let prop in object) {
          iterator(source, object[prop], counter);
        }
      };

      // set up SQL database according to models
      iterateOverObjectOnSource(instance, instance._models, sygullCreate.checkExistsAndUpdate, function () {
        if (typeof instance._modelsToCreate === 'undefined') {
          instance.status = 2;
        }
        iterateOverObjectOnSource(instance, instance._modelsToCreate, sygullCreate.createTable, function () {
          iterateOverObjectOnSource(instance, instance._modelsToCreate, sygullCreate.createAltersAndJunctions, function () {
            // once done
            instance._modelsToCreate = undefined;
            instance.status = 2;
          });
        });
      });
    } else {
      console.log('Already Connected');
    }
  },
  store: function (name, model) {
    model.table = name.toLowerCase();
    this._models[name.toLowerCase()] = model;
  },
  get: function (name) {
    return this._models[name.toLowerCase()];
  },
  _models: {},
  _fKeyAlters: [],
  _queries: [],
  _junctions: [],
  _maxTimeout: 10,
  _inTransaction: false,
  Model: Model,
  end: function (cb) {
    if (typeof this.db !== 'undefined') {
      this.db.end(function (err) {
        cb(err);
      });
    } else {
      cb(new Error('Err: Ending DB before connecting'));
    }
  },
  type: sygullTypes,
  relation: sygullRelations
};

module.exports = sygull;
