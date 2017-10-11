
let sygull = require('../dist/sygull');
let Model = sygull.Model;

let UserModel = new Model({
  username: sygull.type.STRING,
  password: sygull.type.STRING
}, [{
  model: 'Job',
  relation: sygull.relation.HAS_ONE
}, {
  model: 'ArbitraryNumber',
  relation: sygull.relation.HAS_MANY
}]);

let ArbitraryNumberModel = new Model({
  number: sygull.type.INT
}, [{
  model: 'User',
  relation: sygull.relation.MANY_BELONG_TO
}]);

let JobModel = new Model({
  jobTitle: sygull.type.STRING
}, [{
  model: 'User',
  relation: sygull.relation.ONE_BELONGS_TO
}]);

sygull.store('User', UserModel);
sygull.store('ArbitraryNumber', ArbitraryNumberModel);
sygull.store('Job', JobModel);

sygull.connect({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'bracara12',
  database: 'sygull_example',
  client: 'mysql',
  createDatabaseTable: true,
  expiration: 1200 * 1000,
  checkExpirationInterval: 30 * 1000,
  logging: true
});

let user = {
  username: 'root',
  password: 'sygullIsGreat',
  job: {
    jobTitle: 'Seagull Tamer'
  },
  numbers: [{
    number: 1
  }, {
    number: 5
  }, {
    number: -5
  }]
};

let User = sygull.get('User');

User.add(user, {include: [{job: 'job'}, {ArbitraryNumber: 'numbers'}]}, function (err, savedUser) {
  if (err) {
    console.log(err);
    return process.exit(1);
  }
  console.log('Results in callback from User.add');
  console.log(savedUser);

  // Examples of trying to find users with a job and numbers attached.
  User.findById(savedUser.id, {include: [{job: 'job'}, {ArbitraryNumber: 'numbers'}]}, function (err, findByIdUser) {
    if (err) {
      console.log(err);
      return process.exit(2);
    }
    console.log('Results in callback of User.findById');
    console.log(findByIdUser);
  });

  User.find({conditionals: {username: 'root'}, include: [{job: 'job'}, {ArbitraryNumber: 'numbers'}]}, function (err, conditionalUserFind) {
    if (err) {
      console.log(err);
      return process.exit(2);
    }
    console.log('Results in callback of User.findById');
    console.log(conditionalUserFind);
  });
});
