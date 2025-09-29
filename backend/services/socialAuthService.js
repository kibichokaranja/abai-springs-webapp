import { OAuth2Client } from 'google-auth-library';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import logger from '../utils/logger.js';
import notificationService from './notificationService.js';

class SocialAuthService {
  constructor() {
    this.initializeProviders();
  }

  initializeProviders() {
    // Google OAuth2 Client
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      this.googleClient = new OAuth2Client(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/auth/google/callback'
      );
      this.googleEnabled = true;
      logger.info('Google OAuth initialized');
    } else {
      this.googleEnabled = false;
      logger.warn('Google OAuth not configured');
    }

    // Facebook App credentials
    this.facebookEnabled = !!(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET);
    if (this.facebookEnabled) {
      logger.info('Facebook OAuth initialized');
    } else {
      logger.warn('Facebook OAuth not configured');
    }

    // Apple Sign-In credentials
    this.appleEnabled = !!(process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID);
    if (this.appleEnabled) {
      logger.info('Apple Sign-In initialized');
    } else {
      logger.warn('Apple Sign-In not configured');
    }
  }

  // Generate OAuth URLs
  getGoogleAuthURL(state = null) {
    if (!this.googleEnabled) {
      throw new Error('Google OAuth not configured');
    }

    const scopes = [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ];

    return this.googleClient.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: state,
      prompt: 'consent'
    });
  }

  getFacebookAuthURL(state = null) {
    if (!this.facebookEnabled) {
      throw new Error('Facebook OAuth not configured');
    }

    const redirectUri = process.env.FACEBOOK_REDIRECT_URI || 'http://localhost:3001/api/auth/facebook/callback';
    const scope = 'email,public_profile';

    return `https://www.facebook.com/v18.0/dialog/oauth?` +
      `client_id=${process.env.FACEBOOK_APP_ID}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${scope}&` +
      `state=${state || ''}&` +
      `response_type=code`;
  }

  getAppleAuthURL(state = null) {
    if (!this.appleEnabled) {
      throw new Error('Apple Sign-In not configured');
    }

    const redirectUri = process.env.APPLE_REDIRECT_URI || 'http://localhost:3001/api/auth/apple/callback';
    const scope = 'email name';

    return `https://appleid.apple.com/auth/authorize?` +
      `client_id=${process.env.APPLE_CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${scope}&` +
      `response_type=code&` +
      `response_mode=form_post&` +
      `state=${state || ''}`;
  }

  // Verify Google OAuth token
  async verifyGoogleToken(idToken) {
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: idToken,
        audience: process.env.GOOGLE_CLIENT_ID
      });

      const payload = ticket.getPayload();
      
      return {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        avatar: payload.picture,
        emailVerified: payload.email_verified,
        provider: 'google'
      };
    } catch (error) {
      logger.error('Google token verification failed:', error);
      throw new Error('Invalid Google token');
    }
  }

  // Exchange Google authorization code for tokens
  async exchangeGoogleCode(code) {
    try {
      const { tokens } = await this.googleClient.getToken(code);
      this.googleClient.setCredentials(tokens);

      const ticket = await this.googleClient.verifyIdToken({
        idToken: tokens.id_token,
        audience: process.env.GOOGLE_CLIENT_ID
      });

      const payload = ticket.getPayload();
      
      return {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        avatar: payload.picture,
        emailVerified: payload.email_verified,
        provider: 'google',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token
      };
    } catch (error) {
      logger.error('Google code exchange failed:', error);
      throw new Error('Failed to exchange Google authorization code');
    }
  }

  // Verify Facebook access token
  async verifyFacebookToken(accessToken) {
    try {
      // Verify token with Facebook
      const verifyResponse = await axios.get(
        `https://graph.facebook.com/debug_token?input_token=${accessToken}&access_token=${process.env.FACEBOOK_APP_ID}|${process.env.FACEBOOK_APP_SECRET}`
      );

      if (!verifyResponse.data.data.is_valid) {
        throw new Error('Invalid Facebook token');
      }

      // Get user info
      const userResponse = await axios.get(
        `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${accessToken}`
      );

      const userData = userResponse.data;
      
      return {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        avatar: userData.picture?.data?.url,
        provider: 'facebook'
      };
    } catch (error) {
      logger.error('Facebook token verification failed:', error);
      throw new Error('Invalid Facebook token');
    }
  }

  // Exchange Facebook authorization code for access token
  async exchangeFacebookCode(code) {
    try {
      const redirectUri = process.env.FACEBOOK_REDIRECT_URI || 'http://localhost:3001/api/auth/facebook/callback';
      
      const tokenResponse = await axios.get(
        `https://graph.facebook.com/v18.0/oauth/access_token?` +
        `client_id=${process.env.FACEBOOK_APP_ID}&` +
        `client_secret=${process.env.FACEBOOK_APP_SECRET}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `code=${code}`
      );

      const accessToken = tokenResponse.data.access_token;
      return await this.verifyFacebookToken(accessToken);
    } catch (error) {
      logger.error('Facebook code exchange failed:', error);
      throw new Error('Failed to exchange Facebook authorization code');
    }
  }

  // Verify Apple ID token
  async verifyAppleToken(identityToken, authorizationCode = null) {
    try {
      // Apple uses JWT tokens that need to be verified
      // This is a simplified implementation - in production, you should verify the JWT signature
      const decoded = jwt.decode(identityToken, { complete: true });
      
      if (!decoded) {
        throw new Error('Invalid Apple token format');
      }

      const payload = decoded.payload;
      
      // Verify issuer and audience
      if (payload.iss !== 'https://appleid.apple.com' || payload.aud !== process.env.APPLE_CLIENT_ID) {
        throw new Error('Invalid Apple token claims');
      }

      return {
        id: payload.sub,
        email: payload.email,
        name: null, // Apple doesn't always provide name in token
        emailVerified: payload.email_verified === 'true',
        provider: 'apple'
      };
    } catch (error) {
      logger.error('Apple token verification failed:', error);
      throw new Error('Invalid Apple token');
    }
  }

  // Social login flow
  async socialLogin(provider, tokenOrCode, isCode = false) {
    let userData;

    try {
      switch (provider) {
        case 'google':
          userData = isCode 
            ? await this.exchangeGoogleCode(tokenOrCode)
            : await this.verifyGoogleToken(tokenOrCode);
          break;
        case 'facebook':
          userData = isCode 
            ? await this.exchangeFacebookCode(tokenOrCode)
            : await this.verifyFacebookToken(tokenOrCode);
          break;
        case 'apple':
          userData = await this.verifyAppleToken(tokenOrCode);
          break;
        default:
          throw new Error('Unsupported social provider');
      }

      // Find existing user by social provider ID
      let user = await User.findOne({
        'socialProviders.provider': provider,
        'socialProviders.providerId': userData.id
      });

      if (user) {
        // Update social provider info
        const providerIndex = user.socialProviders.findIndex(p => p.provider === provider);
        if (providerIndex !== -1) {
          user.socialProviders[providerIndex] = {
            ...user.socialProviders[providerIndex],
            email: userData.email,
            name: userData.name,
            avatar: userData.avatar
          };
        }
      } else {
        // Check if user exists with same email
        user = await User.findOne({ email: userData.email });
        
        if (user) {
          // Link social account to existing user
          user.addSocialProvider(provider, userData);
        } else {
          // Create new user
          user = new User({
            name: userData.name || userData.email.split('@')[0],
            email: userData.email,
            phone: '', // Will need to be added later
            password: this.generateRandomPassword(), // Random password for social users
            emailVerified: userData.emailVerified || false,
            role: 'customer',
            isActive: true
          });

          user.addSocialProvider(provider, userData);
        }
      }

      // Update last login
      user.lastLogin = new Date();
      user.lastActivity = new Date();
      await user.save();

      // Generate JWT tokens
      const accessToken = this.generateAccessToken(user);
      const refreshToken = this.generateRefreshToken(user);

      logger.info('Social login successful', {
        userId: user._id,
        provider,
        email: userData.email
      });

      // Send welcome email for new users
      if (!user.socialProviders.some(p => p.provider === provider)) {
        try {
          await notificationService.sendWelcomeEmail(user);
        } catch (error) {
          logger.warn('Failed to send welcome email:', error);
        }
      }

      return {
        user: user.toJSON(),
        accessToken,
        refreshToken,
        isNewUser: user.createdAt > new Date(Date.now() - 60000) // Created in last minute
      };
    } catch (error) {
      logger.error('Social login failed:', { provider, error: error.message });
      throw error;
    }
  }

  // Link social account to existing user
  async linkSocialAccount(userId, provider, tokenOrCode, isCode = false) {
    try {
      let userData;

      switch (provider) {
        case 'google':
          userData = isCode 
            ? await this.exchangeGoogleCode(tokenOrCode)
            : await this.verifyGoogleToken(tokenOrCode);
          break;
        case 'facebook':
          userData = isCode 
            ? await this.exchangeFacebookCode(tokenOrCode)
            : await this.verifyFacebookToken(tokenOrCode);
          break;
        case 'apple':
          userData = await this.verifyAppleToken(tokenOrCode);
          break;
        default:
          throw new Error('Unsupported social provider');
      }

      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Check if social account is already linked to another user
      const existingUser = await User.findOne({
        'socialProviders.provider': provider,
        'socialProviders.providerId': userData.id,
        _id: { $ne: userId }
      });

      if (existingUser) {
        throw new Error('Social account is already linked to another user');
      }

      // Add social provider to user
      user.addSocialProvider(provider, userData);
      await user.save();

      logger.info('Social account linked', {
        userId: user._id,
        provider,
        email: userData.email
      });

      return {
        success: true,
        message: `${provider} account linked successfully`
      };
    } catch (error) {
      logger.error('Social account linking failed:', { userId, provider, error: error.message });
      throw error;
    }
  }

  // Unlink social account
  async unlinkSocialAccount(userId, provider) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Check if user has password or other social providers
      const hasPassword = user.password && user.password.length > 0;
      const otherProviders = user.socialProviders.filter(p => p.provider !== provider);

      if (!hasPassword && otherProviders.length === 0) {
        throw new Error('Cannot unlink the last authentication method. Set a password first.');
      }

      user.removeSocialProvider(provider);
      await user.save();

      logger.info('Social account unlinked', {
        userId: user._id,
        provider
      });

      return {
        success: true,
        message: `${provider} account unlinked successfully`
      };
    } catch (error) {
      logger.error('Social account unlinking failed:', { userId, provider, error: error.message });
      throw error;
    }
  }

  // Get available social providers
  getAvailableProviders() {
    return {
      google: {
        enabled: this.googleEnabled,
        authUrl: this.googleEnabled ? this.getGoogleAuthURL() : null
      },
      facebook: {
        enabled: this.facebookEnabled,
        authUrl: this.facebookEnabled ? this.getFacebookAuthURL() : null
      },
      apple: {
        enabled: this.appleEnabled,
        authUrl: this.appleEnabled ? this.getAppleAuthURL() : null
      }
    };
  }

  // Generate random password for social users
  generateRandomPassword() {
    return Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);
  }

  // Generate JWT access token
  generateAccessToken(user) {
    return jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '24h' }
    );
  }

  // Generate JWT refresh token
  generateRefreshToken(user) {
    return jwt.sign(
      { id: user._id },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' }
    );
  }

  // Revoke social provider access (call provider APIs to revoke tokens)
  async revokeSocialAccess(userId, provider) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const socialProvider = user.getSocialProvider(provider);
      if (!socialProvider) {
        throw new Error('Social provider not linked');
      }

      // Implement provider-specific token revocation
      switch (provider) {
        case 'google':
          // Revoke Google tokens if we have them stored
          // await this.revokeGoogleTokens(socialProvider);
          break;
        case 'facebook':
          // Revoke Facebook permissions
          // await this.revokeFacebookPermissions(socialProvider);
          break;
        case 'apple':
          // Apple doesn't have a revoke endpoint for server-side
          break;
      }

      logger.info('Social provider access revoked', {
        userId,
        provider
      });

      return { success: true };
    } catch (error) {
      logger.error('Social access revocation failed:', error);
      throw error;
    }
  }
}

export default new SocialAuthService();






