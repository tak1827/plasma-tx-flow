const { randomBytes } = require('crypto');
const { privateToAddress } = require('ethereumjs-util');

class User {
  
  constructor() {
  	this.utxos = [];
  	this.privateKey = randomBytes(32);
  	this.address = privateToAddress(this.privateKey).toString('hex');
    this.balance = 0;
    
    users.push(this);
  }

  // Run contracts function
  run(callback) {
    msg.sender = this.address;
    callback.call(this);
  }

  transfer(value) {
    this.balance += value;
  }

  withdraw(value) {
    this.balance -= value;
  }
}

module.exports = User;
