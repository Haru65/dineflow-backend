const crypto = require('crypto');

class PaytmChecksum {
  /**
   * Generate Paytm checksum
   * @param {Object} params - Payment parameters
   * @param {string} merchantKey - Paytm merchant key
   * @returns {string} - Generated checksum
   */
  static generateSignature(params, merchantKey) {
    const keys = Object.keys(params).sort();
    let data = '';
    
    keys.forEach(key => {
      if (params[key] && params[key] !== '') {
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
   * @param {Object} params - Payment response parameters
   * @param {string} merchantKey - Paytm merchant key
   * @param {string} checksum - Checksum to verify
   * @returns {boolean} - True if checksum is valid
   */
  static verifySignature(params, merchantKey, checksum) {
    const generatedChecksum = this.generateSignature(params, merchantKey);
    return generatedChecksum === checksum;
  }

  /**
   * Generate checksum for transaction token request
   * @param {Object} body - Request body
   * @param {string} merchantKey - Paytm merchant key
   * @returns {string} - Generated checksum
   */
  static generateSignatureByString(body, merchantKey) {
    const bodyString = JSON.stringify(body);
    const data = bodyString + merchantKey;
    
    return crypto
      .createHash('sha256')
      .update(data)
      .digest('hex');
  }
}

module.exports = PaytmChecksum;