/**
 * Paytm Payment Service
 * Handles all Paytm payment gateway operations with proper checksum generation and verification
 */

const axios = require('axios');
const PaytmChecksum = require('paytmchecksum');
const crypto = require('crypto');

// Paytm endpoints
const PAYTM_ENDPOINTS = {
  staging: {
    initiateTransaction: 'https://securegw-stage.paytm.in/theia/api/v1/initiateTransaction',
    verifyChecksum: 'https://securegw-stage.paytm.in/merchant-status/getTxnStatus'
  },
  production: {
    initiateTransaction: 'https://securegw.paytm.in/theia/api/v1/initiateTransaction',
    verifyChecksum: 'https://securegw.paytm.in/merchant-status/getTxnStatus'
  }
};

class PaytmService {
  constructor() {
    this.mid = process.env.PAYTM_MID;
    this.merchantKey = process.env.PAYTM_MERCHANT_KEY;
    this.website = process.env.PAYTM_WEBSITE;
    this.industryType = process.env.PAYTM_INDUSTRY_TYPE;
    this.channelId = process.env.PAYTM_CHANNEL_ID;
    this.environment = process.env.PAYTM_ENVIRONMENT || 'staging';
    this.callbackUrl = process.env.PAYTM_CALLBACK_URL;

    // Validate required environment variables
    if (!this.mid || !this.merchantKey || !this.website) {
      console.warn('⚠️  Warning: Paytm environment variables not fully configured');
    }
  }

  /**
   * Generate a unique Order ID
   * Format: ORDER_{timestamp}_{random}
   */
  generateOrderId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `ORDER_${timestamp}_${random}`;
  }

  /**
   * Create Paytm payment order
   * @param {Object} options - Payment options
   * @returns {Promise<Object>} Payment response with checksum
   */
  async createPaymentOrder(options) {
    try {
      const {
        orderId,
        amount,
        customerId,
        customerEmail,
        customerPhoneNumber,
        orderDescription = 'DineFlow Order',
        restaurantId
      } = options;

      // Validate inputs
      if (!orderId || !amount || !customerId) {
        throw new Error('Missing required fields: orderId, amount, customerId');
      }

      // Amount in paisa (multiply by 100)
      const amountInPaisa = Math.round(amount * 100);

      // Prepare transaction object
      const paytmParams = {
        MID: this.mid,
        WEBSITECODE: this.website,
        ORDER_ID: orderId,
        CUST_ID: customerId,
        MOBILE_NO: customerPhoneNumber || '',
        EMAIL: customerEmail || '',
        TXN_AMOUNT: amountInPaisa.toString(),
        INDUSTRY_TYPE_ID: this.industryType,
        CHANNEL_ID: this.channelId,
        CALLBACK_URL: this.callbackUrl,
        PAYMENT_TYPE_ID: 'CC',
        NOTES: JSON.stringify({
          restaurantId,
          orderDescription
        })
      };

      // Generate checksum
      const checksum = await PaytmChecksum.generateSignature(
        JSON.stringify(paytmParams),
        this.merchantKey
      );

      console.log(`📝 Paytm order created: ${orderId}`);

      return {
        success: true,
        data: {
          orderId,
          amount,
          amountInPaisa,
          checksum,
          paytmParams,
          initiateTransactionUrl: PAYTM_ENDPOINTS[this.environment].initiateTransaction,
          mid: this.mid,
          website: this.website
        }
      };
    } catch (error) {
      console.error('❌ Error creating Paytm order:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Verify payment checksum from Paytm callback
   * @param {Object} paytmResponse - Response from Paytm
   * @returns {Promise<boolean>} True if checksum is valid
   */
  async verifyChecksum(paytmResponse) {
    try {
      const {
        CHECKSUMHASH,
        ...paytmParams
      } = paytmResponse;

      // Verify checksum
      const isValidChecksum = await PaytmChecksum.verifySignature(
        JSON.stringify(paytmParams),
        this.merchantKey,
        CHECKSUMHASH
      );

      if (!isValidChecksum) {
        console.error('❌ Invalid Paytm checksum');
        return false;
      }

      console.log('✅ Paytm checksum verified successfully');
      return true;
    } catch (error) {
      console.error('❌ Error verifying Paytm checksum:', error.message);
      return false;
    }
  }

  /**
   * Check transaction status from Paytm
   * @param {string} orderId - Order ID
   * @returns {Promise<Object>} Transaction status details
   */
  async verifyTransaction(orderId) {
    try {
      // Prepare verification parameters
      const verifyParams = {
        MID: this.mid,
        ORDERID: orderId
      };

      // Generate checksum for verification request
      const checksum = await PaytmChecksum.generateSignature(
        JSON.stringify(verifyParams),
        this.merchantKey
      );

      verifyParams.CHECKSUMHASH = checksum;

      // Call Paytm verification API
      const response = await axios.post(
        PAYTM_ENDPOINTS[this.environment].verifyChecksum,
        verifyParams,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      const { body } = response.data;

      if (body.resultCode === '0000') {
        console.log(`✅ Transaction verified for order: ${orderId}`);
        return {
          success: true,
          status: body.txnStatus,
          orderId: body.orderId,
          txnAmount: body.txnAmount,
          txnDate: body.txnDate,
          txnId: body.txnId,
          bankName: body.bankName,
          paymentMode: body.paymentMode,
          responseCode: body.responseCode,
          responseMessage: body.responseMessage
        };
      } else {
        console.log(`⚠️  Transaction status check: ${body.resultCode}`);
        return {
          success: false,
          resultCode: body.resultCode,
          resultStatus: body.resultStatus,
          error: body.resultMsg || 'Transaction verification failed'
        };
      }
    } catch (error) {
      console.error('❌ Error verifying transaction:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Parse Paytm callback response
   * @param {Object} callbackData - Data from Paytm callback
   * @returns {Object} Parsed response with status
   */
  parseCallbackResponse(callbackData) {
    const extractedData = {
      orderId: callbackData.ORDERID,
      txnId: callbackData.TXNID,
      amount: callbackData.TXNAMOUNT,
      status: callbackData.STATUS,
      responseCode: callbackData.RESPCODE,
      responseMessage: callbackData.RESPMSG,
      paymentMode: callbackData.PAYMENTMODE,
      bankName: callbackData.BANKNAME,
      txnDate: callbackData.TXNDATE,
      gatewayName: callbackData.GATEWAYNAME,
      checksumHash: callbackData.CHECKSUMHASH,
      isSuccess: callbackData.STATUS === 'TXN_SUCCESS'
    };

    return extractedData;
  }

  /**
   * Get transaction status label
   * @param {string} status - Paytm transaction status code
   * @returns {string} Human-readable status
   */
  getStatusLabel(status) {
    const statusMap = {
      'TXN_SUCCESS': 'Payment Successful',
      'PENDING': 'Payment Pending',
      'TXN_FAILURE': 'Payment Failed',
      'CANCELLED': 'Payment Cancelled'
    };
    return statusMap[status] || 'Unknown Status';
  }
}

module.exports = new PaytmService();
