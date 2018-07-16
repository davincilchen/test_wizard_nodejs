import EthUtils from 'ethereumjs-util';
import assert from 'assert';
import LightTransaction from '@/models/light-transaction';
import Receipt from './models/receipt';
import types from '@/models/types';

class Client {
  constructor (clientConfig, infinitechain) {
    this.serverAddress = clientConfig.serverAddress;
    this._infinitechain = infinitechain;
    this._storage = clientConfig.storage;
    this._nodeUrl = clientConfig.nodeUrl;
  }

  makeProposeDeposit = (assetID) => {
    if (!assetID) {
      assetID = 0;
    }
    return new Promise((resolve, reject) => {
      this._infinitechain.event.onProposeDeposit(async (err, result) => {
        if (err) {
          reject(err);
        } else {
          let logID = result.args._dsn;
          let nonce = this._getNonce();
          let value = result.args._value;
          let lightTxData = {
            assetID: assetID,
            value: value,
            fee: 0.01,
            nonce: nonce,
            logID: logID
          };

          let signedLightTx = await this.makeLightTx(types.deposit, lightTxData);
          resolve(signedLightTx);
        }
      });
    });
  }

  makeProposeWithdrawal = async (assetID, value) => {
    if (!assetID) {
      assetID = 0;
    }
    let nonce = this._getNonce();
    let clientAddress = this._infinitechain.signer.getAddress();
    let normalizedClientAddress = clientAddress.slice(-40).padStart(64, '0').slice(-64);
    let logID = this._sha3(normalizedClientAddress + nonce);
    let lightTxData = {
      assetID: assetID,
      value: value,
      fee: 0.01,
      nonce: nonce,
      logID: logID
    };

    let signedLightTx = await this.makeLightTx(types.withdrawal, lightTxData);
    return signedLightTx;
  }

  makeLightTx = async (type, lightTxData, metadata = null) => {
    // Prepare lightTxData
    lightTxData = await this._prepare(type, lightTxData);

    let lightTxJson = { lightTxData: lightTxData, metadata: metadata };

    // Create lightTx
    let lightTx = new LightTransaction(lightTxJson);

    // Sign lightTx
    let signer = this._infinitechain.signer;
    let signedLightTx = signer.signWithClientKey(lightTx);

    return signedLightTx;
  }

  saveLightTx = async (lightTx) => {
    assert(lightTx instanceof LightTransaction, 'Parameter \'lightTx\' should be instance of \'LightTransaction\'.');
    await this._storage.setLightTx(lightTx.lightTxHash, lightTx.toJson());
  }

  saveReceipt = async (receipt) => {
    assert(receipt instanceof Receipt, 'Parameter \'receipt\' should be instance of \'Receipt\'.');
    await this._storage.setReceipt(receipt.lightTxHash, receipt.toJson(), true);
  }

  getLightTx = async (lightTxHash) => {
    try {
      return await this._storage.getLightTx(lightTxHash);
    } catch (e) {
      console.log(e);
    }
  }

  getReceipt = async (receiptHash) => {
    try {
      return await this._storage.getReceipt(receiptHash);
    } catch (e) {
      console.log(e);
    }
  }

  getAllReceiptHashes = async (stageHeight) => {
    return await this._storage.getReceiptHashesByStageHeight(stageHeight);
  }

  takeObjection = async (payment) => {
    return this._infinitechain.booster.takeObjection(payment);
  }

  _sha3 (content) {
    return EthUtils.sha3(content).toString('hex');
  }

  _prepare = async (type, lightTxData) => {
    assert(Object.values(types).includes(type), 'Parameter \'type\' should be one of \'deposit\', \'withdrawal\', \'instantWithdraw\' or \'remittance\'');

    let clientAddress = this._infinitechain.signer.getAddress();

    switch (type) {
    case types.deposit:
      lightTxData.from = '0';
      lightTxData.to = clientAddress;
      break;
    case types.withdrawal:
      lightTxData.from = clientAddress;
      lightTxData.to = '0';
      break;
    case types.instantWithdrawal:
      lightTxData.from = clientAddress;
      lightTxData.to = '0';
      break;
    case types.remittance:
      lightTxData.nonce = this._getNonce();
      lightTxData.logID = '0';
      break;
    }
    return lightTxData;
  }

  _getNonce () {
    return this._sha3((Math.random()).toString());
  }

  getSyncerToken = async () => {
    return await this._storage.getSyncerToken();
  }

  refreshToken = async (token) => {
    await this._storage.saveSyncerToken(token);
  }

  syncReceipts = async () => {
    await this._storage.syncReceipts();
  }
}

export default Client;
