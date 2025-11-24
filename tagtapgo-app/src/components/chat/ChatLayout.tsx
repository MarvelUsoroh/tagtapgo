'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';

interface ChatLayoutProps {
  header: ReactNode;
  children: ReactNode; // The message list
  input: ReactNode; // The input area
}

export default function ChatLayout({ header, children, input }: ChatLayoutProps) {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const inputContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Only run on client side and if visualViewport is supported
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const handleViewportResize = () => {
      const viewport = window.visualViewport!;
      const windowHeight = window.innerHeight;
      const viewportHeight = viewport.height;
      
      // Calculate keyboard height (difference between window and visible viewport)
      const calculatedKeyboardHeight = windowHeight - viewportHeight;
      
      // Only update if keyboard is actually open (height > 100px threshold)
      if (calculatedKeyboardHeight > 100) {
        setKeyboardHeight(calculatedKeyboardHeight);
        
        // Scroll input into view after a short delay to ensure layout has updated
        setTimeout(() => {
          inputContainerRef.current?.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'end' 
          });
        }, 100);
      } else {
        setKeyboardHeight(0);
      }
    };

    // Listen to viewport resize events (triggered by keyboard)
    window.visualViewport.addEventListener('resize', handleViewportResize);
    window.visualViewport.addEventListener('scroll', handleViewportResize);

    // Cleanup
    return () => {
      window.visualViewport?.removeEventListener('resize', handleViewportResize);
      window.visualViewport?.removeEventListener('scroll', handleViewportResize);
    };
  }, []);

  return (
    <div className="fixed inset-0 flex flex-col bg-white">
      <div className="flex-none z-10 bg-white/80 backdrop-blur-md border-b border-gray-100 pt-[env(safe-area-inset-top)]">
        {header}
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 scroll-smooth">
        <div className="max-w-2xl mx-auto w-full">
          {children}
        </div>
      </div>

      <div 
        ref={inputContainerRef}
        className="flex-none z-10 bg-white pb-[env(safe-area-inset-bottom)]"
        style={{
          // Dynamically adjust bottom padding when keyboard is open
          paddingBottom: keyboardHeight > 0 
            ? `${keyboardHeight}px` 
            : 'env(safe-area-inset-bottom)'
        }}
      >
        <div className="max-w-2xl mx-auto w-full">
          {input}
        </div>
      </div>
    </div>
  );
}
