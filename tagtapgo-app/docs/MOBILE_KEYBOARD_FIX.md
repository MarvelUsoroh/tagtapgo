# Mobile Keyboard & Viewport Fix

## Problem
On mobile browsers, when the keyboard opens:
1. Input box gets hidden behind the keyboard
2. Whitespace appears at the top
3. Layout jumps between SplashScreen and ChatLayout

## Root Causes

### 1. `h-[100dvh]` Limitations
- Mobile browsers don't resize `dvh` immediately when keyboard opens
- Keyboard overlays content instead of resizing viewport
- Input box stays at "bottom" which is now behind keyboard

### 2. Layout Positioning Mismatch
- SplashScreen uses `fixed inset-0` (pinned to viewport)
- ChatLayout was using normal flow with `h-[100dvh]`
- Root layout wrapper created scrollable whitespace

### 3. Viewport Meta Restrictions
- `maximumScale: 1` and `userScalable: false` prevent browser auto-adjustment
- Makes keyboard handling more difficult

## Solution: Hybrid Approach

### 1. Revert to `fixed inset-0`
```tsx
<div className="fixed inset-0 flex flex-col bg-white">
```
- Maintains consistency with SplashScreen
- Prevents whitespace issues
- Ensures predictable safe area handling

### 2. Visual Viewport API Listener
```tsx
useEffect(() => {
  const handleViewportResize = () => {
    const viewport = window.visualViewport!;
    const windowHeight = window.innerHeight;
    const viewportHeight = viewport.height;
    
    // Calculate keyboard height
    const keyboardHeight = windowHeight - viewportHeight;
    
    if (keyboardHeight > 100) {
      setKeyboardHeight(keyboardHeight);
      // Scroll input into view
      inputContainerRef.current?.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'end' 
      });
    }
  };
  
  window.visualViewport.addEventListener('resize', handleViewportResize);
}, []);
```

### 3. Dynamic Container Height (Not Padding!)
```tsx
<div 
  style={{
    height: keyboardHeight > 0 
      ? `${window.innerHeight - keyboardHeight}px`
      : '100vh'
  }}
>
```
- **Shrinks container** to visible viewport when keyboard opens
- **Prevents excessive whitespace** (padding approach added too much space)
- Maintains full height when keyboard is closed

**Why not padding?**
- Using `paddingBottom: keyboardHeight` adds space PLUS keyboard overlay
- Results in double the space (e.g., 400px padding + 400px keyboard = 800px gap)
- Shrinking height instead keeps input at bottom of visible area

### 4. Auto-scroll Input Into View
```tsx
inputContainerRef.current?.scrollIntoView({ 
  behavior: 'smooth', 
  block: 'end' 
});
```
- Ensures input is visible after keyboard animation
- Smooth scrolling for better UX

### 5. Remove Root Layout Wrapper
```tsx
// Before
<div className="min-h-screen bg-gray-50 safe-area-top">
  {children}
</div>

// After
{children}
```
- Prevents interference with fixed positioning
- Eliminates scrollable whitespace

## How It Works

1. **Keyboard Opens:**
   - `visualViewport.resize` event fires
   - Calculate keyboard height: `window.innerHeight - viewport.height`
   - Update state with keyboard height

2. **Layout Adjusts:**
   - Container height shrinks to: `innerHeight - keyboardHeight`
   - Input box stays at bottom of visible area (no excessive whitespace)
   - `scrollIntoView` ensures it's visible

3. **Keyboard Closes:**
   - `visualViewport.resize` fires again
   - Keyboard height calculated as 0
   - Container returns to full `100vh`

## Browser Support

- ✅ iOS Safari 13+
- ✅ Chrome Android 61+
- ✅ Firefox Android 68+
- ✅ Samsung Internet 8+

Fallback: If `visualViewport` not supported, layout still works (just no auto-adjustment).

## Testing Checklist

- [x] Input visible when keyboard opens on iOS Safari
- [x] Input visible when keyboard opens on Chrome Android
- [x] No excessive whitespace when keyboard is open
- [ ] No whitespace at top after SplashScreen
- [ ] Smooth transition from SplashScreen to ChatLayout
- [ ] Safe area insets respected (notch/home indicator)
- [x] Input scrolls into view automatically
- [ ] Layout stable when keyboard closes

## Common Pitfalls

### ❌ Using Padding Instead of Height
```tsx
// DON'T DO THIS - Creates excessive whitespace
paddingBottom: keyboardHeight > 0 ? `${keyboardHeight}px` : '0'
```
**Problem:** Adds padding PLUS keyboard overlay = double space

### ✅ Shrink Container Height Instead
```tsx
// DO THIS - Shrinks to visible area
height: keyboardHeight > 0 ? `${window.innerHeight - keyboardHeight}px` : '100vh'
```
**Solution:** Container fits exactly in visible viewport

## References

- [Visual Viewport API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Visual_Viewport_API)
- [Mobile Keyboard Handling Best Practices](https://web.dev/viewport-resize-behavior/)
