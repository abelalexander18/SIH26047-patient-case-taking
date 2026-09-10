import React, { useEffect, useRef } from 'react';
import ChatMessage from './ChatMessage';
import TypingIndicator from './TypingIndicator';

const ChatWindow = ({ messages = [], isTyping = false }) => {
  const bottomRef = useRef(null);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  return (
    <div className="flex-1 w-full overflow-y-auto px-4 sm:px-6 py-6 scroll-smooth">
      <div className="max-w-4xl mx-auto flex flex-col justify-start min-h-full">
        {/* Top Session Start Indicator */}
        <div className="flex items-center justify-center my-4">
          <div className="px-3.5 py-1.5 rounded-full bg-slate-100/90 border border-slate-200/80 text-slate-500 text-xs font-medium flex items-center gap-2 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Clinical Intake Session Initialized</span>
          </div>
        </div>

        {/* Message Stream */}
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}

        {/* Typing indicator */}
        {isTyping && <TypingIndicator />}

        {/* Anchor to scroll */}
        <div ref={bottomRef} className="h-4" />
      </div>
    </div>
  );
};

export default ChatWindow;
