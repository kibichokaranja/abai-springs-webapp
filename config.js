// API Configuration for Abai Springs Web App
// This file automatically detects the environment and sets the correct API URL
// For Vercel: Set API_BASE_URL environment variable in Vercel dashboard

(function() {
  // Detect environment
  const isLocalhost = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1' ||
                      window.location.hostname === '';
  
  const isVercel = window.location.hostname.includes('vercel.app') ||
                   window.location.hostname.includes('.vercel.app');
  
  // Get API URL from environment variable (Vercel) or use defaults
  const getApiUrl = () => {
    // Check for meta tag first (can be injected by Vercel)
    const metaApiUrl = document.querySelector('meta[name="api-base-url"]');
    if (metaApiUrl && metaApiUrl.content) {
      return metaApiUrl.content;
    }
    
    // Check for data attribute on html or body tag
    const htmlApiUrl = document.documentElement.getAttribute('data-api-url');
    if (htmlApiUrl) {
      return htmlApiUrl;
    }
    
    // Default based on environment
    if (isLocalhost) {
      return 'http://localhost:3001/api';
    }
    
    // For production/Vercel, check for environment variable
    // Vercel injects env vars at build time, but for client-side JS,
    // we need to use a different approach
    // The API_BASE_URL should be set in Vercel and will be available
    // via a build-time replacement or we'll use a default
    
    // If on Vercel but no env var set, show warning
    if (isVercel) {
      console.warn('⚠️ API_BASE_URL not set. Please set API_BASE_URL environment variable in Vercel dashboard.');
      // Fallback - will be replaced by build script
      return 'https://abai-springs-webapp-production.up.railway.app/api';
    }
    
    // Fallback for other production environments
    return 'https://abai-springs-webapp-production.up.railway.app/api';
  };
  
  // Set global API_BASE_URL
  window.API_BASE_URL = getApiUrl();
  
  // Log for debugging (only in development)
  if (isLocalhost) {
    console.log('🔧 API Base URL:', window.API_BASE_URL);
  }
  
  // Also export for module systems
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { API_BASE_URL: window.API_BASE_URL };
  }
})();

