'use client';
import { Terminal } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { LoginForm } from '@/components/login-form';

const neverGiveUpQuotes = [
  {
    quote:
      'Our greatest weakness lies in giving up. The most certain way to succeed is always to try just one more time.',
    author: 'Thomas A. Edison',
  },
  {
    quote: 'It does not matter how slowly you go as long as you do not stop.',
    author: 'Confucius',
  },
  {
    quote:
      'Never give up on a dream just because of the time it will take to accomplish it. The time will pass anyway.',
    author: 'Earl Nightingale',
  },
  {
    quote: 'Success is not final, failure is not fatal: it is the courage to continue that counts.',
    author: 'Winston Churchill',
  },
  {
    quote: 'The only person you are destined to become is the person you decide to be.',
    author: 'Ralph Waldo Emerson',
  },
  {
    quote: 'It’s not whether you get knocked down, it’s whether you get up.',
    author: 'Vince Lombardi',
  },
  {
    quote: 'The future belongs to those who believe in the beauty of their dreams.',
    author: 'Eleanor Roosevelt',
  },
  {
    quote: "Believe you can and you're halfway there.",
    author: 'Theodore Roosevelt',
  },
  {
    quote: 'Perseverance is not a long race; it is many short races one after the other.',
    author: 'Walter Elliot',
  },
  {
    quote: "You just can't beat the person who never gives up.",
    author: 'Babe Ruth',
  },
];

export default function LoginPage() {
  const [quoteIndex, setQuoteIndex] = useState(0);

  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * neverGiveUpQuotes.length);
    setQuoteIndex(randomIndex);
  }, []);

  const currentQuote = neverGiveUpQuotes[quoteIndex];

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col items-center justify-center bg-gradient-to-br from-black via-gray-800 to-gray-700 p-8 text-white lg:flex">
        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10"></div>
        <div className="relative z-10 mx-auto max-w-md space-y-8 text-center">
          <div className="mb-2 mt-2 flex justify-center">
            <div className="h-px w-16 bg-white/30"></div>
          </div>

          <blockquote className="text-2xl font-light leading-relaxed tracking-wide">
            "{currentQuote.quote}"
          </blockquote>

          <p className="text-sm font-light text-white/70">— {currentQuote.author}</p>

          <div className="mb-2 mt-8 flex justify-center">
            <div className="h-px w-16 bg-white/30"></div>
          </div>

          <div className="flex justify-center gap-2 pt-4">
            {neverGiveUpQuotes.map((_, index) => (
              <div
                key={index}
                className={`h-1.5 w-1.5 rounded-full ${
                  index === quoteIndex ? 'bg-white' : 'bg-white/30'
                }`}
              ></div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center">
            <Link href="/" className="text-centergap-2 flex items-center justify-center py-4">
              <Terminal className="h-6 w-6 text-black" />
              <span className="text-xl font-bold tracking-tight text-black">AI Starter Kit</span>
            </Link>{' '}
            <h2 className="mb-8 text-xl text-gray-600">Sign in to continue</h2>
          </div>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
