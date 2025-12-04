# 📱 Publishing Abai Springs to App Stores

## Overview

Your PWA can be published to both **Google Play Store** and **Apple App Store** by wrapping it in a native app container. The recommended tool is **Capacitor** by Ionic.

---

## 🎯 Two Approaches

### Option 1: Capacitor (Recommended) ⭐
- **Modern & Maintained**: Built by Ionic team
- **Easy Setup**: Wraps your PWA with minimal changes
- **Native Features**: Access to device features (camera, GPS, etc.)
- **Both Stores**: Works for iOS and Android

### Option 2: Trusted Web Activity (Android Only)
- **Android Only**: Google Play Store only
- **Simpler**: Just wraps PWA in Android app
- **No iOS**: Won't work for App Store

---

## 🚀 Quick Start with Capacitor

### Prerequisites

1. **Node.js** (v14 or higher)
2. **Xcode** (for iOS - Mac only, or use cloud build services)
3. **Android Studio** (for Android)
4. **Apple Developer Account** ($99/year for App Store)
5. **Google Play Developer Account** ($25 one-time for Play Store)

### Step 1: Install Capacitor

```bash
npm install @capacitor/core @capacitor/cli
npm install @capacitor/ios @capacitor/android
```

### Step 2: Initialize Capacitor

```bash
npx cap init "Abai Springs" "com.abaisprings.app"
```

### Step 3: Add Platforms

```bash
npx cap add ios
npx cap add android
```

### Step 4: Configure App

Edit `capacitor.config.json`:
```json
{
  "appId": "com.abaisprings.app",
  "appName": "Abai Springs",
  "webDir": ".",
  "server": {
    "url": "https://your-vercel-app.vercel.app",
    "cleartext": false
  },
  "plugins": {
    "SplashScreen": {
      "launchShowDuration": 2000
    }
  }
}
```

### Step 5: Build & Sync

```bash
npx cap sync
```

### Step 6: Open in Native IDEs

**For iOS:**
```bash
npx cap open ios
```
- Opens in Xcode
- Configure signing & certificates
- Build and submit to App Store

**For Android:**
```bash
npx cap open android
```
- Opens in Android Studio
- Build APK/AAB
- Submit to Play Store

---

## 📋 App Store Requirements

### Apple App Store

1. **Apple Developer Account** ($99/year)
2. **App Store Connect** account
3. **App Icons**: 1024x1024px (required)
4. **Screenshots**: 
   - iPhone: 6.5", 5.5" displays
   - iPad: 12.9", 11" displays
5. **Privacy Policy URL** (required)
6. **App Description** & Keywords
7. **Age Rating** information

### Google Play Store

1. **Google Play Developer Account** ($25 one-time)
2. **App Icons**: 512x512px (required)
3. **Screenshots**: 
   - Phone: At least 2 screenshots
   - Tablet: Optional but recommended
4. **Feature Graphic**: 1024x500px
5. **Privacy Policy URL** (required)
6. **App Description** & Short description

---

## 🎨 Required Assets

### App Icons
- **iOS**: 1024x1024px (no transparency)
- **Android**: 512x512px (can have transparency)

### Screenshots Needed

**iOS:**
- iPhone 6.5" (iPhone 14 Pro Max): 1284 x 2778px
- iPhone 5.5" (iPhone 8 Plus): 1242 x 2208px
- iPad Pro 12.9": 2048 x 2732px

**Android:**
- Phone: 1080 x 1920px (minimum)
- Tablet: 1200 x 1920px (optional)

### Feature Graphic (Android)
- 1024 x 500px

---

## 🔧 Configuration Files Needed

1. **capacitor.config.json** - Main Capacitor config
2. **package.json** - Add Capacitor scripts
3. **App icons** - All required sizes
4. **Splash screens** - Optional but recommended

---

## 💰 Costs

- **Apple Developer**: $99/year
- **Google Play Developer**: $25 one-time
- **Total First Year**: ~$124
- **Subsequent Years**: $99/year (Apple only)

---

## ⚡ Alternative: Cloud Build Services

If you don't have a Mac for iOS development:

1. **Appflow** (Ionic) - Cloud builds for iOS
2. **EAS Build** (Expo) - Alternative cloud build
3. **MacStadium** - Rent a Mac in the cloud

---

## 📝 Next Steps

1. Choose your approach (Capacitor recommended)
2. Set up developer accounts
3. Prepare app assets (icons, screenshots)
4. Configure and build
5. Submit to stores

---

## 🆘 Need Help?

- **Capacitor Docs**: https://capacitorjs.com/docs
- **App Store Connect**: https://appstoreconnect.apple.com
- **Google Play Console**: https://play.google.com/console

