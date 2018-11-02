const { keccak256  } = require('ethereumjs-util');
const RootChain = require('./contracts/RootChain');
const { ChildChain, Block }  = require('./contracts/ChildChain');
const { encodeUtxoPos, decodeUtxoPos } = require('./util');
const { createMembershipProof } = require('./merkle');
const User = require('./User');
const { Transaction, confirm } = require('./Transaction');

/* Global variables */

// Define ethereum address seed as 4 (hex) character
global.uniqueid = "f001";

// Same as msg.sender of solidity
global.msg = { sender: null, value: null };

// Users array
global.users = [];

// Create Users
let operator = new User();
let sam = new User();
let alice = new User();

// Sam is holding 10 Ether
sam.transfer(10);

/********************************
 1. Deploy root chain
*********************************/
operator.run(function() {

	// Rootchain
	// This is smart contract deployed to Ether main net.
	rootChain = new RootChain();
});


/********************************
 2. Operate create child chain
*********************************/
operator.run(function() {

	// Create child chain specifying operator as myself
  childChain = new ChildChain(this.address, rootChain);
});


/********************************
 3. Deposit Ether to Root Chain
*********************************/

// Biuld transaction for child chain
sam.withdraw(5);
const tx1 = new Transaction(
  0, 0, 0, // No input
  0, 0, 0, // No input
  sam.address, 5, // Send 5Ether to himself
  0, 0,
  null, null,// No signature
  1 // Fee
);

sam.run(function() {
	msg.value = tx1.amount1;

	// Confirm deposite target block
	const depositBlock = rootChain.deposit();

	// Utxo for sam
	sam.utxos.push(encodeUtxoPos(depositBlock, 0, 0));
});


operator.run(function() {

	// Tx1 is included this block
  let block = new Block([tx1]);

  block.sign(this.privateKey);
	
	childChain.addBlock(childChain.getDepositBlock(), block, true);
});


/********************************
 4. Spend UTXO
*********************************/

// Use utxo of sam as transaction input
const sutxo = decodeUtxoPos(sam.utxos[0]);
sam.utxos.shift();

let tx2 = new Transaction(
	sutxo.blknum, sutxo.txindex, sutxo.oindex,
	0, 0, 0,
	alice.address, // To alice
	tx1.amount1-tx1.fee, // Decrement amount by fee
	0, 0,
	null, null,
	1
);

tx2.sign1(sam.privateKey);

let sblock = null;

operator.run(function() {

  sblock = new Block([tx2]);

  sblock.sign(operator.privateKey);

	childChain.addBlock(childChain.nextChildBlock, sblock, false);

});

// Merkle root hash of block
const tx2root = sblock.merkle()[0][0];

let tx2blknum = null;

// Operator submit block to root chain
operator.run(function() {
	tx2blknum = rootChain.submitBlock(tx2root);
});

// Sam create confirmation sig
// And send to Alice
const confirmSigs = confirm(
	tx2.hash().toString('hex'), 
	tx2root,
	[sam.privateKey]
);

// Utxo for alice
const tx2Index = 0;
const tx2Pos = encodeUtxoPos(tx2blknum, tx2Index, 0);
alice.utxos.push(tx2Pos);


/********************************
 5. Withdraw UTXO
*********************************/
alice.run(function() {

	// Build sigs to attest tx is confirmed by sender
	const sigs = { 
		sig1: tx2.sig1,
		sig2: tx2.sig2,
		confirmSig1: confirmSigs[0],// Confirm sig from Sam
		confirmSig2: typeof confirmSigs[1] !== 'undefined' ? confirmSigs[1] : null
	};

	// Build proof to attest that tx is included in root chain
	const levels = childChain.getBlock(tx2blknum).merkle();
	const proof = createMembershipProof(levels, tx2Index);

	// This transaction contain utxo for Alice
	const utxoIncludedTx = tx2.encoded();

	this.utxos.shift();
	
	rootChain.startExit(tx2Pos, utxoIncludedTx, proof, sigs);

});

// After exit time lock expire, Alice receives utxo by sending exit finalize tx
// Alice receives 3 Ether (5 from Sam, 2 to Operator)
alice.run(function() {
	rootChain.finalizeExits();
});
 

console.log({
  users: JSON.stringify(users),
  RootChain: JSON.stringify(rootChain),
  ChildChain: JSON.stringify(childChain),
})
