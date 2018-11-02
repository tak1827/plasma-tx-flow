const { rlphash, rlp, ecsign, ecrecover, pubToAddress, keccak256  } = 
  require('ethereumjs-util');

class Transaction {

	constructor(
		blknum1, txindex1, oindex1,
	  blknum2, txindex2, oindex2,
	  newowner1, amount1,
	  newowner2, amount2,
	  sig1, sig2,
	  fee
	) {

		// Input 1
	  this.blknum1 = blknum1;
	  this.txindex1 = txindex1;
	  this.oindex1 = oindex1;
	  this.sig1 = sig1;

    // Input 2
    this.blknum2 = blknum2;
    this.txindex2 = txindex2;
    this.oindex2 = oindex2;
    this.sig2 = sig2;

   	// Output 1
    this.newowner1 = newowner1;
    this.amount1 = amount1;

    // Output 2 
    this.newowner2 = newowner2;
    this.amount2 = amount2;

    // Fee
    this.fee = fee;
	}

	hash() {
    return rlphash(this.toUnsignedArray());
  }

  toUnsignedArray() {
  	return [
  		this.blknum1, this.txindex1, this.oindex1,
  		this.blknum2, this.txindex2, this.oindex2,
  		this.newowner1, this.amount1,
  		this.newowner2, this.amount2,
  		null, null,
  		this.fee
  	];
  }

  toArray() {
    const sig1 = this.sig1 === null
      ? this.sig1
      : [this.sig1.r, this.sig1.s, this.sig1.v];

    const sig2 = this.sig2 === null
      ? this.sig2
      : [this.sig2.r, this.sig2.s, this.sig2.v];

  	return [
  		this.blknum1, this.txindex1, this.oindex1,
  		this.blknum2, this.txindex2, this.oindex2,
  		this.newowner1, this.amount1,
  		this.newowner2, this.amount2,
  		sig1, sig2,
  		this.fee
  	];
  }

  encoded() {
    return rlp.encode(this.toUnsignedArray());
  }

  sender1() {
  	const pubKey = ecrecover(
  		this.hash(),
  		this.sig1.v, this.sig1.r, this.sig1.s, 
  		1
  	);
    return pubToAddress(pubKey).toString('hex');
  }

  sender2() {
  	const pubKey = ecrecover(
  		this.hash(),
  		this.sig2.v, this.sig2.r, this.sig2.s, 
  		1
  	);
    return pubToAddress(pubKey).toString('hex');
  }

	sign1(key) {
    this.sig1 = ecsign(this.hash(), key, 1);
  }

  sign2(key) {
    this.sig2 = ecsign(this.hash(), key, 1);
  }

}

function confirm(txHash, root, keys) {
  return keys.map(key => ecsign(keccak256(txHash + root), key, 1));
}

module.exports = { Transaction, confirm };
