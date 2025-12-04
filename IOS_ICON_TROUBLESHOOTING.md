# iOS Home Screen Icon Troubleshooting Guide

## ✅ Requirements for iOS Home Screen Icons

Your `images/logo.png` file **MUST** meet these requirements:

1. **Square dimensions** - Same width and height (e.g., 180x180, 512x512, or 1024x1024)
2. **Minimum size** - At least 180x180 pixels (1024x1024 recommended for best quality)
3. **PNG format** - Must be a PNG file
4. **No transparency issues** - iOS prefers icons with a solid background or proper transparency handling

## 🔍 How to Check Your Logo File

### On Windows:
1. Right-click `images/logo.png`
2. Select "Properties"
3. Go to "Details" tab
4. Check "Dimensions" - both numbers should be the same (e.g., 180 x 180)

### On Mac:
1. Right-click `images/logo.png`
2. Select "Get Info"
3. Check the dimensions

### Using an Image Editor:
- Open the logo in any image editor (Paint, Photoshop, GIMP, etc.)
- Check the canvas size
- If it's not square, resize it to be square (e.g., 1024x1024)

## 🛠️ If Your Logo Isn't Square

You need to create a square version:

1. **Option 1: Add padding** - Add transparent or colored padding around the logo to make it square
2. **Option 2: Resize canvas** - Use an image editor to make the canvas square while keeping the logo centered
3. **Option 3: Create new icon** - Design a square icon version specifically for the home screen

## 📱 Steps to Fix on iPhone

1. **Delete the old app icon** from your home screen (long press → remove)
2. **Clear Safari cache:**
   - Settings → Safari → Clear History and Website Data
   - OR use Private Browsing mode
3. **Restart your iPhone** (optional but sometimes helps)
4. **Visit the site** in Safari (not Chrome)
5. **Add to Home Screen** again:
   - Tap the Share button (square with arrow)
   - Scroll down and tap "Add to Home Screen"
   - Check the preview - does it show the logo?
6. **If still blank**, the logo file itself needs to be fixed

## 🧪 Test the Icon URL

Visit this URL in Safari on your iPhone to test if the icon loads:
```
https://abaisprings.vercel.app/images/logo.png
```

If this doesn't load or shows a broken image, the file path is wrong.

## ✅ Current Configuration

- ✅ `apple-touch-icon` meta tags are configured
- ✅ `manifest.json` includes 180x180 and 1024x1024 icons
- ✅ Absolute paths are used (`/images/logo.png`)
- ⚠️ **You must verify the logo file is square**

## 🎯 Most Common Issue

**The logo file is not square!** iOS will not display non-square icons properly. Make sure your `logo.png` has equal width and height.

