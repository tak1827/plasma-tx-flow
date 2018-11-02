const BLKNUM_OFFSET = 1000000000;
const TXINDEX_OFFSET = 10000;

function encodeUtxoPos(blknum, txindex, oindex) {
  return (blknum * BLKNUM_OFFSET) + (txindex * TXINDEX_OFFSET) + (oindex * 1);
}

function decodeUtxoPos(utxoPos) {
  const blknum = Math.floor(utxoPos / BLKNUM_OFFSET);
  const txindex = Math.floor( (utxoPos % BLKNUM_OFFSET) / BLKNUM_OFFSET );
	const oindex = utxoPos - blknum * BLKNUM_OFFSET - txindex * TXINDEX_OFFSET;
  return { blknum, txindex, oindex };
}

module.exports = {
	encodeUtxoPos, decodeUtxoPos
}
