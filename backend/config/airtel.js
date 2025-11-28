import axios from 'axios';
import crypto from 'crypto';

class AirtelMoneyAPI {
  constructor() {
    this.baseURL = process.env.AIRTEL_BASE_URL || 'https://openapiuat.airtel.africa';
    this.clientId = process.env.AIRTEL_CLIENT_ID;
    this.clientSecret = process.env.AIRTEL_CLIENT_SECRET;
    this.merchantId = process.env.AIRTEL_MERCHANT_ID;
    this.phoneNumber = process.env.AIRTEL_PHONE_NUMBER;
    this.pin = process.env.AIRTEL_PIN;
    this.environment = process.env.AIRTEL_ENVIRONMENT || 'sandbox';
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  // Generate access token
  async getAccessToken() {
    try {
      // Check if we have a valid token
      if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
        return this.accessToken;
      }

      const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      
      const response = await axios.post(`${this.baseURL}/merchant/v1/payments/auth`, {}, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      this.accessToken = response.data.access_token;
      // Set expiry to 1 hour from now (subtract 5 minutes for safety)
      this.tokenExpiry = new Date(Date.now() + 55 * 60 * 1000);
      
      return this.accessToken;
    } catch (error) {
      console.error('Airtel Money auth error:', error.response?.data || error.message);
      throw new Error('Failed to authenticate with Airtel Money API');
    }
  }

  // Generate transaction reference
  generateTransactionRef() {
    return `ABAI_${Date.now()}_${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
  }

  // Initiate Airtel Money payment
  async initiatePayment(phoneNumber, amount, transactionRef, description) {
    try {
      const token = await this.getAccessToken();
      
      const payload = {
        payee: {
          msisdn: phoneNumber
        },
        reference: transactionRef,
        transaction: {
          amount: amount,
          id: transactionRef
        },
        pin: this.pin
      };

      const response = await axios.post(`${this.baseURL}/merchant/v1/payments/`, payload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Country': 'KE',
          'X-Currency': 'KES'
        }
      });

      return {
        success: true,
        transactionId: response.data.data.transaction.id,
        status: response.data.data.transaction.status,
        message: 'Airtel Money payment initiated successfully'
      };
    } catch (error) {
      console.error('Airtel Money payment error:', error.response?.data || error.message);
      throw new Error(`Airtel Money payment failed: ${error.response?.data?.message || error.message}`);
    }
  }

  // Query transaction status
  async queryTransaction(transactionId) {
    try {
      const token = await this.getAccessToken();
      
      const response = await axios.get(`${this.baseURL}/standard/v1/payments/${transactionId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'X-Country': 'KE',
          'X-Currency': 'KES'
        }
      });

      return {
        success: true,
        transaction: response.data.data.transaction,
        status: response.data.data.transaction.status
      };
    } catch (error) {
      console.error('Airtel Money query error:', error.response?.data || error.message);
      throw new Error(`Failed to query Airtel Money transaction: ${error.response?.data?.message || error.message}`);
    }
  }

  // Validate phone number format
  validatePhoneNumber(phoneNumber) {
    // Remove any non-digit characters
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    // Check if it's a valid Kenyan phone number
    if (cleaned.startsWith('254')) {
      return cleaned;
    } else if (cleaned.startsWith('0')) {
      return '254' + cleaned.substring(1);
    } else if (cleaned.startsWith('7')) {
      return '254' + cleaned;
    }
    
    throw new Error('Invalid phone number format for Airtel Money');
  }

  // Check if credentials are configured
  isConfigured() {
    return !!(this.clientId && this.clientSecret && this.merchantId && this.phoneNumber && this.pin);
  }
}

export default AirtelMoneyAPI;
















































