'use client';

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
          Soporte - NOVA
        </h1>

        <p className="text-gray-600 dark:text-gray-300 mb-8">
          Si tienes preguntas, problemas o sugerencias sobre NOVA, estamos aquí para ayudarte.
        </p>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-3">
            Contacto
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            Envíanos un correo a{' '}
            <a
              href="mailto:nicolasdurans@me.com"
              className="text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              nicolasdurans@me.com
            </a>{' '}
            y te responderemos lo antes posible.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-3">
            Preguntas Frecuentes
          </h2>

          <div className="space-y-6">
            <div>
              <h3 className="font-medium text-gray-800 dark:text-gray-100 mb-1">
                ¿Qué es NOVA?
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                NOVA es un coach nutricional inteligente que te ayuda a alcanzar tus objetivos de peso
                mediante el seguimiento de calorías y déficit calórico personalizado.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-gray-800 dark:text-gray-100 mb-1">
                ¿Cómo registro mis comidas?
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Puedes registrar tus comidas a través del chat. Simplemente describe lo que comiste
                o envía una foto, y NOVA estimará las calorías automáticamente usando inteligencia artificial.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-gray-800 dark:text-gray-100 mb-1">
                ¿Cómo se calcula mi TDEE?
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Utilizamos la ecuación de Mifflin-St Jeor, una fórmula científicamente validada
                para estimar el gasto energético diario total (TDEE) basada en tu peso, altura, edad,
                sexo y nivel de actividad.{' '}
                <a
                  href="https://pubmed.ncbi.nlm.nih.gov/15883556/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Ver estudio
                </a>
              </p>
            </div>

            <div>
              <h3 className="font-medium text-gray-800 dark:text-gray-100 mb-1">
                ¿Puedo conectar mi dispositivo Whoop?
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Sí, puedes conectar tu Whoop desde la pantalla de perfil para obtener datos más
                precisos de calorías quemadas, entrenamientos y recuperación.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-gray-800 dark:text-gray-100 mb-1">
                ¿Cómo elimino mi cuenta?
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Puedes eliminar tu cuenta desde la pantalla de perfil en la app. Al final de la página
                encontrarás el botón &quot;Eliminar cuenta&quot;. Esta acción es permanente y eliminará
                todos tus datos.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-gray-800 dark:text-gray-100 mb-1">
                ¿Mis datos están seguros?
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Sí. Tus datos se almacenan de forma segura y no se comparten con terceros sin tu
                consentimiento. Puedes revisar nuestra{' '}
                <a
                  href="/privacy"
                  className="text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Política de Privacidad
                </a>{' '}
                para más detalles.
              </p>
            </div>
          </div>
        </section>

        <section className="border-t border-gray-200 dark:border-gray-700 pt-6 mt-8">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-3">
            Support - English
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            If you have questions, issues, or suggestions about NOVA, we&apos;re here to help.
            Contact us at{' '}
            <a
              href="mailto:nicolasdurans@me.com"
              className="text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              nicolasdurans@me.com
            </a>.
          </p>
          <p className="text-gray-600 dark:text-gray-300">
            NOVA is an AI-powered nutritional coach that helps you reach your weight goals
            through personalized calorie tracking. Your TDEE is calculated using the
            scientifically validated Mifflin-St Jeor equation. You can delete your account
            at any time from the profile screen in the app.
          </p>
        </section>
      </div>
    </main>
  );
}
