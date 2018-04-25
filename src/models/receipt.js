import EthUtils from 'ethereumjs-util';
import assert from 'assert';
import LightTransaction from '@/models/light-transaction';

const allowedReceiptJsonKeys = ['lightTxHash', 'lightTxData', 'sig', 'receiptData'];
const allowedReceiptDataKeys = ['GSN', 'lightTxHash', 'fromBalance', 'toBalance'];

class Receipt {
  constructor (receiptJson) {
    // Remove keys which are not in the whitelist
    Object.keys(receiptJson).forEach(key => {
      if (!allowedReceiptJsonKeys.includes(key)) {
        delete receiptJson[key];
      }
    });

    Object.keys(receiptJson.receiptData).forEach(key => {
      if (!allowedReceiptDataKeys.includes(key)) {
        delete receiptJson.receiptData[key];
      }
    });

    // Check Json format
    allowedReceiptJsonKeys.forEach(key => {
      assert(Object.keys(receiptJson).includes(key), 'Parameter \'receiptJson\' does not include key \'' + key + '\'.');
    });

    // Check lightTxData format
    let lightTx = new LightTransaction(receiptJson.lightTxData, receiptJson.sig);

    // check if clientLightTx and serverLightTx are empty or not.
    assert(lightTx.hasClientLightTxSig(), '\'clientLightTx\' signature is empty.');
    assert(lightTx.hasServerLightTxSig(), '\'serverLightTx\' signature is empty.');

    // Meanwhile make an ordered receiptData
    let receiptKeys = Object.keys(receiptJson.receiptData);
    let orderedReceiptData = {};
    allowedReceiptDataKeys.forEach(key => {
      assert(receiptKeys.includes(key), 'Parameter \'receiptData\' does not include key \'' + key + '\'.');
      orderedReceiptData[key] = receiptJson.receiptData[key];
    });
    assert(lightTx.lightTxHash === receiptJson.receiptData.lightTxHash, 'The \'lightTxHash\' is different in receiptData and lightTransaction.');

    this.lightTxHash = lightTx.lightTxHash;
    this.lightTxData = lightTx.lightTxData;
    this.receiptData = orderedReceiptData;
    this.receiptHash = EthUtils.sha3(
      Object.values(this.receiptData).reduce((acc, curr) => acc + curr, '')
    ).toString('hex');
    this.sig = lightTx.sig;
    this.sig.serverReceipt = {};
  }

  toJson () {
    let json = {
      lightTxHash: this.lightTxHash,
      lightTxData: this.lightTxData,
      receiptHash: this.receiptHash,
      receiptData: this.receiptData,
      sig: this.sig
    };
    return json;
  }
}

export default Receipt;
