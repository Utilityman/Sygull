
let sygull = require('../dist/sygull');
let Model = sygull.Model;

let UserModel = new Model({
  username: sygull.type.STRING,
  password: sygull.type.STRING
});

sygull.store('User', UserModel);

sygull.connect({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '*******',
  database: 'sygull_example',
  client: 'mysql',
  createDatabaseTable: true,
  expiration: 1200 * 1000,
  checkExpirationInterval: 30 * 1000,
  logging: true
});

let user = {
  username: 'root',
  password: 'sygullIsGreat'
};

let User = sygull.get('User');

User.save(user, function (err, savedUser) {
  if (err) {
    console.log(err);
    return process.exit(1);
  }
  console.log('Results in callback from User.save');
  console.log(savedUser);

  // Examples of trying to find that user
  User.findById(savedUser.id, function (err, findByIdUser) {
    if (err) {
      console.log(err);
      return process.exit(2);
    }
    console.log('Results in callback of User.findById');
    console.log(findByIdUser);
  });

  User.find({conditionals: {username: 'root'}}, function (err, conditionalUserFind) {
    if (err) {
      console.log(err);
      return process.exit(2);
    }
    console.log('Results in callback of User.findById');
    console.log(conditionalUserFind);
  });
});
