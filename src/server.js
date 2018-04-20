import EthUtils from 'ethereumjs-util';
import axios from 'axios';
import assert from 'assert';

class Server {
  constructor (serverConfig, infinitechain) {
    this.serverConfig = serverConfig;
    this._infinitechain = infinitechain;

    assert(serverConfig.web3Url != undefined, 'Opt should include web3Url.');    
    assert(serverConfig.nodeUrl != undefined, 'Opt should include nodeUrl.');
    this._web3Url = serverConfig.web3Url;
    this._nodeUrl = serverConfig.nodeUrl;
  }

  signRawPayment = (rawPayment) => {
    assert(this._validateRawPayment(rawPayment), 'Wrong rawPayment format.');

    let stageHash = EthUtils.sha3(rawPayment.stageHeight.toString()).toString('hex');
    let paymentHashAndCiphers = this._computePaymentHashAndCiphers(rawPayment);
    let paymentHash = paymentHashAndCiphers.paymentHash;
    let ciphers = paymentHashAndCiphers.ciphers;
    let message = stageHash + paymentHash;
    let msgHash = EthUtils.sha3(message);
    let prefix = new Buffer('\x19Ethereum Signed Message:\n');
    let ethMsgHash = EthUtils.sha3(Buffer.concat([prefix, new Buffer(String(msgHash.length)), msgHash]));
    let signature = this._infinitechain.crypto.sign(ethMsgHash);
    let publicKey = EthUtils.ecrecover(ethMsgHash, signature.v, signature.r, signature.s);
    let address = '0x' + EthUtils.pubToAddress(publicKey).toString('hex');

    assert(address == this._infinitechain.crypto.getSignerAddress(), 'Wrong signature.');

    return {
      stageHeight: rawPayment.stageHeight,
      stageHash: stageHash.toString('hex'),
      paymentHash: paymentHash.toString('hex'),
      cipherClient: ciphers.cipherClient,
      cipherStakeholder: ciphers.cipherStakeholder,
      v: signature.v,
      r: '0x' + signature.r.toString('hex'),
      s: '0x' + signature.s.toString('hex')
    };
  }

  pendingRootHashes = async () => {
    try {
      let url = this._nodeUrl + '/pending/roothashes';
      let res = await axios.get(url);
      return res.data;
    } catch (e) {
      console.log(e);
    }
  }

  sendPayments = async (payments) => {
    try {
      let url = this._nodeUrl + '/send/payments';
      let res = await axios.post(url, { payments: payments });
      return res.data;
    } catch (e) {
      console.log(e);
    }
  }

  sendLightTx = async (lightTx) => {
    let gringotts = this._infinitechain.gringotts;
    let receipt = await gringotts.sendLightTxs(lightTx);
    return receipt;
  }

  commitPayments = async (objectionTime, finalizeTime, data = '', targetRootHash = '', nonce = null) => {
    let url = this._nodeUrl + '/roothash';
    let res = await axios.get(url, {
      params: {
        rootHash: targetRootHash
      }
    });

    if (res.data.ok) {
      let rootHash = res.data.rootHash;
      let stageHeight = res.data.stageHeight;

      let serializedTx = this._infinitechain.sidechain.addNewStage(rootHash, stageHeight, objectionTime, finalizeTime, data, nonce);
      console.log('Serialized: ' + serializedTx);

      let commitUrl = this._nodeUrl + '/commit/payments';
      let commitRes = await axios.post(commitUrl, { serializedTx: serializedTx, rootHash: rootHash });
      return commitRes.data.txHash;
    } else {
      throw new Error(res.data.message);
    }
  }

  finalize = async (stageHeight) => {
    return this._infinitechain.sidechain.finalize(stageHeight);
  }

  exonerate = async (stageHeight, paymentHash) => {
    let url = this._nodeUrl + '/slice';
    let res = await axios.get(url, {
      params: {
        stage_height: stageHeight, payment_hash: paymentHash
      }
    });

    let slice = res.data.slice;
    slice = slice.map(h => h.treeNodeHash);
    let collidingPaymentHashes = res.data.paymentHashArray;
    let treeNodeIndex = res.data.treeNodeIndex;

    return this._infinitechain.sidechain.exonerate(stageHeight, paymentHash, treeNodeIndex, slice, collidingPaymentHashes);
  }

  payPenalty = async (stageHeight, paymentHashes) => {
    return this._infinitechain.sidechain.payPenalty(stageHeight, paymentHashes);
  }

  _computePaymentHashAndCiphers = (rawPayment) => {
    let crypto = this._infinitechain.crypto;
    let serializedRawPayment = Buffer.from(JSON.stringify(rawPayment)).toString('hex');
    let cipherClient = crypto.encrypt(serializedRawPayment, rawPayment.data.pkClient);
    let cipherStakeholder = crypto.encrypt(serializedRawPayment, rawPayment.data.pkStakeholder);
    let paymentHash = EthUtils.sha3(cipherClient + cipherStakeholder).toString('hex');

    return {
      paymentHash: paymentHash,
      ciphers: {
        cipherClient: cipherClient,
        cipherStakeholder: cipherStakeholder,
      }
    };
  }

  _validateRawPayment = (rawPayment) => {
    if (!rawPayment.hasOwnProperty('from') ||
        !rawPayment.hasOwnProperty('to') ||
        !rawPayment.hasOwnProperty('value') ||
        !rawPayment.hasOwnProperty('localSequenceNumber') ||
        !rawPayment.hasOwnProperty('stageHeight') ||
        !rawPayment.hasOwnProperty('data')) {
      return false;
    }

    let data = rawPayment.data;

    if (!data.hasOwnProperty('pkClient') ||
        !data.hasOwnProperty('pkStakeholder')) {
      return false;
    }

    return true;
  }
}

export default Server;
