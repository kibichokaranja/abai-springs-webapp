// M-Pesa API Configuration
export const mpesaConfig = {
  // Production URLs (replace with sandbox URLs for testing)
  baseURL: process.env.MPESA_BASE_URL || 'https://sandbox.safaricom.co.ke',
  consumerKey: process.env.MPESA_CONSUMER_KEY || '',
  consumerSecret: process.env.MPESA_CONSUMER_SECRET || '',
  passkey: process.env.MPESA_PASSKEY || '',
  shortcode: process.env.MPESA_SHORTCODE || '',
  environment: process.env.MPESA_ENVIRONMENT || 'sandbox', // 'sandbox' or 'production'
  
  // API Endpoints
  endpoints: {
    auth: '/oauth/v1/generate?grant_type=client_credentials',
    stkPush: '/mpesa/stkpush/v1/processrequest',
    stkQuery: '/mpesa/stkpushquery/v1/query',
    b2c: '/mpesa/b2c/v1/paymentrequest',
    c2b: '/mpesa/c2b/v1/registerurl',
    accountBalance: '/mpesa/accountbalance/v1/query',
    transactionStatus: '/mpesa/transactionstatus/v1/query',
    reversal: '/mpesa/reversal/v1/request'
  },
  
  // Callback URLs
  callbacks: {
    stkPush: process.env.MPESA_STK_CALLBACK_URL || 'https://your-domain.com/api/payments/mpesa/callback',
    c2b: process.env.MPESA_C2B_CALLBACK_URL || 'https://your-domain.com/api/payments/mpesa/c2b-callback',
    b2c: process.env.MPESA_B2C_CALLBACK_URL || 'https://your-domain.com/api/payments/mpesa/b2c-callback'
  },
  
  // Transaction types
  transactionTypes: {
    customerPayBillOnline: 'CustomerPayBillOnline',
    customerBuyGoodsOnline: 'CustomerBuyGoodsOnline'
  }
};

// M-Pesa API Helper Functions
export class MpesaAPI {
  constructor() {
    this.baseURL = mpesaConfig.baseURL;
    this.consumerKey = mpesaConfig.consumerKey;
    this.consumerSecret = mpesaConfig.consumerSecret;
    this.passkey = mpesaConfig.passkey;
    this.shortcode = mpesaConfig.shortcode;
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  // Get access token
  async getAccessToken() {
    try {
      if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
        return this.accessToken;
      }

      const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
      const response = await fetch(`${this.baseURL}${mpesaConfig.endpoints.auth}`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get access token: ${response.statusText}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // Expire 1 minute early

      return this.accessToken;
    } catch (error) {
      console.error('Error getting M-Pesa access token:', error);
      throw error;
    }
  }

  // Generate timestamp
  generateTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');
    
    return `${year}${month}${day}${hour}${minute}${second}`;
  }

  // Generate password
  generatePassword() {
    const timestamp = this.generateTimestamp();
    const password = Buffer.from(`${this.shortcode}${this.passkey}${timestamp}`).toString('base64');
    return { password, timestamp };
  }

  // STK Push Request
  async initiateSTKPush(phoneNumber, amount, reference, description = 'Payment for Abai Springs') {
    try {
      const accessToken = await this.getAccessToken();
      const { password, timestamp } = this.generatePassword();
      
      // Format phone number (remove +254 and add 254)
      const formattedPhone = phoneNumber.replace(/^\+254/, '254').replace(/^0/, '254');
      
      const payload = {
        BusinessShortCode: this.shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: mpesaConfig.transactionTypes.customerPayBillOnline,
        Amount: Math.round(amount),
        PartyA: formattedPhone,
        PartyB: this.shortcode,
        PhoneNumber: formattedPhone,
        CallBackURL: mpesaConfig.callbacks.stkPush,
        AccountReference: reference,
        TransactionDesc: description
      };

      const response = await fetch(`${this.baseURL}${mpesaConfig.endpoints.stkPush}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`STK Push failed: ${errorData.errorMessage || response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        checkoutRequestID: data.CheckoutRequestID,
        merchantRequestID: data.MerchantRequestID,
        responseCode: data.ResponseCode,
        responseDescription: data.ResponseDescription,
        customerMessage: data.CustomerMessage
      };
    } catch (error) {
      console.error('STK Push error:', error);
      throw error;
    }
  }

  // STK Query Request
  async querySTKStatus(checkoutRequestID) {
    try {
      const accessToken = await this.getAccessToken();
      const { password, timestamp } = this.generatePassword();
      
      const payload = {
        BusinessShortCode: this.shortcode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestID
      };

      const response = await fetch(`${this.baseURL}${mpesaConfig.endpoints.stkQuery}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`STK Query failed: ${errorData.errorMessage || response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        resultCode: data.ResultCode,
        resultDesc: data.ResultDesc,
        checkoutRequestID: data.CheckoutRequestID,
        merchantRequestID: data.MerchantRequestID
      };
    } catch (error) {
      console.error('STK Query error:', error);
      throw error;
    }
  }

  // Verify callback signature (for security)
  verifyCallbackSignature(signature, timestamp, nonce, body) {
    // In production, implement proper signature verification
    // This is a simplified version
    const expectedSignature = this.generateSignature(timestamp, nonce, body);
    return signature === expectedSignature;
  }

  generateSignature(timestamp, nonce, body) {
    // Implement proper signature generation based on M-Pesa documentation
    // This is a placeholder
    const data = `${timestamp}${nonce}${JSON.stringify(body)}`;
    return Buffer.from(data).toString('base64');
  }
}

export default MpesaAPI;
