const { keccak256 } = require('ethereumjs-util');

function makeMerkleTree(hasedTxs) {
	let leaves = hasedTxs;
	let levels = [];
	levels.unshift(leaves);
  while (levels[0].length > 1) {
    levels.unshift(getNextLevel(levels));
  }
  return levels;
}

function getNextLevel(levels) {
	let nodes = [];
  for (let i = 0; i <= levels[0].length - 1; i += 2) {
      let left = levels[0][i];
      let right = typeof levels[0][i + 1] === 'undefined'
      	? ''
      	: levels[0][i + 1];
      nodes.push( keccak256(left + right) );
  }
  return nodes;
}

function createMembershipProof(levels, index) {
  let proof = [];
  for (let i = levels.length - 1; i > 0; i--) {
    let isRightNode = index % 2 === 1;
    let siblingIndex = isRightNode ? (index - 1) : (index + 1);
    proof.push(isRightNode ? 0 : 1);
    proof.push(typeof levels[i][siblingIndex] === 'undefined' ? "" : levels[i][siblingIndex]);
    index = Math.floor(index / 2);
  }
  return proof;
}

function checkMembership(root, target, proof) {
	let hash = target;
  for (let i = 0; i < proof.length - 1; i += 2) {
      const flag = proof[i];
      const sibling = proof[i+1];
      if (flag === 0) {
          hash = keccak256(sibling + hash);
      } else if (flag == 1) {
          hash = keccak256(hash + sibling);
      }
  }
  return hash === root;
}

module.exports = {
	makeMerkleTree, createMembershipProof, checkMembership
}
