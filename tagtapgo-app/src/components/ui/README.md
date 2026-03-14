# UI Component Library

This directory contains all reusable UI primitive components for the TagTapGo PWA, built according to the PWA UI Refactor specification.

## Design System

All components follow the design system tokens defined in `src/lib/design-tokens.ts`:

- **Spacing**: 4px, 8px, 16px, 24px, 32px
- **Brand Color**: #4ADE80 (green-400)
- **Base Color**: #FFFFFF (white)
- **Touch Targets**: Minimum 44x44px for all interactive elements

## Components

### Button
Reusable button with 4 variants and 3 sizes.

```tsx
import { Button } from '@/components/ui';

<Button variant="primary" size="md" onClick={handleClick}>
  Click me
</Button>
```

**Variants**: `primary`, `secondary`, `ghost`, `danger`  
**Sizes**: `sm` (32px), `md` (44px), `lg` (52px)  
**Props**: `loading`, `icon`, `fullWidth`, `disabled`

### Card
Container component with elevation and padding options.

```tsx
import { Card } from '@/components/ui';

<Card elevation="sm" padding="md" interactive onClick={handleClick}>
  Content here
</Card>
```

**Elevation**: `none`, `sm`, `md`  
**Padding**: `none`, `sm`, `md`, `lg`

### Input
Form input with label, error, and icon support.

```tsx
import { Input } from '@/components/ui';

<Input
  type="email"
  label="Email"
  placeholder="Enter your email"
  error={errors.email}
  value={email}
  onChange={(e) => setEmail(e.target.value)}
/>
```

**Types**: `text`, `email`, `password`, `tel`, `number`, `search`

### Badge
Notification badge for displaying counts.

```tsx
import { Badge } from '@/components/ui';

<Badge count={5} variant="primary" size="md" />
```

**Variants**: `primary`, `danger`, `warning`  
**Sizes**: `sm`, `md`  
**Features**: Auto-hides when count is 0, shows "99+" for counts over 99

### Avatar
User avatar with fallback icon.

```tsx
import { Avatar } from '@/components/ui';

<Avatar
  src="/avatar.jpg"
  alt="User name"
  size="md"
  border
/>
```

**Sizes**: `sm` (32px), `md` (40px), `lg` (56px), `xl` (80px)

### Modal
Accessible modal dialog with focus trap.

```tsx
import { Modal } from '@/components/ui';

<Modal
  isOpen={isOpen}
  onClose={handleClose}
  title="Modal Title"
  size="md"
  footer={<Button onClick={handleClose}>Close</Button>}
>
  Modal content here
</Modal>
```

**Sizes**: `sm`, `md`, `lg`  
**Features**: Focus trap, escape key support, overlay dismiss

### Toast
Temporary notification with auto-dismiss.

```tsx
import { Toast } from '@/components/ui';

<Toast
  message="Success!"
  type="success"
  duration={3000}
  onDismiss={handleDismiss}
/>
```

**Types**: `success`, `error`, `warning`, `info`

### LoadingSpinner
Animated loading indicator.

```tsx
import { LoadingSpinner } from '@/components/ui';

<LoadingSpinner size="md" />
```

**Sizes**: `sm`, `md`, `lg`

### Skeleton
Loading placeholder with shimmer animation.

```tsx
import { Skeleton } from '@/components/ui';

<Skeleton variant="rectangular" width={200} height={100} />
```

**Variants**: `text`, `circular`, `rectangular`

### EmptyState
Display when no data is available.

```tsx
import { EmptyState } from '@/components/ui';

<EmptyState
  icon={<Icon />}
  title="No items found"
  description="Try adjusting your filters"
  action={<Button>Add Item</Button>}
/>
```

### ErrorState
Display when an error occurs.

```tsx
import { ErrorState } from '@/components/ui';

<ErrorState
  title="Something went wrong"
  description="Please try again"
  onRetry={handleRetry}
/>
```

## Usage Guidelines

1. **Always use design system tokens** - Use Tailwind classes that map to design tokens
2. **Maintain 44x44px touch targets** - All interactive elements must meet this minimum
3. **Use brand color consistently** - #4ADE80 for primary actions and accents
4. **Keep it flat** - No gradients, subtle shadows only
5. **Server Components first** - Use Server Components unless client interactivity is required

## Accessibility

All components follow WCAG AA standards:
- Semantic HTML elements
- ARIA labels where appropriate
- Keyboard navigation support
- Focus indicators
- Color contrast compliance

## Performance

- Components use CSS animations for 60fps performance
- Images optimized with Next.js Image component
- Minimal client-side JavaScript
- Tree-shakeable exports
