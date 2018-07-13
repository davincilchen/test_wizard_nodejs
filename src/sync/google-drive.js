const { google } = require('googleapis');

class GoogleDrive {
  setCredentials (clientId, clientSecret, redirectUris) {
    this._infinitechain = null;
    this.oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUris[0]);
  }

  initToken = async () => {
    try {
      let existedToken = await this._infinitechain.client.getSyncerToken();
      if (existedToken) {
        await this._refreshToken(existedToken);
      }
    } catch (e) {
      console.error(e);
    }
  }

  _refreshToken = async (existedToken = null) => {
    try {
      if (existedToken) {
        this.oauth2Client.setCredentials(existedToken);
      }
      this.oauth2Client.refreshAccessToken(async (err, tokens) => {
        if (err) return;
        if (tokens.refresh_token) {
          let token = tokens.refresh_token;
          this.oauth2Client.setCredentials({
            refresh_token: token
          });
          await this._infinitechain.client.refreshToken(token);
        }
      });
      let auth = this.oauth2Client;
      this.drive = google.drive({ version: 'v3', auth });
    } catch (e) {
      console.error(e);
    }
  }

  setInfinitechain (infinitechain) {
    this._infinitechain = infinitechain;
  }

  setToken = async (token) => {
    await this._refreshToken(token);
  }

  async uploadReceipt (address, receipt) {
    let targetFolderName = 'receipts-' + address;
    let targetFolderId;
    let res = await this.drive.files.list({
      'fullText': targetFolderName,
      'mimeType': 'application/vnd.google-apps.folder'
    });
    for (let i = 0; i < res.data.files.length; i++) {
      let file = res.data.files[i];
      if (file.name == targetFolderName) {
        targetFolderId = file.id;
        break;
      }
    }

    if (!targetFolderId) {
      targetFolderId = await this._createFolder(address);
    }
    this._uploadReceipt(targetFolderId, receipt);
  }

  _createFolder (address) {
    return new Promise(async (resolve) => {
      var fileMetadata = {
        name: 'receipts-' + address,
        mimeType: 'application/vnd.google-apps.folder'
      };
      this.drive.files.create({
        resource: fileMetadata,
        fields: 'id'
      }, function (err, response) {
        if (err) {
          console.error(err);
        } else {
          resolve(response.data.id);
        }
      });
    }).catch(console.error);
  }

  _uploadReceipt (folderId, receipt) {
    return new Promise(async (resolve, reject) => {
      let fileMetadata = {
        'name': receipt.lightTxHash,
        'mimeType': 'application/json',
        parents: [folderId]
      };
      let media = {
        mimeType: 'application/json',
        body: JSON.stringify(receipt)
      };
      this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id'
      }, (err, response) => {
        if (err) {
          reject(err);
        } else {
          resolve(response.data.id);
        }
      });
    }).catch(console.error);
  }
}

export default GoogleDrive;
