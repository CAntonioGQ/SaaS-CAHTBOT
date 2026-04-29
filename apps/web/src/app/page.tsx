import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="flex items-center justify-between px-8 py-4 border-b border-gray-100">
        <span className="font-bold text-gray-900">Empleado IA</span>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">
            Iniciar sesión
          </Link>
          <Link
            href="/register"
            className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
          >
            Empezar gratis
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-8 py-24 text-center">
        <h1 className="text-5xl font-bold text-gray-900 leading-tight">
          Tu empleado IA para
          <span className="text-brand-600"> WhatsApp</span>
        </h1>
        <p className="text-xl text-gray-500 mt-6 max-w-2xl mx-auto leading-relaxed">
          Crea un agente inteligente que responde clientes, captura leads,
          agenda citas y escala a humanos — en menos de 5 minutos.
        </p>
        <div className="flex items-center justify-center gap-4 mt-10">
          <Link
            href="/register"
            className="px-6 py-3 bg-brand-600 text-white font-semibold rounded-xl hover:bg-brand-700 transition-colors"
          >
            Crear mi agente gratis
          </Link>
          <Link
            href="/login"
            className="px-6 py-3 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
          >
            Ya tengo cuenta
          </Link>
        </div>

        <div className="mt-20 grid grid-cols-3 gap-8 text-left">
          {[
            {
              title: 'Responde 24/7',
              desc: 'Tu agente IA nunca duerme. Responde mensajes de WhatsApp automáticamente.',
            },
            {
              title: 'Captura leads',
              desc: 'Recoge nombre, email e interés de cada prospecto automáticamente.',
            },
            {
              title: 'Escala a humanos',
              desc: 'Cuando el cliente lo necesita, transfiere la conversación a tu equipo.',
            },
          ].map((f) => (
            <div key={f.title} className="bg-gray-50 rounded-xl p-6">
              <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
