import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Empleado IA — Agentes de WhatsApp para tu negocio',
  description: 'Crea tu empleado IA para WhatsApp en menos de 5 minutos',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
