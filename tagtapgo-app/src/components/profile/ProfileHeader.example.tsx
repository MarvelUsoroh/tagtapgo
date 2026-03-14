/**
 * ProfileHeader Component Example Usage
 * This file demonstrates how to use the ProfileHeader component
 */

import { ProfileHeader } from './ProfileHeader';

// Example 1: Basic usage with all props
export function ProfileHeaderExample1() {
  return (
    <ProfileHeader
      avatarUrl="https://example.com/avatar.jpg"
      name="John Doe"
      level={5}
      points={1250}
    />
  );
}

// Example 2: Without avatar (will show fallback)
export function ProfileHeaderExample2() {
  return (
    <ProfileHeader
      name="Jane Smith"
      level={3}
      points={850}
    />
  );
}

// Example 3: With custom className
export function ProfileHeaderExample3() {
  return (
    <ProfileHeader
      avatarUrl="https://example.com/avatar.jpg"
      name="Alex Johnson"
      level={10}
      points={5000}
      className="bg-white p-lg rounded-xl shadow-md"
    />
  );
}

// Example 4: High level user with many points
export function ProfileHeaderExample4() {
  return (
    <ProfileHeader
      name="Sarah Williams"
      level={25}
      points={125000}
    />
  );
}
