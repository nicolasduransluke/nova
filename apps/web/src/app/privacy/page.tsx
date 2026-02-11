'use client';

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
          Política de Privacidad - NOVA
        </h1>

        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Última actualización: {new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-3">
            1. Información que Recopilamos
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-2">
            NOVA recopila la siguiente información para proporcionar el servicio de coaching de déficit calórico:
          </p>
          <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-1 ml-4">
            <li>Información de perfil: peso, altura, edad, sexo, objetivos de peso</li>
            <li>Registros de comidas y actividades físicas</li>
            <li>Historial de peso</li>
            <li>Datos de dispositivos conectados (Whoop, si está autorizado)</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-3">
            2. Integración con Whoop
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-2">
            Si conectas tu cuenta de Whoop, NOVA accederá a:
          </p>
          <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-1 ml-4">
            <li>Calorías quemadas (activas y en reposo)</li>
            <li>Datos de entrenamientos y actividades</li>
            <li>Puntuación de strain (esfuerzo)</li>
            <li>Datos de recuperación y sueño</li>
          </ul>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Puedes desconectar Whoop en cualquier momento desde la configuración de tu perfil.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-3">
            3. Uso de la Información
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-2">
            Utilizamos tu información para:
          </p>
          <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-1 ml-4">
            <li>Calcular tu TDEE (gasto energético diario)</li>
            <li>Registrar y analizar tu ingesta calórica</li>
            <li>Calcular tu déficit calórico diario</li>
            <li>Proyectar tu progreso hacia tu meta de peso</li>
            <li>Proporcionar recomendaciones personalizadas</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-3">
            4. Almacenamiento y Seguridad
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            Tus datos se almacenan de forma segura y no se comparten con terceros excepto
            para las integraciones que tú autorices explícitamente (como Whoop).
            Utilizamos cifrado para proteger tu información en tránsito y en reposo.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-3">
            5. Tus Derechos
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-2">
            Tienes derecho a:
          </p>
          <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-1 ml-4">
            <li>Acceder a todos tus datos personales</li>
            <li>Solicitar la eliminación de tu cuenta y datos</li>
            <li>Desconectar cualquier integración de terceros</li>
            <li>Exportar tus datos en formato legible</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-3">
            6. Contacto
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            Para preguntas sobre privacidad o para ejercer tus derechos, contacta a:
            <a href="mailto:nicolasdurans@me.com" className="text-indigo-600 dark:text-indigo-400 ml-1 hover:underline">
              nicolasdurans@me.com
            </a>
          </p>
        </section>

        <section className="border-t border-gray-200 dark:border-gray-700 pt-6 mt-8">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-3">
            Privacy Policy - English Summary
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            NOVA collects health and fitness data (weight, meals, activities) to provide
            calorie deficit coaching. If you connect Whoop, we access your calorie burn,
            workouts, and recovery data. Your data is stored securely and not shared with
            third parties without your consent. You can delete your account and data at any time.
          </p>
        </section>
      </div>
    </main>
  );
}
