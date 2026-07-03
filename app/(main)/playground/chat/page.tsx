'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Book, Bot, Loader2, Send, Trash2, User } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { logger } from '@/lib/logger';
import { analytics } from '@/lib/services/analytics';

export default function ChatPage() {
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const { messages, status, sendMessage, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/ai/chat',
    }),
    onFinish: (message) => {
      logger.info('Chat message received:', message);
    },
    onError: (error) => {
      logger.error('Chat error occurred', { error });
    },
  });

  const [input, setInput] = useState('');

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector(
        '[data-radix-scroll-area-viewport]',
      );
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || status !== 'ready') return;

    // Track message send
    analytics.ai.chat.send({
      messageLength: input.length,
      conversationLength: messages.length,
    });

    sendMessage({ text: input });
    setInput('');
  };

  const clearConversation = () => {
    setMessages([]);
    analytics.ai.chat.clear({
      clearedMessageCount: messages.length,
    });
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">AI Chat</h1>
          <p className="text-muted-foreground mt-2">
            Have a conversation with AI using streaming responses
          </p>

          {/* Documentation Links */}
          <div className="flex flex-wrap gap-2 mt-4">
            <Link href="/docs/ai-sdk/chat/overview">
              <Button
                variant="outline"
                size="sm"
                onClick={() => analytics.ui.docsLink({ page: 'chat', section: 'overview' })}
              >
                <Book className="h-4 w-4 mr-2" />
                See Documentation
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chat Interface */}
          <div className="lg:col-span-2">
            <Card className="h-[600px] flex flex-col">
              <CardHeader className="flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Conversation</CardTitle>
                    <CardDescription>
                      Chat with AI in real-time with streaming responses
                    </CardDescription>
                  </div>
                  {messages.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearConversation}
                      disabled={status !== 'ready'}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear
                    </Button>
                  )}
                </div>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col p-0">
                {/* Messages Area */}
                <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
                  <div className="space-y-4">
                    {messages.length === 0 ? (
                      <div className="flex items-center justify-center h-40 text-muted-foreground">
                        <div className="text-center">
                          <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>Start a conversation by sending a message below</p>
                        </div>
                      </div>
                    ) : (
                      messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex gap-3 ${
                            message.role === 'assistant' ? 'justify-start' : 'justify-end'
                          }`}
                        >
                          {message.role === 'assistant' && (
                            <div className="flex-shrink-0">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <Bot className="h-4 w-4 text-primary" />
                              </div>
                            </div>
                          )}

                          <div
                            className={`max-w-[80%] rounded-lg px-4 py-2 ${
                              message.role === 'assistant'
                                ? 'bg-muted text-foreground'
                                : 'bg-primary text-primary-foreground'
                            }`}
                          >
                            <div className="whitespace-pre-wrap text-sm">
                              {message.parts.map((part, index) => {
                                switch (part.type) {
                                  case 'text':
                                    return <span key={index}>{part.text}</span>;
                                  default:
                                    return null;
                                }
                              })}
                            </div>
                          </div>

                          {message.role === 'user' && (
                            <div className="flex-shrink-0">
                              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                                <User className="h-4 w-4 text-primary-foreground" />
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}

                    {status !== 'ready' && (
                      <div className="flex gap-3 justify-start">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <Bot className="h-4 w-4 text-primary" />
                          </div>
                        </div>
                        <div className="bg-muted rounded-lg px-4 py-2">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            AI is typing...
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                {/* Input Area */}
                <div className="border-t p-4">
                  <form onSubmit={handleFormSubmit} className="flex gap-2">
                    <Input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Type your message..."
                      disabled={status !== 'ready'}
                      className="flex-1"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleFormSubmit(e);
                        }
                      }}
                    />
                    <Button
                      type="submit"
                      disabled={!input.trim() || status !== 'ready'}
                      size="icon"
                    >
                      {status !== 'ready' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </form>
                  <p className="text-xs text-muted-foreground mt-2">
                    Press Enter to send, Shift+Enter for new line
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chat Info Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">How it works</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-medium text-primary">1</span>
                  </div>
                  <p className="text-muted-foreground">
                    Messages are sent to the AI model in real-time
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-medium text-primary">2</span>
                  </div>
                  <p className="text-muted-foreground">
                    Responses stream back as they're generated
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-medium text-primary">3</span>
                  </div>
                  <p className="text-muted-foreground">
                    Conversation context is maintained automatically
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Messages:</span>
                  <span className="font-medium">{messages.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <span
                    className={`font-medium ${
                      status !== 'ready' ? 'text-orange-500' : 'text-green-500'
                    }`}
                  >
                    {status !== 'ready' ? 'Generating...' : 'Ready'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
