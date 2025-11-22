'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

export interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp?: Date;
}

interface MessageBubbleProps {
  message: Message;
  isLast?: boolean;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex w-full mb-4",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[80%] p-4 rounded-2xl text-base shadow-sm",
            isUser
            ? "bg-primary text-white rounded-br-none"
            : "bg-gray-100 text-gray-800 rounded-bl-none"
        )}
      >
        <div className={cn("prose prose-sm max-w-none break-words", isUser ? "prose-invert" : "")}>
          <ReactMarkdown
            components={{
              p: ({...props}) => <p className="mb-2 last:mb-0" {...props} />,
              ul: ({...props}) => <ul className="list-disc pl-4 mb-2" {...props} />,
              ol: ({...props}) => <ol className="list-decimal pl-4 mb-2" {...props} />,
              li: ({...props}) => <li className="mb-1" {...props} />,
              strong: ({...props}) => <strong className="font-bold" {...props} />,
              a: ({...props}) => <a className="underline hover:opacity-80" target="_blank" rel="noopener noreferrer" {...props} />,
              code: ({className, children, ...props}: React.ComponentPropsWithoutRef<'code'>) => {
                const match = /language-(\w+)/.exec(className || '')
                return match ? (
                  <code className={cn("bg-black/10 rounded px-1 py-0.5 font-mono text-sm", className)} {...props}>
                    {children}
                  </code>
                ) : (
                  <code className="bg-black/10 rounded px-1 py-0.5 font-mono text-sm" {...props}>
                    {children}
                  </code>
                )
              },
              pre: ({...props}) => (
                <div className="overflow-x-auto w-full my-2 rounded-lg bg-gray-900 p-3">
                  <pre className="text-gray-100 text-xs font-mono" {...props} />
                </div>
              ),
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>
        {message.timestamp && (
          <div className={cn(
            "text-xs mt-1 opacity-70",
            isUser ? "text-white/70" : "text-gray-500"
          )}>
            {message.timestamp.toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
