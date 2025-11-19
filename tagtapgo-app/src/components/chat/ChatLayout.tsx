'use client';

import { ReactNode } from 'react';

interface ChatLayoutProps {
  header: ReactNode;
  children: ReactNode; // The message list
  input: ReactNode; // The input area
}

export default function ChatLayout({ header, children, input }: ChatLayoutProps) {
  return (
    <div className="flex flex-col h-[100dvh] bg-white">
      <div className="flex-none z-10 bg-white/80 backdrop-blur-md border-b border-gray-100">
        {header}
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 scroll-smooth">
        <div className="max-w-2xl mx-auto w-full">
          {children}
        </div>
      </div>

      <div className="flex-none z-10 bg-white">
        <div className="max-w-2xl mx-auto w-full">
          {input}
        </div>
      </div>
    </div>
  );
}
