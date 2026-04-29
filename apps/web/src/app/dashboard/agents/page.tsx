'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { Bot, Plus, CheckCircle, XCircle, Clock } from 'lucide-react';

const statusConfig = {
  ACTIVE: { label: 'Activo', icon: CheckCircle, color: 'text-green-600 bg-green-50' },
  INACTIVE: { label: 'Inactivo', icon: XCircle, color: 'text-gray-500 bg-gray-50' },
  DRAFT: { label: 'Borrador', icon: Clock, color: 'text-yellow-600 bg-yellow-50' },
};

export default function AgentsPage() {
  const { data: agents, isLoading } = useSWR('agents', () =>
    api.agents.list() as Promise<
      Array<{
        id: string;
        name: string;
        description: string | null;
        status: keyof typeof statusConfig;
        modelName: string;
        leadCaptureEnabled: boolean;
        _count: { conversations: number };
      }>
    >,
  );

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agentes IA</h1>
          <p className="text-gray-500 text-sm mt-1">Tus empleados virtuales de WhatsApp</p>
        </div>
        <Link
          href="/dashboard/agents/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo agente
        </Link>
      </div>

      {isLoading && (
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && agents?.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200 border-dashed">
          <Bot className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="font-medium text-gray-700">Sin agentes todavía</p>
          <p className="text-sm text-gray-400 mt-1 mb-4">
            Crea tu primer empleado IA en minutos
          </p>
          <Link
            href="/dashboard/agents/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Crear agente
          </Link>
        </div>
      )}

      <div className="grid gap-4">
        {agents?.map((agent) => {
          const status = statusConfig[agent.status];
          const Icon = status.icon;
          return (
            <Link
              key={agent.id}
              href={`/dashboard/agents/${agent.id}`}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:border-brand-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-brand-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{agent.name}</h3>
                    {agent.description && (
                      <p className="text-sm text-gray-400 mt-0.5">{agent.description}</p>
                    )}
                  </div>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {status.label}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
                <span>{agent.modelName}</span>
                <span>·</span>
                <span>{agent._count.conversations} conversaciones</span>
                {agent.leadCaptureEnabled && (
                  <>
                    <span>·</span>
                    <span className="text-green-600">Captura leads</span>
                  </>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
