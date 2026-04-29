'use client';

import useSWR from 'swr';
import { api } from '@/lib/api-client';

export default function AnalyticsPage() {
  const { data } = useSWR('analytics/overview', () =>
    api.analytics.overview() as Promise<{
      conversations: { total: number; open: number };
      leads: { total: number; newToday: number };
      usage: {
        messagesUsed: number;
        messagesLimit: number;
        conversationsUsed: number;
        conversationsLimit: number;
      };
      last30Days: {
        messages: number;
        leads: number;
        escalations: number;
        tokens: number;
        cost: number;
      };
      dailyChart: Array<{
        date: string;
        totalMessages: number;
        newLeads: number;
        estimatedCostUsd: number;
      }>;
    }>,
  );

  const usagePct = data
    ? Math.min(100, Math.round((data.usage.messagesUsed / (data.usage.messagesLimit || 1)) * 100))
    : 0;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Analíticas</h1>
        <p className="text-gray-500 text-sm mt-1">Últimos 30 días</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Mensajes totales', value: data?.last30Days.messages ?? 0 },
          { label: 'Leads capturados', value: data?.last30Days.leads ?? 0 },
          { label: 'Escalaciones', value: data?.last30Days.escalations ?? 0 },
          {
            label: 'Costo IA estimado',
            value: `$${(data?.last30Days.cost ?? 0).toFixed(4)} USD`,
          },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500">{stat.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Usage bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Uso del plan</h2>
        <div>
          <div className="flex justify-between text-sm text-gray-500 mb-1.5">
            <span>Mensajes</span>
            <span>
              {data?.usage.messagesUsed ?? 0} / {data?.usage.messagesLimit ?? 0}
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${usagePct > 80 ? 'bg-red-500' : 'bg-brand-500'}`}
              style={{ width: `${usagePct}%` }}
            />
          </div>
          {usagePct > 80 && (
            <p className="text-xs text-red-500 mt-1.5">
              Has usado {usagePct}% de tu cuota. Considera actualizar tu plan.
            </p>
          )}
        </div>
      </div>

      {/* Daily chart placeholder */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Mensajes por día</h2>
        {data?.dailyChart.length ? (
          <div className="flex items-end gap-1 h-32">
            {data.dailyChart.slice(-14).map((day, i) => {
              const max = Math.max(...data.dailyChart.map((d) => d.totalMessages), 1);
              const height = Math.max(4, (day.totalMessages / max) * 100);
              return (
                <div
                  key={i}
                  title={`${new Date(day.date).toLocaleDateString('es-MX')}: ${day.totalMessages} mensajes`}
                  className="flex-1 bg-brand-500 rounded-t opacity-80 hover:opacity-100 transition-opacity cursor-default"
                  style={{ height: `${height}%` }}
                />
              );
            })}
          </div>
        ) : (
          <div className="h-32 flex items-center justify-center text-gray-300 text-sm">
            Sin datos todavía
          </div>
        )}
      </div>
    </div>
  );
}
