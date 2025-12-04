# 🚀 Setting Up Capacitor for App Store Publication

## Step-by-Step Installation

### 1. Install Capacitor

```bash
npm install
```

This will install all Capacitor dependencies including:
- `@capacitor/core` - Core Capacitor functionality
- `@capacitor/cli` - Command-line tools
- `@capacitor/ios` - iOS platform support
- `@capacitor/android` - Android platform support
- `@capacitor/app` - App lifecycle management
- `@capacitor/splash-screen` - Splash screen plugin
- `@capacitor/status-bar` - Status bar plugin

### 2. Initialize Capacitor (if not already done)

```bash
npx cap init
```

When prompted:
- **App name**: `Abai Springs`
- **App ID**: `com.abaisprings.app` (or your preferred bundle ID)
- **Web directory**: `.` (current directory)

### 3. Add Native Platforms

```bash
# Add iOS platform
npx cap add ios

# Add Android platform
npx cap add android
```

### 4. Sync Your Web App

```bash
npx cap sync
```

This copies your web files to the native projects.

### 5. Open in Native IDEs

**For iOS (requires Mac):**
```bash
npm run cap:open:ios
```
or
```bash
npx cap open ios
```

**For Android:**
```bash
npm run cap:open:android
```
or
```bash
npx cap open android
```

---

## 📱 Building for App Stores

### iOS (App Store)

1. **Open in Xcode:**
   ```bash
   npx cap open ios
   ```

2. **Configure Signing:**
   - Select your project in Xcode
   - Go to "Signing & Capabilities"
   - Select your Team (Apple Developer account)
   - Xcode will automatically manage certificates

3. **Update App Info:**
   - Bundle Identifier: `com.abaisprings.app`
   - Version: `1.0.0`
   - Build: `1`

4. **Add App Icons:**
   - In Xcode, go to `App/Assets.xcassets/AppIcon.appiconset`
   - Add your 1024x1024px icon

5. **Build & Archive:**
   - Product → Archive
   - Upload to App Store Connect
   - Submit for review

### Android (Google Play)

1. **Open in Android Studio:**
   ```bash
   npx cap open android
   ```

2. **Update App Info:**
   - Open `android/app/build.gradle`
   - Update `versionCode` and `versionName`
   - Update `applicationId` to `com.abaisprings.app`

3. **Add App Icon:**
   - Place your icon in `android/app/src/main/res/mipmap-*/ic_launcher.png`
   - Or use Android Studio's Image Asset Studio

4. **Generate Signed Bundle:**
   - Build → Generate Signed Bundle / APK
   - Choose "Android App Bundle"
   - Create or use existing keystore
   - Upload to Google Play Console

---

## 🔄 Updating Your App

Whenever you make changes to your web app:

1. **Sync changes:**
   ```bash
   npx cap sync
   ```

2. **Or use the npm scripts:**
   ```bash
   npm run cap:sync
   ```

3. **Rebuild in native IDEs** and test

---

## 📋 Required Assets

### App Icons

**iOS:**
- 1024x1024px PNG (no transparency)
- Place in: `ios/App/App/Assets.xcassets/AppIcon.appiconset/`

**Android:**
- 512x512px PNG (can have transparency)
- Multiple sizes needed (mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi)
- Use Android Studio's Image Asset Studio for easy generation

### Splash Screens (Optional)

Capacitor can generate these automatically, or you can create custom ones.

---

## 🎯 Next Steps

1. ✅ Install dependencies: `npm install`
2. ✅ Add platforms: `npx cap add ios && npx cap add android`
3. ✅ Sync: `npx cap sync`
4. ✅ Open in IDEs and configure
5. ✅ Build and submit to stores

See `APP_STORE_PUBLICATION_GUIDE.md` for detailed store submission instructions.

