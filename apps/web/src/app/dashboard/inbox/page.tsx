'use client';

import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';
import { MessageSquare, Clock, User, AlertCircle } from 'lucide-react';

const statusColors: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-green-100 text-green-700',
  WAITING_HUMAN: 'bg-orange-100 text-orange-700',
  HUMAN_ACTIVE: 'bg-purple-100 text-purple-700',
  RESOLVED: 'bg-gray-100 text-gray-600',
};

const statusLabels: Record<string, string> = {
  OPEN: 'Abierta',
  IN_PROGRESS: 'En progreso',
  WAITING_HUMAN: 'Espera humano',
  HUMAN_ACTIVE: 'Con agente',
  RESOLVED: 'Resuelta',
};

export default function InboxPage() {
  const router = useRouter();
  const { data: conversations, mutate } = useSWR('conversations', () =>
    api.conversations.list() as Promise<
      Array<{
        id: string;
        status: string;
        lastMessageAt: string | null;
        unreadCount: number;
        contact: { name: string | null; whatsappPhone: string };
        agent: { name: string };
      }>
    >,
  );

  // SSE for realtime updates — connects once and refreshes list on new events
  const sseRef = useRef<EventSource | null>(null);
  useEffect(() => {
    const token = document.cookie.match(/access_token=([^;]+)/)?.[1];
    if (!token) return;

    const es = new EventSource(
      `${process.env.NEXT_PUBLIC_API_URL}/conversations/stream`,
    );

    es.onmessage = (e) => {
      const event = JSON.parse(e.data);
      if (event.type === 'new_message' || event.type === 'conversation_updated') {
        mutate(); // re-fetch conversation list
      }
    };

    sseRef.current = es;
    return () => es.close();
  }, [mutate]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-8 py-5 border-b border-gray-200 bg-white">
        <h1 className="text-xl font-bold text-gray-900">Inbox</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {conversations?.filter((c) => ['OPEN', 'IN_PROGRESS', 'WAITING_HUMAN'].includes(c.status)).length ?? 0} conversaciones activas
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {!conversations?.length && (
          <div className="text-center py-16">
            <MessageSquare className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400">Sin conversaciones todavía</p>
          </div>
        )}

        {conversations?.map((conv) => {
          const name = conv.contact.name ?? conv.contact.whatsappPhone;
          const time = conv.lastMessageAt
            ? new Date(conv.lastMessageAt).toLocaleTimeString('es-MX', {
                hour: '2-digit',
                minute: '2-digit',
              })
            : '';

          return (
            <button
              key={conv.id}
              onClick={() => router.push(`/dashboard/inbox/${conv.id}`)}
              className="w-full flex items-center gap-3 px-6 py-4 hover:bg-gray-50 border-b border-gray-100 text-left transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 truncate">{name}</span>
                  <span className="text-xs text-gray-400 flex-shrink-0 ml-2">{time}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded font-medium ${statusColors[conv.status] ?? 'bg-gray-100 text-gray-600'}`}
                  >
                    {statusLabels[conv.status] ?? conv.status}
                  </span>
                  <span className="text-xs text-gray-400 truncate">{conv.agent.name}</span>
                </div>
              </div>
              {conv.unreadCount > 0 && (
                <span className="w-5 h-5 bg-brand-600 text-white text-xs rounded-full flex items-center justify-center flex-shrink-0">
                  {conv.unreadCount}
                </span>
              )}
              {conv.status === 'WAITING_HUMAN' && (
                <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
