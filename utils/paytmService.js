const crypto = require('crypto');
const https = require('https');
const axios = require('axios');
const PaytmChecksum = require('paytmchecksum');

class PaytmService {
  /**
   * Create Paytm transaction token
   * @param {Object} config - Paytm configuration
   * @param {Object} orderData - Order details
   * @returns {Promise<Object>} - Transaction token response
   */
  static async createTransactionToken(config, orderData) {
    const { merchantId, merchantKey, website, callbackUrl } = config;
    const { orderId, amount, customerId } = orderData;

    const requestBody = {
      body: {
        requestType: 'Payment',
        mid: merchantId,
        websiteName: website,
        orderId: orderId,
        callbackUrl: callbackUrl,
        txnAmount: {
          value: amount.toString(),
          currency: 'INR'
        },
        userInfo: {
          custId: customerId
        }
      }
    };

    try {
      // Generate checksum using official library
      const checksum = await PaytmChecksum.generateSignature(JSON.stringify(requestBody.body), merchantKey);
      requestBody.head = {
        signature: checksum
      };

      const response = await axios.post(
        'https://securegw-stage.paytm.in/theia/api/v1/initiateTransaction?mid=' + merchantId + '&orderId=' + orderId,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Paytm transaction token creation failed:', error.response?.data || error.message);
      throw new Error('Failed to create transaction token: ' + (error.response?.data?.body?.resultInfo?.resultMsg || error.message));
    }
  }

  /**
   * Verify payment callback
   * @param {Object} response - Paytm callback response
   * @param {string} merchantKey - Paytm merchant key
   * @returns {Object} - Verification result
   */
  static async verifyPaymentCallback(response, merchantKey) {
    const { CHECKSUMHASH, ...params } = response;
    
    try {
      const isValid = await PaytmChecksum.verifySignature(params, merchantKey, CHECKSUMHASH);

      return {
        isValid,
        orderId: response.ORDERID,
        transactionId: response.TXNID,
        status: response.STATUS,
        amount: response.TXNAMOUNT,
        responseCode: response.RESPCODE,
        responseMessage: response.RESPMSG,
        bankName: response.BANKNAME,
        paymentMode: response.PAYMENTMODE,
        gatewayName: response.GATEWAYNAME,
        bankTransactionId: response.BANKTXNID
      };
    } catch (error) {
      console.error('Checksum verification failed:', error);
      return {
        isValid: false,
        orderId: response.ORDERID,
        error: error.message
      };
    }
  }

  /**
   * Check transaction status
   * @param {Object} config - Paytm configuration
   * @param {string} orderId - Order ID
   * @returns {Promise<Object>} - Transaction status
   */
  static async checkTransactionStatus(config, orderId) {
    const { merchantId, merchantKey } = config;

    const requestBody = {
      body: {
        mid: merchantId,
        orderId: orderId
      }
    };

    try {
      const checksum = await PaytmChecksum.generateSignature(JSON.stringify(requestBody.body), merchantKey);
      requestBody.head = {
        signature: checksum
      };

      const response = await axios.post(
        'https://securegw-stage.paytm.in/theia/api/v1/getTransactionStatus',
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Paytm status check failed:', error.response?.data || error.message);
      throw new Error('Failed to check transaction status');
    }
  }

  /**
   * Generate Paytm checksum (legacy method for backward compatibility)
   * @param {Object} params - Payment parameters
   * @param {string} merchantKey - Paytm merchant key
   * @returns {Promise<string>} - Checksum
   */
  static async generateChecksum(params, merchantKey) {
    return await PaytmChecksum.generateSignature(params, merchantKey);
  }

  /**
   * Verify Paytm checksum (legacy method for backward compatibility)
   * @param {Object} params - Payment parameters
   * @param {string} checksum - Checksum to verify
   * @param {string} merchantKey - Paytm merchant key
   * @returns {Promise<boolean>} - True if checksum is valid
   */
  static async verifyChecksum(params, checksum, merchantKey) {
    return await PaytmChecksum.verifySignature(params, merchantKey, checksum);
  }

  /**
   * Create Paytm payment request (legacy method)
   * @param {Object} config - Payment configuration
   * @param {Object} orderData - Order data
   * @returns {Promise<Object>} - Payment form data
   */
  static async createPaymentRequest(config, orderData) {
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
    params.CHECKSUMHASH = await this.generateChecksum(params, merchantKey);

    return params;
  }

  /**
   * Create UPI payment data for QR code and direct UPI payments
   * @param {Object} config - Payment configuration
   * @param {Object} orderData - Order data
   * @returns {Promise<Object>} - UPI payment data
   */
  static async createUpiPaymentData(config, orderData) {
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

    // Generate merchant UPI ID (this would be provided by Paytm)
    const merchantUpiId = `${merchantId}@paytm`;
    const merchantName = 'DineFlow Restaurant';

    // Create UPI payment string
    const upiString = `upi://pay?pa=${merchantUpiId}&pn=${encodeURIComponent(merchantName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(`Order ${orderId}`)}`;

    // Generate QR code data (base64 or URL)
    const qrCodeData = this.generateQRCodeData(upiString);

    return {
      merchantUpiId,
      merchantName,
      amount: parseFloat(amount),
      orderId,
      upiString,
      qrCodeData,
      // Keep original params for fallback
      paymentParams: await this.createPaymentRequest(config, orderData)
    };
  }

  /**
   * Generate QR code data for UPI payment
   * @param {string} upiString - UPI payment string
   * @returns {string} - QR code data URL or base64
   */
  static generateQRCodeData(upiString) {
    // In a real implementation, you would use a QR code library
    // For now, return a placeholder or the UPI string
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiString)}`;
  }

  /**
   * Verify payment response from Paytm
   * @param {Object} response - Paytm callback response
   * @param {string} merchantKey - Paytm merchant key
   * @returns {Promise<Object>} - Verification result
   */
  static async verifyPaymentResponse(response, merchantKey) {
    const checksumhash = response.CHECKSUMHASH;
    
    // Remove checksum from params for verification
    const params = { ...response };
    delete params.CHECKSUMHASH;

    const isValid = await this.verifyChecksum(params, checksumhash, merchantKey);

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
