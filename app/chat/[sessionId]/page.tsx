// apps/web/app/chat/[sessionId]/page.tsx
'use client'; 

import React, { use, useEffect, useRef, useState } from 'react';
import { useRealtimeSession } from '@/hooks/use-realtime-session';
import { ProposalCard } from '@/components/proposal-card'; 
import { Send, User, Loader2 } from 'lucide-react'; // Added Loader2
import { Button } from '@/components/ui/button'; 
import { Input } from '@/components/ui/input';  

type Params = Promise<{ sessionId: string }>;

export default function ChatPage(props: { params: Params }) {
  const params = use(props.params);
  const sessionId = params.sessionId;

  // Local Input State
  const [inputValue, setInputValue] = useState("");

  const { 
    messages, 
    handleSend, 
    userId,
    isTyping // New state from hook
  } = useRealtimeSession(sessionId);

  const bottomRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll
  useEffect(() => {
    if (messages?.length > 0 || isTyping) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const text = inputValue;
    setInputValue(""); 
    await handleSend(text); 
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans">
      
      {/* Header */}
      <header className="px-6 py-4 bg-white border-b border-slate-200 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Converge</h1>
          <div className="flex items-center text-xs text-green-600 font-medium">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></span>
            Live Session
          </div>
        </div>
        <div className="bg-slate-100 px-3 py-1 rounded-full text-xs text-slate-500 font-mono">
          ID: {sessionId.slice(0, 8)}...
        </div>
      </header>

      {/* Chat Stream */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full opacity-50">
            <User className="w-12 h-12 text-slate-300 mb-2" />
            <p className="text-slate-400">Invite your friends to start planning.</p>
          </div>
        )}

        {messages.map((m) => {
          const isUser = m.role === 'user';

          return (
            <div 
              key={m.id} 
              className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`
                relative max-w-[90%] md:max-w-[70%] 
                ${isUser 
                  ? 'bg-blue-600 text-white rounded-2xl rounded-tr-sm' 
                  : 'bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-tl-sm shadow-sm'
                } 
                px-5 py-3
              `}>
                {m.content && (
                  <div className="whitespace-pre-wrap leading-relaxed">
                    {m.content}
                  </div>
                )}

                {(() => {
                  const payload = m.tool_payload?.businesses 
                    ? m.tool_payload 
                    : (m as any).toolInvocations?.[0]?.result;

                  if (payload && payload.businesses) {
                    return (
                      <div className="mt-4 -mx-2">
                        <ProposalCard
                          businesses={payload.businesses}
                          reasoning={m.content}
                          sessionId={sessionId}
                          userId={userId}
                        />
                      </div>
                    );
                  }
                  return null;
                })()}
                
                <div className={`text-[10px] mt-1 opacity-70 ${isUser ? 'text-blue-100 text-right' : 'text-slate-400'}`}>
                  {m.role === 'assistant' ? 'Connie (AI)' : 'User'}
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing Indicator */}
        {isTyping && (
           <div className="flex justify-start w-full">
             <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                <span className="text-sm text-slate-400 italic">Connie is searching Yelp...</span>
             </div>
           </div>
        )}
        
        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-slate-200 safe-area-bottom">
        <form onSubmit={onSubmit} className="max-w-4xl mx-auto relative flex items-center gap-2">
          <Input 
            className="flex-1 rounded-full border-slate-300 pl-5 pr-12 py-6 text-base focus-visible:ring-blue-500 shadow-sm"
            placeholder="Type a message (e.g. 'Find sushi near downtown')..."
            value={inputValue} 
            onChange={(e) => setInputValue(e.target.value)} 
            autoFocus
          />
          <Button 
            type="submit" 
            size="icon" 
            className="absolute right-2 bg-blue-600 hover:bg-blue-700 rounded-full w-10 h-10 shadow-md"
            disabled={!inputValue.trim() || isTyping}
          >
            <Send className="w-5 h-5 text-white" />
          </Button>
        </form>
      </div>
    </div>
  );
}