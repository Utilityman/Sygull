
let sygull = require('../dist/sygull');
let Model = sygull.Model;

let UserModel = new Model({
  username: sygull.type.STRING,
  password: sygull.type.STRING
}, [{
  model: 'Role',
  relation: sygull.relation.JUNCTION('user_role')
}]);

let GuestModel = new Model({
  username: sygull.type.STRING,
  expirationDate: sygull.type.DATE
}, [{
  model: 'Role',
  relation: sygull.relation.JUNCTION('guest_role')
}]);

let RoleModel = new Model({
  type: sygull.type.ENUM(['Admin', 'User', 'Guest'])
});

sygull.store('User', UserModel);
sygull.store('Guest', GuestModel);
sygull.store('Role', RoleModel);

sygull.connect({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '********',
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
  role: {
    type: 'Admin'
  }
};

let guest = {
  username: 'guestLogin',
  expirationDate: new Date(),
  role: {
    type: 'Guest'
  }
};

let User = sygull.get('User');
let Guest = sygull.get('Guest');

User.add(user, {include: [{role: 'role'}]}, function (err, savedUser) {
  if (err) {
    console.log(err);
    return process.exit(1);
  }
  console.log('Results in callback from User.add');
  console.log(savedUser);
});

Guest.add(guest, {include: [{role: 'role'}]}, function (err, savedGuest) {
  if (err) {
    console.log(err);
    return process.exit(2);
  }
  console.log('Results in the callback from Guest.add');
  console.log(savedGuest);
});
