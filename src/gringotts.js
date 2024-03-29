import assert from 'assert';
import axios from 'axios';
import LightTransaction from '@/models/light-transaction';
import Receipt from '@/models/receipt';

class Gringotts {
  constructor (config, infinitechain) {
    this._nodeUrl = config.nodeUrl;
    this._infinitechain = infinitechain;
  }

  getSlice = async (stageHeight, lightTxHash) => {
    let url = this._nodeUrl + '/slice';
    return axios.get(url, {
      params: {
        stage_height: stageHeight,
        light_tx_hash: lightTxHash
      }
    });
  }

  getTrees = async (stageHeight) => {
    let url = this._nodeUrl + '/trees';
    return axios.get(url, {
      params: {
        stage_height: stageHeight
      }
    });
  }

  sendLightTx = async (lightTx) => {
    assert(lightTx instanceof LightTransaction, 'Parameter \'lightTx\' should be instance of LightTransaction.');
    let url = this._nodeUrl + '/send/light_tx';
    let res = await axios.post(url, { lightTxJson: lightTx.toJson() });
    res = res.data;
    if (res.ok) {
      let receiptJson = res.receipt;
      let receipt = new Receipt(receiptJson);

      return receipt;
    } else {
      throw new Error(`message: ${res.message}, code: ${res.code} `);
    }
  }

  getViableStageHeight = async () => {
    assert(this._nodeUrl, 'Can not find booster node.');
    let url = this._nodeUrl + '/viable/stage/height';
    let res = await axios.get(url);
    return parseInt(res.data.height);
  }

  fetchBoosterAddress = async () => {
    let url = this._nodeUrl + '/booster/address';
    return axios.get(url);
  }

  fetchServerAddress = async () => {
    let url = this._nodeUrl + '/server/address';
    return axios.get(url);
  }

  fetchRootHashes = async (stageHeight = null) => {
    let url = this._nodeUrl + '/roothash';
    if (stageHeight) {
      url = url + '/' + stageHeight.toString();
    }

    return axios.get(url);
  }

  attach = async (serializedTx, stageHeight) => {
    let url = this._nodeUrl + '/attach';
    return axios.post(url, { serializedTx: serializedTx, stageHeight: stageHeight });
  }

  getOffchainReceipts = async (stageHeight) => {
    let url = this._nodeUrl + '/receipts/' + stageHeight;
    return axios.get(url);
  }

  getAccountBalances = async (stageHeight) => {
    let url = this._nodeUrl + '/accounts/' + stageHeight;
    return axios.get(url);
  }

  getAssetList = async () => {
    let url = this._nodeUrl + '/assetlist';
    let res = await axios.get(url);
    return res.data.assetList;
  }
}

export default Gringotts;
