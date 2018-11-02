const Assert = require('assert');
const { rlphash, ecsign, keccak256, ecrecover, pubToAddress } = 
	require('ethereumjs-util');
const { decodeUtxoPos } = require('../util');
const { makeMerkleTree } = require('../merkle');

const CHILD_BLOCK_INTERVAL = 1000;

class ChildChain {

	constructor(operator, rootChain) {
		this.operator = operator;
		this.rootChain = rootChain;
		this.blocks = {}; // All blocks consisting child chain
		this.nextDepositBlock = 1;
		this.nextChildBlock = CHILD_BLOCK_INTERVAL;
		this.accumulatedFee = 0;
	}

	addBlock(number, block, isDeposit) {

		if (number > this.nextChildBlock || 
			number <= this.nextChildBlock - CHILD_BLOCK_INTERVAL ||
			typeof this.blocks[number] !== 'undefined') 
		{
			return false;
		}

		this.validateBlock(block, isDeposit);

		// Collect fee as incentive for operator
		this.accumulatedFee += this.collectFee(block.txs);

		this.blocks[number] = block;

		if (isDeposit) {
			this.nextDepositBlock++;
		} else {
			this.nextChildBlock += CHILD_BLOCK_INTERVAL;
			this.nextDepositBlock = 1;
		}
		
		return true;
	}

	validateTransaction(tx, isDeposit) {

		let inputAmount = 0;

		for (let i = 0; i < 2; i++) {

			if ( (i === 0 && tx.blknum1 === 0) || (i === 1 && tx.blknum2 === 0) ) {
				continue;
			}

			const inputTx = i === 0 
				? this.blocks[tx.blknum1].txs[tx.txindex1]
				: this.blocks[tx.blknum2].txs[tx.txindex2];

			const oindex = i === 0
				? tx.oindex1
				: tx.oindex2;

			let validSignature = null;

			if (oindex === 0) {
				inputAmount += inputTx.amount1;
				validSignature = i === 0
					? tx.sig1 !== null && inputTx.newowner1 === tx.sender1()
					: tx.sig2 !== null && inputTx.newowner1 === tx.sender2();
				
			} else {
				inputAmount += inputTx.amount2;
				validSignature = i === 0
					? tx.sig1 !== null && inputTx.newowner2 === tx.sender1()
					: tx.sig2 !== null && inputTx.newowner2 === tx.sender2();
			}

			Assert(validSignature,
				`Invalid tx. ${JSON.stringify(tx)}`
			);

			Object.keys(this.blocks).forEach(key => {
				this.blocks[key].txs.forEach(txf => {

					const concatTx = i === 0 
						? tx.blknum1+tx.txindex1+tx.oindex1
						: tx.blknum2+tx.txindex2+tx.oindex2;

					Assert(concatTx !== txf.blknum1+txf.txindex1+txf.oindex1 ||
						concatTx !== txf.blknum2+txf.txindex2+txf.oindex2,
						`Already spent tx. ${JSON.stringify(tx)}`
					);

				});
			});
		}

		if (!isDeposit) {
			Assert(inputAmount >= tx.amount1 + tx.amount2,
				`Output is grater than input. ${JSON.stringify(tx)}`
			);
		}
	}

	validateBlock(block, isDeposit) {

		Assert(block.sig !== null && block.signer() === this.operator,
			`Invalid Signature. ${JSON.stringify(block)}`
		);

		block.txs.forEach(tx => {
			this.validateTransaction(tx, isDeposit);
		});
	}

	collectFee(txs) {
		return txs.reduce((ac, tx) => ac + tx.fee,0);
	}

	getDepositBlock() {
    return this.nextChildBlock - CHILD_BLOCK_INTERVAL + this.nextDepositBlock;
  }

	getBlock(blknum) {
		return this.blocks[blknum];
	}

	getTransaction(utxoPos) {
		const { blknum, txindex } = decodeUtxoPos(utxoPos);
		return this.blocks[blknum].txs[txindex];
	}

}


class Block {
	
	constructor(txs) {
		this.txs = txs;
		this.sig = null;
	}

	hash() {
    return rlphash(this.toUnsignedArray());
  }

  signer() {
  	const pubKey = ecrecover(
  		this.hash(),
  		this.sig.v, this.sig.r, this.sig.s, 
  		1
  	);
    return pubToAddress(pubKey).toString('hex');
  }

  merkle() {
  	const hasedTxs = this.txs.map(tx => {
			return rlphash(tx.toUnsignedArray()).toString('hex');
  	});
    return makeMerkleTree(hasedTxs)
  }

  toUnsignedArray() {
  	const txs = this.txs.map(tx => tx.toArray());
  	return [txs, null];
  }

	sign(key) {
    this.sig = ecsign(this.hash(), key, 1);
  }
  
}

module.exports = { ChildChain, Block };
