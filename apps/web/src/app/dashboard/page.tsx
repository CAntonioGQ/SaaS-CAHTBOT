'use client';

import useSWR from 'swr';
import { api } from '@/lib/api-client';
import { MessageSquare, Users, Bot, TrendingUp } from 'lucide-react';

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500">{label}</span>
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const { data, isLoading } = useSWR('analytics/overview', () =>
    api.analytics.overview() as Promise<{
      conversations: { total: number; open: number };
      leads: { total: number; newToday: number };
      usage: { messagesUsed: number; messagesLimit: number };
      last30Days: { messages: number; leads: number; cost: number };
    }>,
  );

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-100 rounded w-48" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-100 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Resumen de los últimos 30 días</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Conversaciones abiertas"
          value={data?.conversations.open ?? 0}
          sub={`${data?.conversations.total ?? 0} totales`}
          icon={MessageSquare}
          color="bg-blue-50 text-blue-600"
        />
        <StatCard
          label="Leads capturados"
          value={data?.leads.total ?? 0}
          sub={`+${data?.leads.newToday ?? 0} hoy`}
          icon={Users}
          color="bg-green-50 text-green-600"
        />
        <StatCard
          label="Mensajes (30 días)"
          value={data?.last30Days.messages ?? 0}
          sub={`${data?.usage.messagesUsed ?? 0} / ${data?.usage.messagesLimit ?? 0} usados`}
          icon={Bot}
          color="bg-purple-50 text-purple-600"
        />
        <StatCard
          label="Costo IA (30 días)"
          value={`$${(data?.last30Days.cost ?? 0).toFixed(2)}`}
          sub="USD estimado"
          icon={TrendingUp}
          color="bg-orange-50 text-orange-600"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-1">Empezar</h2>
        <p className="text-sm text-gray-500 mb-4">
          Configura tu primer agente IA en menos de 5 minutos
        </p>
        <a
          href="/dashboard/agents/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
        >
          <Bot className="w-4 h-4" />
          Crear agente IA
        </a>
      </div>
    </div>
  );
}
