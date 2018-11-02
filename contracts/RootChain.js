const Assert = require('assert');
const { keccak256, zeroAddress, rlp, ecrecover } = require('ethereumjs-util');
const { encodeUtxoPos, decodeUtxoPos } = require('../util');
const { checkMembership } = require('../merkle');
const { Transaction } = require('../Transaction');

const CHILD_BLOCK_INTERVAL = 1000;

class RootChain {

  onlyOperator() {
    Assert(msg.sender === this.operator,
      `Invalid operator: ${msg.sender}`
    );
  }

  constructor() {
    this.operator = msg.sender;
    this.currentChildBlock = CHILD_BLOCK_INTERVAL;
    this.currentDepositBlock = 1;
    this.plasmaBlockHeaders = {}; // Holding header of child chain's block.
		this.exits = {}; // List of withdraw tx
    this.value = 0; // Deposited ether

    this.address = uniqueid;
    uniqueid = (Number(`0x${uniqueid}`) + 1).toString(16);// Increment address
  }

  submitBlock(root) {
  	this.onlyOperator();

  	const timestamp = Math.floor((new Date()).getTime()/1000);

    const blknum = this.currentChildBlock.toString();

    this.plasmaBlockHeaders[blknum] = 
    	new PlasmaBlockHeader(root, timestamp);

    this.currentChildBlock += CHILD_BLOCK_INTERVAL;
    this.currentDepositBlock = 1;

    return blknum;
  }

  deposit() {
    // Only allow up to CHILD_BLOCK_INTERVAL deposits per child block.
    Assert(this.currentDepositBlock < CHILD_BLOCK_INTERVAL, 
    	`Deposit limit reached. ${this.currentDepositBlock}`);

    const tx = new Transaction(
      0, 0, 0,
      0, 0, 0,
      msg.sender, msg.value,
      0, 0,
      null, null,
      0
    );

    const root = tx.hash().toString('hex');

    const timestamp = Math.floor((new Date()).getTime()/1000);

    const depositBlock = this.getDepositBlock();

    this.plasmaBlockHeaders[depositBlock.toString()] = 
    	new PlasmaBlockHeader(root,timestamp);

    this.currentDepositBlock += 1;

    this.value += msg.value;

    return depositBlock;
  }

  startExit(utxoPos, txBytes, proof, sigs) {
    const { blknum, txindex, oindex } = decodeUtxoPos(utxoPos);
    const root = this.plasmaBlockHeaders[blknum].root;

    const tx = rlp.decode(txBytes);
    const hasSig2 = tx[3].toString('hex') === '' ? false : true;
    const txHash = keccak256(txBytes);

    Assert(tx[6].toString() === msg.sender);
    Assert(this.checkSigs(txHash, root, hasSig2, sigs), "Signatures must match.");
    Assert(checkMembership(root, txHash.toString('hex'), proof), "Transaction Merkle proof is invalid.");

    const amount1 = Number('0x' + tx[7].toString('hex'));
    const amount2 = tx[9].toString('hex') !== '' ? Number('0x' + tx[9].toString('hex')) : '';
    const fee = Number('0x' + tx[12].toString('hex'));
    const createdAt = this.plasmaBlockHeaders[blknum].timestamp;

    this.addExitToQueue(utxoPos, msg.sender, amount1 + amount2 - fee, createdAt);
  }

  finalizeExits() {

    while (typeof this.getNextExitKey() !== 'undefined') {

      const nexKey = this.getNextExitKey();
      const exitAmount =Number(this.exits[nexKey].amount);
      const user = users.find(user => user.address === this.exits[nexKey].owner);

      // User receive Ether
      user.transfer(exitAmount);

      // Decliment deposited ether
      this.value -= exitAmount;

      delete this.exits[nexKey];
    }
  }

  getDepositBlock() {
    return this.currentChildBlock - CHILD_BLOCK_INTERVAL + this.currentDepositBlock;
  }

  getExits(utxoPos) {
    return this.exits[utxoPos];
  }

  getNextExitKey() {
    let minExitableAt = Math.floor((new Date()).getTime()/1000);
    let nextKey;

    Object.keys(this.exits).forEach(key => {
      // if (Number(this.exits[key].exitableAt) < minExitableAt) {
      if (Number(this.exits[key].exitableAt) > minExitableAt) {
        minExitableAt = this.exits[key].exitableAt;
        nextKey = key;
      }
    });

    return nextKey;
  }

  checkSigs(txHash, root, hasSig2, sigs) {
    const confirmationHash = keccak256(txHash.toString('hex') + root);

    const check1 = 
      ecrecover(txHash, sigs.sig1.v, sigs.sig1.r, sigs.sig1.s, 1).toString('hex') ===
      ecrecover(confirmationHash, sigs.confirmSig1.v, sigs.confirmSig1.r, sigs.confirmSig1.s, 1).toString('hex');

    const check2 = hasSig2 
      ? ecrecover(txHash, sigs.sig2.v, sigs.sig2.r, sigs.sig2.s, 1) ===
        ecrecover(confirmationHash, sigs.confSig2.v, sigs.confSig2.r, sigs.confSig2.s, 1)
      : true;
    
    return check1 && check2;
  }

  addExitToQueue(utxoPos, exitor, amount, createdAt) {

      // Check exit is valid and doesn't already exist.
      Assert(amount > 0, "Exit value cannot be zero.");
      Assert(typeof this.exits[utxoPos] === 'undefined', "Exit cannot already exist.");

      // Time lock valiables
      const now = Math.floor((new Date()).getTime()/1000);
      const w1 = 60*60*24*7;// 1 week
      const w2 = 60*60*24*14;// 2 week

      // Exit request is locked at for least 2 week.
      const exitableAt = Math.max(createdAt + w2, now + w1);

      this.exits[utxoPos] = new Exit(exitor, amount, exitableAt);
    }
}

class Exit {
	constructor(owner, amount, exitableAt) {
		this.owner = owner;
		this.amount = amount;
    this.exitableAt = exitableAt;
	}
}

class PlasmaBlockHeader {
	constructor(root, timestamp) {
		this.root = root;
		this.timestamp = timestamp;
	}
}

module.exports = RootChain;
