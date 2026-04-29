'use client';

import useSWR from 'swr';
import { api } from '@/lib/api-client';

export default function SettingsPage() {
  const { data: org } = useSWR('org', () => api.organizations.current() as Promise<{
    name: string;
    slug: string;
    timezone: string;
    whatsappConfigured: boolean;
    subscription?: { plan: { name: string }; status: string };
  }>);

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Configuración</h1>

      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Tu organización</h2>
          <dl className="space-y-3">
            <div className="flex justify-between text-sm">
              <dt className="text-gray-500">Nombre</dt>
              <dd className="font-medium text-gray-900">{org?.name ?? '—'}</dd>
            </div>
            <div className="flex justify-between text-sm">
              <dt className="text-gray-500">Slug</dt>
              <dd className="text-gray-700">{org?.slug ?? '—'}</dd>
            </div>
            <div className="flex justify-between text-sm">
              <dt className="text-gray-500">WhatsApp</dt>
              <dd>
                {org?.whatsappConfigured ? (
                  <span className="text-green-600 font-medium">Conectado</span>
                ) : (
                  <span className="text-orange-600">No configurado</span>
                )}
              </dd>
            </div>
          </dl>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Plan actual</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">
                {org?.subscription?.plan.name ?? 'Free'}
              </p>
              <p className="text-sm text-gray-400 capitalize">
                {org?.subscription?.status?.toLowerCase() ?? 'trial'}
              </p>
            </div>
            <a
              href="/dashboard/settings/billing"
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700"
            >
              Ver planes
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
