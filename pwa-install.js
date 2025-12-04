// PWA Install Prompt Handler
class PWAInstallHandler {
  constructor() {
    this.deferredPrompt = null;
    this.installButton = null;
    this.isInstalled = false;
    
    this.init();
  }

  init() {
    // Check if already installed
    this.checkInstallStatus();
    
    // Listen for beforeinstallprompt event (Android Chrome/Edge)
    window.addEventListener('beforeinstallprompt', (e) => {
      console.log('📱 PWA install prompt available');
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallButton();
    });

    // Listen for appinstalled event
    window.addEventListener('appinstalled', () => {
      console.log('✅ PWA installed successfully');
      this.isInstalled = true;
      this.hideInstallButton();
      this.showInstallSuccess();
    });

    // Check if running as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      console.log('📱 Running as PWA');
      this.isInstalled = true;
    }

    // For iOS and other mobile browsers, show install prompt after a delay
    // iOS doesn't support beforeinstallprompt, so we show manual instructions
    if (!this.isInstalled) {
      // Check if user previously dismissed (within last 7 days)
      let shouldShow = true;
      try {
        const dismissedTime = localStorage.getItem('pwa-install-dismissed');
        if (dismissedTime) {
          const daysSinceDismissed = (Date.now() - parseInt(dismissedTime)) / (1000 * 60 * 60 * 24);
          if (daysSinceDismissed < 7) {
            shouldShow = false;
          }
        }
      } catch (e) {
        // Ignore localStorage errors
      }

      if (shouldShow) {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isIOS || (isMobile && !this.deferredPrompt)) {
          // Show iOS/manual install prompt after 3 seconds
          setTimeout(() => {
            if (!this.isInstalled && !this.deferredPrompt) {
              this.showIOSInstallPrompt();
            }
          }, 3000);
        }
      }
    }
  }

  checkInstallStatus() {
    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches || 
        window.navigator.standalone === true) {
      this.isInstalled = true;
    }
  }

  showInstallButton() {
    if (this.isInstalled) return;

    // Create install button if it doesn't exist
    if (!this.installButton) {
      this.createInstallButton();
    }

    // Show the button
    this.installButton.style.display = 'block';
    this.installButton.style.animation = 'slideInUp 0.5s ease-out';
  }

  hideInstallButton() {
    if (this.installButton) {
      this.installButton.style.animation = 'slideOutDown 0.5s ease-in';
      setTimeout(() => {
        this.installButton.style.display = 'none';
      }, 500);
      // Remember that user dismissed the prompt (don't show again for 7 days)
      try {
        localStorage.setItem('pwa-install-dismissed', Date.now().toString());
      } catch (e) {
        console.log('Could not save dismiss state');
      }
    }
  }

  createInstallButton() {
    // Create install button element
    this.installButton = document.createElement('div');
    this.installButton.id = 'pwa-install-button';
    this.installButton.innerHTML = `
      <div class="pwa-install-content">
        <div class="pwa-install-icon">
          <i class="fas fa-download"></i>
        </div>
        <div class="pwa-install-text">
          <h4>Install Abai Springs App</h4>
          <p>Get quick access to water delivery</p>
        </div>
        <button class="pwa-install-btn" onclick="pwaInstallHandler.installApp()">
          Install
        </button>
        <button class="pwa-install-close" onclick="pwaInstallHandler.hideInstallButton()">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;

    // Add styles
    this.addInstallButtonStyles();

    // Add to page
    document.body.appendChild(this.installButton);
  }

  addInstallButtonStyles() {
    // Check if styles already added
    if (document.getElementById('pwa-install-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'pwa-install-styles';
    style.textContent = `
      #pwa-install-button {
        position: fixed;
        bottom: 20px;
        left: 20px;
        right: 20px;
        background: linear-gradient(135deg, #2563eb, #1d4ed8);
        color: white;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(37, 99, 235, 0.3);
        z-index: 10001 !important;
        display: none;
        max-width: 400px;
        margin: 0 auto;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
      }

      .pwa-install-content {
        display: flex;
        align-items: center;
        padding: 16px;
        gap: 12px;
      }

      .pwa-install-icon {
        font-size: 24px;
        color: #60a5fa;
      }

      .pwa-install-text {
        flex: 1;
      }

      .pwa-install-text h4 {
        margin: 0 0 4px 0;
        font-size: 16px;
        font-weight: 600;
      }

      .pwa-install-text p {
        margin: 0;
        font-size: 14px;
        opacity: 0.9;
      }

      .pwa-install-btn {
        background: rgba(255, 255, 255, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.3);
        color: white;
        padding: 8px 16px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .pwa-install-btn:hover {
        background: rgba(255, 255, 255, 0.3);
        transform: translateY(-1px);
      }

      .pwa-install-close {
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.7);
        font-size: 16px;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        transition: all 0.2s ease;
      }

      .pwa-install-close:hover {
        background: rgba(255, 255, 255, 0.1);
        color: white;
      }

      @keyframes slideInUp {
        from {
          transform: translateY(100%);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }

      @keyframes slideOutDown {
        from {
          transform: translateY(0);
          opacity: 1;
        }
        to {
          transform: translateY(100%);
          opacity: 0;
        }
      }

      @media (max-width: 768px) {
        #pwa-install-button {
          left: 10px !important;
          right: 10px !important;
          bottom: 10px !important;
          max-width: none !important;
          width: calc(100% - 20px) !important;
        }
        
        .pwa-install-content {
          padding: 14px !important;
          flex-wrap: nowrap;
          gap: 10px;
        }
        
        .pwa-install-text {
          min-width: 0;
          flex: 1 1 auto;
        }
        
        .pwa-install-text h4 {
          font-size: 15px !important;
          margin-bottom: 4px;
        }
        
        .pwa-install-text p {
          font-size: 13px !important;
          line-height: 1.3;
        }

        .pwa-install-btn {
          flex: 0 0 auto;
          white-space: nowrap;
          padding: 10px 16px !important;
        }

        .pwa-install-icon {
          font-size: 20px !important;
        }
      }

      @media (max-width: 480px) {
        #pwa-install-button {
          left: 8px !important;
          right: 8px !important;
          bottom: 8px !important;
          width: calc(100% - 16px) !important;
        }
        
        .pwa-install-content {
          padding: 12px !important;
        }
        
        .pwa-install-text h4 {
          font-size: 14px !important;
        }
        
        .pwa-install-text p {
          font-size: 12px !important;
        }

        .pwa-install-btn {
          padding: 8px 14px !important;
          font-size: 13px !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  async installApp() {
    if (!this.deferredPrompt) {
      console.log('❌ Install prompt not available');
      return;
    }

    try {
      // Show the install prompt
      this.deferredPrompt.prompt();
      
      // Wait for the user to respond
      const { outcome } = await this.deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('✅ User accepted PWA install');
        this.hideInstallButton();
      } else {
        console.log('❌ User dismissed PWA install');
      }
      
      // Clear the deferred prompt
      this.deferredPrompt = null;
    } catch (error) {
      console.error('❌ Error during PWA install:', error);
    }
  }

  showIOSInstallPrompt() {
    if (this.isInstalled) return;

    // Create iOS install prompt
    const iosPrompt = document.createElement('div');
    iosPrompt.id = 'pwa-install-button';
    iosPrompt.innerHTML = `
      <div class="pwa-install-content">
        <div class="pwa-install-icon">
          <i class="fas fa-download"></i>
        </div>
        <div class="pwa-install-text">
          <h4>Install Abai Springs App</h4>
          <p>Tap <i class="fas fa-share"></i> then "Add to Home Screen"</p>
        </div>
        <button class="pwa-install-close" onclick="pwaInstallHandler.hideInstallButton()">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;

    // Add styles if not already added
    if (!document.getElementById('pwa-install-styles')) {
      this.addInstallButtonStyles();
    }

    // Replace or add the button
    const existing = document.getElementById('pwa-install-button');
    if (existing) {
      existing.replaceWith(iosPrompt);
      this.installButton = iosPrompt;
    } else {
      document.body.appendChild(iosPrompt);
      this.installButton = iosPrompt;
    }

    // Show the button
    this.installButton.style.display = 'block';
    this.installButton.style.animation = 'slideInUp 0.5s ease-out';
  }

  showInstallSuccess() {
    // Create success notification
    const successNotification = document.createElement('div');
    successNotification.className = 'pwa-success-notification';
    successNotification.innerHTML = `
      <div class="pwa-success-content">
        <i class="fas fa-check-circle"></i>
        <span>Abai Springs app installed successfully!</span>
      </div>
    `;

    // Add success styles
    const style = document.createElement('style');
    style.textContent = `
      .pwa-success-notification {
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #10b981, #059669);
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(16, 185, 129, 0.3);
        z-index: 10002 !important;
        animation: slideInDown 0.5s ease-out;
      }

      .pwa-success-content {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 600;
      }

      @keyframes slideInDown {
        from {
          transform: translateX(-50%) translateY(-100%);
          opacity: 0;
        }
        to {
          transform: translateX(-50%) translateY(0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(successNotification);

    // Remove after 3 seconds
    setTimeout(() => {
      successNotification.style.animation = 'slideOutUp 0.5s ease-in';
      setTimeout(() => {
        if (document.body.contains(successNotification)) {
          document.body.removeChild(successNotification);
        }
      }, 500);
    }, 3000);
  }

  // Public method to manually trigger install
  triggerInstall() {
    if (this.deferredPrompt) {
      this.installApp();
    } else {
      console.log('❌ Install prompt not available');
    }
  }
}

// Initialize PWA install handler
const pwaInstallHandler = new PWAInstallHandler();

// Add install button to navigation (optional)
function addInstallToNav() {
  const nav = document.querySelector('.nav-links');
  if (nav && !document.getElementById('nav-install')) {
    const installNavItem = document.createElement('li');
    installNavItem.id = 'nav-install';
    installNavItem.innerHTML = `
      <a href="#" class="nav-link ripple-link" onclick="pwaInstallHandler.triggerInstall(); return false;">
        <i class="fas fa-download"></i> Install App
      </a>
    `;
    nav.appendChild(installNavItem);
  }
}

// Add install button when page loads
document.addEventListener('DOMContentLoaded', () => {
  // Add to navigation after a delay
  setTimeout(addInstallToNav, 2000);
});

console.log('📱 PWA Install Handler loaded successfully!');





































