'use strict';

// i have the id
let MANY_BELONG_TO = function () {
  if (!(this instanceof MANY_BELONG_TO)) return new MANY_BELONG_TO();
  this._isArray = true;
  this._hasKey = true;
};

// i have the id
let ONE_BELONGS_TO = function () {
  if (!(this instanceof ONE_BELONGS_TO)) return new ONE_BELONGS_TO();
  this._isArray = false;
  this._hasKey = true;
};

let JUNCTION = function (junction) {
  if (typeof junction !== 'string') return new Error('Invalid Junction Passed from Model');
  if (!(this instanceof JUNCTION)) return new JUNCTION(junction);
  this._isArray = true;
  this._junction = junction;
};

let HAS_MANY = function () {
  if (!(this instanceof HAS_MANY)) return new HAS_MANY();
  this._ignored = true; // TODO: for now?
  this._isArray = true;
};

let HAS_ONE = function () {
  if (!(this instanceof HAS_ONE)) return new HAS_ONE();
  this._ignored = true; // TODO: for now?
  this._isArray = false;
};

module.exports = {
  MANY_BELONG_TO: MANY_BELONG_TO,
  ONE_BELONGS_TO: ONE_BELONGS_TO,
  JUNCTION: JUNCTION,
  HAS_MANY: HAS_MANY,
  HAS_ONE: HAS_ONE
};
