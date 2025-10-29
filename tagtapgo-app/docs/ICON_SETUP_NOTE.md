# Icon Setup Note

## Current Status

The app currently uses a transparent SVG icon at `/icons/ttg-icon.svg` for all icons. This works in most modern browsers, but some browsers (especially older versions) prefer PNG icons for notifications.

## What's Working

✅ SVG icon exists: `/icons/ttg-icon.svg`
✅ Manifest configured to use SVG
✅ Notifications use SVG icon
✅ Works in Chrome, Firefox, Edge (latest versions)

## For Production (Optional Enhancement)

To ensure maximum compatibility, you may want to create PNG versions:

### 1. Create PNG Icons

You can convert the SVG to PNG using:
- Online tools: https://cloudconvert.com/svg-to-png
- Command line: `convert public/icons/ttg-icon.svg -resize 192x192 public/icon-192.png`
- Design tools: Figma, Sketch, Adobe XD

Recommended sizes:
- `icon-192.png` (192x192) - For notifications and PWA
- `icon-512.png` (512x512) - For PWA splash screen
- `icon-72.png` (72x72) - For older devices
- `icon-96.png` (96x96) - For older devices
- `icon-128.png` (128x128) - For older devices
- `icon-144.png` (144x144) - For older devices
- `icon-152.png` (152x152) - For older devices
- `icon-384.png` (384x384) - For older devices

### 2. Update Manifest

Add PNG icons to `public/manifest.json` (optional alongside the SVG):

```json
{
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    }
  ]
}
```

### 3. Update Notification Code

Change icon references from `.svg` to `.png` if you add PNGs:

```typescript
// In src/lib/notifications.ts
icon: '/icon-192.png',
badge: '/icon-192.png',

// In public/sw.js
icon: data.icon || '/icon-192.png',
badge: data.badge || '/icon-192.png',
```

## Current Implementation

For now, the SVG icon works fine for development and testing. The previous 404 you might have seen was due to looking for `/icon-192.png` which didn't exist. The app now uses `/icons/ttg-icon.svg` consistently.

## Browser Compatibility

### SVG Icons Support
- ✅ Chrome 90+ (Desktop & Android)
- ✅ Firefox 88+ (Desktop & Android)
- ✅ Edge 90+
- ✅ Safari 14+ (Desktop & iOS)
- ⚠️ Older browsers may not display the icon

### PNG Icons Support
- ✅ All browsers (universal support)
- ✅ Better compatibility with older devices
- ✅ Recommended for production

## Testing

The notification system now works with the SVG icon. To test:

1. Visit http://localhost:3000/dev-tools
2. Enable service worker
3. Request notification permission
4. Send test notification
5. ✅ Notification should appear with the SVG icon

If you see a 404 error for icons, it means the code is still referencing a non-existent file. All references have been updated to use `/icons/ttg-icon.svg`.

## Summary

- ✅ **Current**: Using SVG icon (works in modern browsers)
- 🔄 **Optional**: Create PNG icons for maximum compatibility
- 📝 **Production**: Consider adding PNG icons before launch

The app is fully functional with SVG icons for now. PNG icons are an optional enhancement for broader compatibility.
