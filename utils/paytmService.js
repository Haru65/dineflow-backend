const crypto = require('crypto');
const https = require('https');
const querystring = require('querystring');

class PaytmService {
  /**
   * Generate Paytm checksum
   * @param {Object} params - Payment parameters
   * @param {string} merchantKey - Paytm merchant key
   * @returns {string} - Checksum
   */
  static generateChecksum(params, merchantKey) {
    const keys = Object.keys(params).sort();
    let data = '';
    
    keys.forEach(key => {
      if (params[key]) {
        data += params[key] + '|';
      }
    });
    
    data += merchantKey;
    
    return crypto
      .createHash('sha256')
      .update(data)
      .digest('hex');
  }

  /**
   * Verify Paytm checksum
   * @param {Object} params - Payment parameters
   * @param {string} checksum - Checksum to verify
   * @param {string} merchantKey - Paytm merchant key
   * @returns {boolean} - True if checksum is valid
   */
  static verifyChecksum(params, checksum, merchantKey) {
    const generatedChecksum = this.generateChecksum(params, merchantKey);
    return generatedChecksum === checksum;
  }

  /**
   * Create Paytm payment request
   * @param {Object} config - Payment configuration
   * @param {Object} orderData - Order data
   * @returns {Object} - Payment form data
   */
  static createPaymentRequest(config, orderData) {
    const {
      merchantId,
      merchantKey,
      website = 'WEBSTAGING',
      channelId = 'WEB',
      industryType = 'Retail'
    } = config;

    const {
      orderId,
      amount,
      customerId,
      customerEmail,
      customerPhone,
      callbackUrl
    } = orderData;

    const params = {
      MID: merchantId,
      ORDER_ID: orderId,
      CUST_ID: customerId,
      TXN_AMOUNT: amount.toString(),
      CHANNEL_ID: channelId,
      WEBSITE: website,
      INDUSTRY_TYPE_ID: industryType,
      EMAIL: customerEmail,
      MOBILE_NO: customerPhone,
      CALLBACK_URL: callbackUrl,
      CHECKSUMHASH: ''
    };

    // Generate checksum
    params.CHECKSUMHASH = this.generateChecksum(params, merchantKey);

    return params;
  }

  /**
   * Verify payment response from Paytm
   * @param {Object} response - Paytm callback response
   * @param {string} merchantKey - Paytm merchant key
   * @returns {Object} - Verification result
   */
  static verifyPaymentResponse(response, merchantKey) {
    const checksumhash = response.CHECKSUMHASH;
    
    // Remove checksum from params for verification
    const params = { ...response };
    delete params.CHECKSUMHASH;

    const isValid = this.verifyChecksum(params, checksumhash, merchantKey);

    return {
      isValid,
      orderId: response.ORDER_ID,
      transactionId: response.TXNID,
      status: response.STATUS,
      amount: response.TXNAMOUNT,
      responseCode: response.RESPCODE,
      responseMessage: response.RESPMSG,
      bankName: response.BANKNAME,
      bankTransactionId: response.BANKTXNID,
      gatewayName: response.GATEWAYNAME
    };
  }

  /**
   * Check transaction status from Paytm
   * @param {Object} config - Payment configuration
   * @param {string} orderId - Order ID
   * @returns {Promise<Object>} - Transaction status
   */
  static checkTransactionStatus(config, orderId) {
    return new Promise((resolve, reject) => {
      const { merchantId, merchantKey, website = 'WEBSTAGING' } = config;

      const params = {
        MID: merchantId,
        ORDERID: orderId,
        CHECKSUMHASH: ''
      };

      params.CHECKSUMHASH = this.generateChecksum(params, merchantKey);

      const postData = querystring.stringify(params);

      const options = {
        hostname: 'securegw-stage.paytm.in',
        port: 443,
        path: '/merchant-status/getTxnStatus',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            resolve(response);
          } catch (err) {
            reject(err);
          }
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * Get Paytm gateway URL based on environment
   * @param {string} environment - 'staging' or 'production'
   * @returns {string} - Gateway URL
   */
  static getGatewayUrl(environment = 'staging') {
    if (environment === 'production') {
      return 'https://securegw.paytm.in/theia/processTransaction';
    }
    return 'https://securegw-stage.paytm.in/theia/processTransaction';
  }

  /**
   * Get transaction status check URL
   * @param {string} environment - 'staging' or 'production'
   * @returns {string} - Status check URL
   */
  static getStatusCheckUrl(environment = 'staging') {
    if (environment === 'production') {
      return 'https://securegw.paytm.in/merchant-status/getTxnStatus';
    }
    return 'https://securegw-stage.paytm.in/merchant-status/getTxnStatus';
  }
}

module.exports = PaytmService;
