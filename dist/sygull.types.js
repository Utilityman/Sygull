'use strict';

let STRING = function (length) {
  if (typeof length !== 'number') length = 255;
  if (!(this instanceof STRING)) return new STRING(length);
  this._length = length;
};

STRING.prototype.toSql = function () {
  return 'VARCHAR(' + this._length + ')';
};

STRING.prototype.validate = function (str) {
  return typeof str === 'string';
};

STRING.prototype.toString = function () {
  return 'String';
};

let BOOLEAN = function () {
  if (!(this instanceof BOOLEAN)) return new BOOLEAN();
};

BOOLEAN.prototype.toSql = function () {
  return 'TINYINT(1)';
};

BOOLEAN.prototype.validate = function (bool) {
  if (typeof bool === 'boolean') {
    return true;
  } else if (typeof bool === 'number') {
    return (bool === 1 || bool === 0);
  } else {
    return false;
  }
};

BOOLEAN.prototype.toString = function () {
  return 'Boolean';
};

let ENUM = function (arr) {
  if (typeof arr === 'undefined') {
    console.log('enum error, needs array'); // TODO: fix dis error handling
    process.exit(798);
  }
  if (!(this instanceof ENUM)) return new ENUM(arr);
  this._arr = arr;
};

ENUM.prototype.toSql = function () {
  let enumStr = 'ENUM(';
  for (let i = 0; i < this._arr.length; i++) {
    enumStr += '\'' + this._arr[i] + '\'' + ', ';
  }
  enumStr = enumStr.slice(0, -2);
  enumStr += ')';
  return enumStr;
};

ENUM.prototype.validate = function (value) {
  for (let i = 0; i < this._arr.length; i++) {
    if (this._arr[i] === value) {
      return true;
    }
  }
  return false;
};

ENUM.prototype.toString = function () {
  return this._arr.toString();
};

let INT = function (size) {
  if (typeof size !== 'number') size = 0;
  if (!(this instanceof INT)) return new INT(size);
  this._size = size;
};

INT.prototype.toSql = function () {
  if (this._size) {
    return 'INT(' + this._size + ')';
  } else {
    return 'INT';
  }
};

// TODO: DO FLOATS BREAK THIS???
INT.prototype.validate = function (int) {
  return (!isNaN(parseInt(int)));
};

INT.prototype.toString = function () {
  return 'Number';
};

let UNSIGNED_INT = function (size) {
  if (typeof size !== 'number') size = 0;
  if (!(this instanceof UNSIGNED_INT)) return new UNSIGNED_INT(size);
  this._size = size;
};

UNSIGNED_INT.prototype.toSql = function () {
  if (this._size) {
    return 'INT(' + this._size + ') UNSIGNED';
  } else {
    return 'INT UNSIGNED';
  }
};

UNSIGNED_INT.prototype.validate = function (int) {
  return (!isNaN(parseInt(int)) && parseInt(int) >= 0);
};

UNSIGNED_INT.prototype.toString = function () {
  return 'Positive Int';
};

let FLOAT = function (size) {
  if (typeof size !== 'number') size = 0;
  if (!(this instanceof FLOAT)) return new FLOAT(size);
  this._size = size;
};

FLOAT.prototype.toSql = function () {
  if (this._size) {
    return 'FLOAT(' + this._size + ')';
  } else {
    return 'FLOAT';
  }
};

FLOAT.prototype.validate = function (float) {
  return (!isNaN(parseFloat(float)));
};

FLOAT.prototype.toString = function () {
  return 'Float';
};

let DATE = function () {
  if (!(this instanceof DATE)) return new DATE();
};

DATE.prototype.toSql = function () {
  return 'DATE';
};

DATE.prototype.validate = function (date) {
  let newDate = new Date(date);
  if (newDate instanceof Date) {
    return true;
  } else {
    return false;
  }
};

DATE.prototype.toString = function () {
  return 'Date';
};

module.exports = {
  STRING: STRING,
  BOOLEAN: BOOLEAN,
  ENUM: ENUM,
  INT: INT,
  UNSIGNED_INT: UNSIGNED_INT,
  FLOAT: FLOAT,
  DATE: DATE
};
