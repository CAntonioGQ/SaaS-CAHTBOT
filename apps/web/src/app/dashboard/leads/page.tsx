'use client';

import useSWR from 'swr';
import { api } from '@/lib/api-client';
import { Users } from 'lucide-react';

const statusColors: Record<string, string> = {
  NEW: 'bg-blue-50 text-blue-700',
  CONTACTED: 'bg-yellow-50 text-yellow-700',
  QUALIFIED: 'bg-purple-50 text-purple-700',
  CONVERTED: 'bg-green-50 text-green-700',
  LOST: 'bg-gray-100 text-gray-500',
};

const statusLabels: Record<string, string> = {
  NEW: 'Nuevo',
  CONTACTED: 'Contactado',
  QUALIFIED: 'Calificado',
  CONVERTED: 'Convertido',
  LOST: 'Perdido',
};

export default function LeadsPage() {
  const { data: leads, isLoading } = useSWR('leads', () =>
    api.leads.list() as Promise<
      Array<{
        id: string;
        name: string;
        email: string | null;
        interest: string | null;
        status: string;
        score: number;
        createdAt: string;
        contact: { whatsappPhone: string };
      }>
    >,
  );

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
        <p className="text-gray-500 text-sm mt-1">
          Prospectos capturados por tus agentes IA
        </p>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && !leads?.length && (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-200">
          <Users className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">Sin leads todavía</p>
          <p className="text-sm text-gray-300 mt-1">
            Activa la captura de leads en tu agente IA
          </p>
        </div>
      )}

      {leads && leads.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Nombre</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Interés</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">WhatsApp</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Estado</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-medium text-gray-900">{lead.name}</td>
                  <td className="px-5 py-3 text-gray-500 max-w-xs truncate">
                    {lead.interest ?? '—'}
                  </td>
                  <td className="px-5 py-3 text-gray-500">{lead.contact.whatsappPhone}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[lead.status]}`}
                    >
                      {statusLabels[lead.status] ?? lead.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-400">
                    {new Date(lead.createdAt).toLocaleDateString('es-MX')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
