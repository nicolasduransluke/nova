# Nova Coach + AI: Plan de Seguimiento Inteligente

## Vision

Transformar Nova de una herramienta individual de tracking a una plataforma coach-asistida donde:
- El **coach** define la estrategia y plan semanal
- **Nova AI** ejecuta el seguimiento diario con el paciente
- El **paciente** recibe acompanamiento personalizado constante
- El **coach** escala su capacidad — puede gestionar mas pacientes sin perder calidad

---

## Estado Actual (lo que ya existe)

### Infraestructura Coach
- Roles de usuario (patient, coach, admin)
- Sistema de invitaciones con link compartible
- Dashboard web del coach con 4 tabs por paciente:
  - Overview (perfil, peso, objetivo)
  - Historial de calorias (intake, burn, deficit diario)
  - Peso (grafico historico, tendencia)
  - Chat log (conversaciones paciente ↔ Nova AI)

### Nova AI (agente actual del paciente)
- Chat conversacional para registrar comidas, ejercicio, peso
- Calculo automatico de calorias (vision + NLP)
- Integracion con Whoop para burn real
- Resumen diario (intake, burn, deficit, TDEE)
- Historial de 14 dias con tendencias

---

## Feature: Coaching Plans (Plan de Seguimiento)

### Concepto Central

El coach crea un **plan semanal** para cada paciente. Este plan se inyecta en el contexto de Nova AI, que pasa de ser un asistente generico a un ejecutor del plan del coach. El resultado: el paciente siente que su coach esta presente todos los dias, aunque el coach solo dedique minutos a la semana.

### Flujo Principal

```
Lunes AM:  Coach crea plan semanal para Matias
           → "1800 cal/dia, 3 entrenamientos, no saltarse desayuno"

Lunes PM:  Matias abre Nova
           Nova AI: "Tu coach te preparo un plan para esta semana:
                     1800 cal diarias y 3 entrenamientos. Vamos con todo!"

Miercoles: Matias registra almuerzo de 900 cal
           Nova AI: "Llevas 1200 de 1800 cal hoy. Tu coach sugiere
                     una cena ligera — que tal pollo con ensalada?"

Jueves:    Matias no registra desayuno
           Nova AI: "Buenos dias! Recuerda que tu coach quiere que
                     no te saltes el desayuno. Que comiste hoy?"

Viernes:   Coach revisa dashboard
           → Ve que Matias cumplio 3/4 dias, no entreno aun
           → Le pregunta al AI: "Como va Matias con el plan?"
           → AI: "Matias ha cumplido el objetivo calorico 3 de 4 dias.
                   No ha registrado entrenamientos aun. El miercoles
                   se paso por 200 cal en la cena."

Domingo:   Coach crea nuevo plan ajustado para la proxima semana
```

---

## Arquitectura Tecnica

### 1. Modelo de Datos

```
CoachingPlan
├── id
├── coachId          → FK a User (coach)
├── patientId        → FK a User (paciente)
├── weekStart        → Fecha inicio (lunes)
├── weekEnd          → Fecha fin (domingo)
├── version          → int (auto-increment por paciente)
├── status           → "active" | "completed" | "draft"
├── goals            → JSON (objetivos estructurados)
│   ├── dailyCalories    → number (ej: 1800)
│   ├── weeklyWorkouts   → number (ej: 3)
│   ├── weeklyWeightGoal → number (ej: -0.5 kg)
│   ├── proteinTarget    → number (g/dia, opcional)
│   ├── waterTarget      → number (L/dia, opcional)
│   └── customGoals[]    → [{label, target, unit}]
├── instructions     → Text (instrucciones libres para el AI)
│   "No saltarse desayuno. Evitar carbohidratos en cena.
│    Si come fuera, sugerir opciones bajas en calorias.
│    Motivarlo — tuvo una semana dificil."
├── coachNotes       → Text (notas privadas, no visibles para AI ni paciente)
├── results          → JSON (snapshot de resultados al cerrar el plan)
│   ├── avgDailyCalories → number
│   ├── daysOnTarget     → number
│   ├── totalWorkouts    → number
│   ├── weightChange     → number
│   └── complianceRate   → number (0-100%)
├── createdAt
└── updatedAt
```

### Versionamiento de Planes

Todos los planes se persisten — nunca se borran ni sobreescriben. Al crear un plan nuevo para la siguiente semana, el plan anterior se marca como `completed` y se guarda un snapshot de resultados en `results`.

Esto permite:
- **Comparacion historica**: "La semana pasada con 2000 cal bajaste mas que esta con 1800, que cambio?"
- **Evolucion del coaching**: el coach puede ver como ha ido ajustando la estrategia
- **Contexto para el AI**: Gemini puede comparar semanas y detectar tendencias
- **Accountability**: registro inmutable de lo que se planeo vs lo que paso

```
Semana 1: Plan v1 → 2000 cal → Resultado: -0.8kg, 85% cumplimiento
Semana 2: Plan v2 → 1800 cal → Resultado: -0.3kg, 70% cumplimiento
Semana 3: Plan v3 → 1900 cal → AI detecta: "bajaste mas con 2000 cal
           porque cumpliste mejor. Subir un poco puede ser mas sostenible"
```

### 2. Integracion con Nova AI — JSON Estructurado

**No inyectamos texto plano.** Inyectamos un objeto JSON estructurado en el System Message para que Gemini 2.0 Flash pueda hacer calculos logicos directamente.

```typescript
// En OrchestratorService.processMessage():

const activePlan = await coachingPlanService.getActivePlan(userId);
const previousPlans = await coachingPlanService.getCompletedPlans(userId, 4); // ultimas 4 semanas

if (activePlan) {
  const todayProgress = await coachingPlanService.getTodayProgress(userId, activePlan);
  const weekProgress = await coachingPlanService.getWeekProgress(userId, activePlan);

  const coachingContext = {
    plan: {
      version: activePlan.version,
      weekStart: activePlan.weekStart,
      weekEnd: activePlan.weekEnd,
      goals: activePlan.goals,         // { dailyCalories: 1800, weeklyWorkouts: 3, ... }
      instructions: activePlan.instructions,
    },
    today: {
      date: todayKey,
      consumed: todayProgress.caloriesConsumed,     // 1200
      burned: todayProgress.caloriesBurned,          // 2100
      remaining: activePlan.goals.dailyCalories - todayProgress.caloriesConsumed, // 600
      meals: todayProgress.mealCount,                // 2
      workoutLogged: todayProgress.hasWorkout,       // false
    },
    week: {
      daysTracked: weekProgress.daysTracked,         // 4
      daysOnTarget: weekProgress.daysOnTarget,       // 3
      avgDailyCalories: weekProgress.avgCalories,    // 1750
      workoutsCompleted: weekProgress.workouts,      // 1
      workoutsTarget: activePlan.goals.weeklyWorkouts, // 3
      complianceRate: weekProgress.complianceRate,   // 75
      weightChange: weekProgress.weightChange,       // -0.3
    },
    history: previousPlans.map(p => ({
      version: p.version,
      weekStart: p.weekStart,
      goals: p.goals,
      results: p.results,  // { avgDailyCalories, complianceRate, weightChange, ... }
    })),
  };

  // Inyectar como JSON en el system message
  systemPrompt += `\n\n<coaching_context>\n${JSON.stringify(coachingContext)}\n</coaching_context>`;
  systemPrompt += `\n\nTienes un coaching_context JSON con el plan del coach, progreso de hoy,
progreso semanal e historial de planes anteriores. Usa los datos numericos para hacer
calculos precisos (ej: context.plan.goals.dailyCalories - context.today.consumed = calorias restantes).
Incorpora el plan naturalmente. No menciones "tu coach dice" en cada mensaje.
Si el paciente esta cerca de su limite o desviado, guialo. Compara con semanas anteriores
cuando sea relevante. Eres aliado del paciente Y del coach.`;
}
```

**Por que JSON y no texto plano:**
- Gemini puede calcular: `plan.goals.dailyCalories - today.consumed = 600 cal restantes`
- Comparacion precisa entre semanas: `history[0].results.complianceRate vs week.complianceRate`
- Menos ambiguedad — numeros exactos en lugar de texto interpretable
- Permite logica condicional en las respuestas del AI basada en datos reales

**Comportamientos del AI con plan activo:**

| Situacion | Sin plan | Con plan |
|-----------|----------|----------|
| Paciente registra comida | "Son 650 cal" | "Son 650 cal. Llevas 1200 de 1800, vas bien!" |
| Paciente no registra en horas | (nada) | "Como vas con el almuerzo? Tu coach quiere que no te saltes comidas" |
| Paciente se pasa de calorias | "Hoy llevas X cal" | "Vas un poco arriba del plan (2100 vs 1800). Manana puedes compensar con una cena mas ligera" |
| Paciente registra ejercicio | "+300 cal quemadas" | "+300 cal quemadas. Ese es tu 2do entrenamiento de la semana, te falta 1!" |

### 3. Creacion de Planes: Smart Command Bar

El coach no navega menus ni llena formularios. Escribe naturalmente y Nova parsea en tiempo real.

**Flujo:**

```
Coach escribe: "Paulina: 2000 kcal, 3 cardio, no comer tras 9pm"
                              │
                              ▼
                 ┌──────────────────────┐
                 │  Nova parsea en      │
                 │  tiempo real         │
                 └──────────┬───────────┘
                              │
                              ▼
              ┌─────────────────────────────┐
              │  Plan para Paulina          │
              │                             │
              │  Calorias:  [2,000] kcal    │  ← editable
              │  Cardio:    [3] sesiones    │  ← editable
              │  Regla:     No comer >9pm   │  ← editable
              │                             │
              │  [Activar Plan]             │
              └─────────────────────────────┘
```

**Mecanica:**

1. **El coach escribe** en una barra de comandos dentro del detalle del paciente
2. **Nova parsea** el texto y genera un preview visual del plan (card con sliders/inputs editables)
3. **El coach confirma** con un boton "Activar Plan" — o ajusta valores antes de confirmar

**Casos:**

- Input detallado: *"Paulina: 2000 kcal, 3 cardio, priorizar proteina en desayuno, evitar carbos en la noche"*
  → Nova genera plan completo con goals + instructions

- Input vago: *"Paulina necesita bajar"*
  → Nova pide lo minimo: *"Meta calorica? Sugiero 1,900 basado en su perfil actual"*

- Input con contexto: *"Igual que la semana pasada pero 100 cal menos"*
  → Nova copia plan anterior y ajusta

**Por que este approach:**

- **0 friccion**: escribir = crear. No hay boton de "Nuevo Plan", no hay pantalla separada
- **El coach ya piensa en texto**: "2000 cal, 3 sesiones" es lenguaje natural de un coach
- **Confirmacion visual**: el coach nunca manda algo sin verificar que Nova entendio bien
- **30 segundos** para crear un plan completo

### 4. UX del Paciente: Como ve el Plan

El paciente NO ve formularios, instrucciones del coach, ni el JSON de contexto. Ve dos cosas:

**A) Tarjeta de Objetivos Semanales (UI en la app mobile)**

Una card en la pantalla principal que muestra los objetivos medibles:

```
┌─────────────────────────────────────┐
│  Objetivos de la Semana             │
│                                     │
│  Calorias:    2,000 kcal/dia        │
│  ████████████░░░  1,400 de 2,000    │
│                                     │
│  Entrenamientos: 3 esta semana      │
│  ████░░░░░░░░░░  1 de 3             │
│                                     │
│  Peso meta:   Mantener 78kg         │
│               Actual: 78.2kg        │
└─────────────────────────────────────┘
```

- Se actualiza en tiempo real con los registros del dia
- Barras de progreso visuales
- Solo muestra goals numericos — no instrucciones ni notas del coach

**B) Nova AI en el chat (la capa invisible)**

Nova tiene el plan completo inyectado y lo ejecuta naturalmente:

| Lo que el paciente VE | Lo que NO ve |
|---|---|
| Objetivos semanales (tarjeta) | Instrucciones del coach al AI |
| Progreso diario (barras) | Notas internas del coach |
| Mensajes de Nova guiados por el plan | El JSON del coaching_context |
| "No comas muy tarde hoy" | "coach dijo: no comer despues de las 9pm" |

El resultado: el paciente siente que Nova **lo conoce** y lo guia inteligentemente, sin saber que detras hay instrucciones especificas de su coach.

### 5. Dashboard del Coach: Vista del Plan

Nueva tab o seccion en el detalle del paciente:

```
┌─────────────────────────────────────────────────┐
│  Plan Semana 10-16 Mar                  [Editar]│
│                                                  │
│  Calorias: 1800/dia                              │
│  ████████████░░░░  75% cumplimiento (5/7 dias)   │
│                                                  │
│  Entrenamientos: 3/semana                        │
│  ████████░░░░░░░░  2 de 3 registrados            │
│                                                  │
│  Peso: Meta -0.5kg → Real -0.3kg                │
│  ████████████░░░░  60% del objetivo              │
│                                                  │
│  Instrucciones: "No saltarse desayuno..."        │
│  Notas coach: "Tuvo viaje de trabajo miercoles"  │
│                                                  │
│  [+ Crear Plan Semana Siguiente]                 │
└─────────────────────────────────────────────────┘
```

### 6. Coach ↔ AI Chat

El coach puede preguntarle directamente al AI sobre un paciente:

```
Coach: "Como va Matias esta semana?"

AI: "Matias ha registrado comidas 5 de 6 dias. Promedio de 1750 cal/dia
     (dentro del objetivo de 1800). Se salto el desayuno el martes y
     jueves. Registro 2 entrenamientos de 3. Su peso bajo 0.3kg de
     los 0.5kg objetivo. En general buen cumplimiento, el punto debil
     es el desayuno."

Coach: "Que le sugeririas para mejorar el desayuno?"

AI: "Basado en sus registros, Matias suele no comer hasta las 12pm los
     dias que se salta desayuno. Podria prepararle opciones rapidas:
     yogurt con granola (350cal), smoothie de proteina (280cal), o
     avena overnight (400cal). Tambien podria sugerirle dejar algo
     preparado la noche anterior."
```

Este chat del coach va a un endpoint separado que:
- Tiene acceso a TODOS los datos del paciente (historial, mensajes, plan)
- No aparece en el chat del paciente
- Es una conversacion privada coach ↔ AI sobre el paciente

### 7. API Endpoints Nuevos

```
# Planes de coaching
POST   /api/coach/patients/:patientId/plans        → Crear plan
GET    /api/coach/patients/:patientId/plans         → Listar planes
GET    /api/coach/patients/:patientId/plans/active  → Plan activo
PATCH  /api/coach/patients/:patientId/plans/:id     → Editar plan
DELETE /api/coach/patients/:patientId/plans/:id      → Eliminar plan

# Progreso del plan
GET    /api/coach/patients/:patientId/plans/:id/progress
       → { calorieCompliance, workoutCount, weightChange, dayByDay[] }

# Coach ↔ AI chat
POST   /api/coach/patients/:patientId/ai-chat
       → { message: "Como va Matias?" }
       ← { response: "Matias ha registrado..." }
GET    /api/coach/patients/:patientId/ai-chat/history
       → Historial de conversaciones coach-AI sobre este paciente
```

### 8. Modelo de Datos Completo (Prisma)

```prisma
model CoachingPlan {
  id           String   @id @default(uuid())
  coachId      String   @map("coach_id")
  patientId    String   @map("patient_id")
  version      Int      @default(1)              // Auto-increment por paciente
  weekStart    DateTime @map("week_start")
  weekEnd      DateTime @map("week_end")
  status       String   @default("active")       // active, completed, draft
  goals        Json     // { dailyCalories, weeklyWorkouts, weeklyWeightGoal, proteinTarget?, waterTarget?, customGoals[]? }
  instructions String   @default("")             // Texto libre → inyectado al AI
  coachNotes   String   @default("") @map("coach_notes") // Privado, no va al AI
  results      Json?    // Snapshot al completar: { avgDailyCalories, daysOnTarget, totalWorkouts, weightChange, complianceRate }
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  coach   User @relation("CoachPlans", fields: [coachId], references: [id], onDelete: Cascade)
  patient User @relation("PatientPlans", fields: [patientId], references: [id], onDelete: Cascade)

  @@unique([patientId, version])                 // Un version unico por paciente
  @@index([patientId, status])
  @@index([coachId])
  @@map("coaching_plans")
}

model CoachAIChat {
  id        String   @id @default(uuid())
  coachId   String   @map("coach_id")
  patientId String   @map("patient_id")
  role      String   // "coach" | "assistant"
  content   String
  createdAt DateTime @default(now()) @map("created_at")

  coach   User @relation("CoachAIChats", fields: [coachId], references: [id], onDelete: Cascade)
  patient User @relation("PatientAIChats", fields: [patientId], references: [id], onDelete: Cascade)

  @@index([coachId, patientId, createdAt])
  @@map("coach_ai_chats")
}

model PatientNote {
  id        String   @id @default(uuid())
  patientId String   @map("patient_id")
  coachId   String   @map("coach_id")
  content   String
  createdAt DateTime @default(now()) @map("created_at")

  patient User @relation("PatientNotes", fields: [patientId], references: [id], onDelete: Cascade)
  coach   User @relation("CoachReceivedNotes", fields: [coachId], references: [id], onDelete: Cascade)

  @@index([coachId, createdAt])
  @@map("patient_notes")
}
```

---

## Sistema de Aprendizaje Adaptativo

Nova no hace fine-tuning del modelo. Construye un **perfil dinamico** del paciente que crece con cada semana de datos y se inyecta como contexto estructurado. Tres capas de aprendizaje:

### Capa 1: Perfil Comportamental del Paciente (auto-generado)

Un JSON que se recalcula semanalmente (cron) analizando el historial del paciente. No requiere input del coach — se genera automaticamente de calorie_entries, weight_logs y chat_messages.

```json
{
  "behavioral_profile": {
    "patterns": {
      "breakfastSkipRate": 0.4,
      "weekendOvereatRate": 0.7,
      "avgMealTimes": { "first": "11:30", "last": "21:00" },
      "strongDays": ["lunes", "martes"],
      "weakDays": ["sabado", "domingo"],
      "exerciseFrequency": 1.5,
      "triggerContexts": ["comida social", "fin de semana"],
      "trackingConsistency": 0.75
    },
    "trends": {
      "complianceDirection": "improving",
      "weightDirection": "losing",
      "avgWeeklyLoss": -0.35,
      "bestWeekCompliance": 90,
      "worstWeekCompliance": 55
    },
    "responseProfile": {
      "respondsToData": true,
      "prefersEncouragement": true,
      "logFrequency": "2-3x/dia",
      "avgResponseDelay": "< 1 hora"
    }
  }
}
```

El AI usa esto para personalizar:
- "Ojo que es sabado y sueles pasarte los fines de semana. Que tal si planeas tu cena antes de salir?"
- "Veo que no has registrado nada hoy y son las 11:30 — tu primera comida suele ser a esta hora"

### Capa 2: Coach Learnings (extraido del historial de planes)

Al tener planes versionados con resultados, el sistema extrae automaticamente que funciona y que no para cada paciente:

```json
{
  "coach_learnings": {
    "optimalCalorieRange": {
      "min": 1900,
      "max": 2000,
      "reason": "mejor compliance que 1800 (85% vs 70%)"
    },
    "sustainableWorkouts": 3,
    "effectiveInstructions": [
      "Preparar desayuno la noche anterior → redujo skip rate de 40% a 15%",
      "Permitir una comida libre el sabado → mejor compliance general"
    ],
    "adjustmentHistory": [
      { "week": 2, "change": "bajo de 2000 a 1800", "result": "compliance cayo 15%" },
      { "week": 3, "change": "subio a 1900 + comida libre", "result": "compliance subio 20%" }
    ]
  }
}
```

El AI puede decirle al coach en el Coach <> AI Chat:
- "Historicamente, cuando el target fue 1900-2000, Matias cumplio 85%. Con 1800 bajo a 70%. Consideraria subir un poco?"
- "La instruccion de preparar desayuno la noche anterior redujo el skip rate significativamente"

### Capa 3: Coach Insights (conocimiento explicito del coach)

El coach acumula conocimiento sobre cada paciente que persiste entre planes. Un campo editable de "insights" en el dashboard:

```json
{
  "coach_insights": [
    "Matias viaja por trabajo los miercoles — ese dia es flexible",
    "Responde bien a competencia consigo mismo (records personales)",
    "No le gustan los batidos de proteina, preferir comida real",
    "Tiene tendencia a subestimar porciones de arroz",
    "Su pareja cocina los domingos — aprovechar para meal prep"
  ]
}
```

Estos insights son el "ingrediente secreto" del coach. Persisten entre planes y se inyectan al AI. Resultado: Nova sabe que a Matias no le gustan los batidos y le sugiere huevos revueltos en vez de smoothie de proteina.

### Inyeccion Completa al AI

Todo se combina en un solo objeto de contexto:

```typescript
const coachingContext = {
  plan: { ... },              // Plan actual (goals + instructions)
  today: { ... },             // Progreso de hoy (consumed, remaining, meals)
  week: { ... },              // Progreso semanal (compliance, workouts, weight)
  history: [ ... ],           // Planes anteriores con resultados
  patient_profile: { ... },   // Capa 1: patrones auto-generados
  coach_learnings: { ... },   // Capa 2: que funciona segun historial
  coach_insights: [ ... ],    // Capa 3: conocimiento explicito del coach
};
```

### Ciclo de Aprendizaje

```
Semana 1: Coach crea plan → AI ejecuta con contexto basico
                           ↓
          Paciente interactua → AI observa patrones
                           ↓
          Fin de semana → Se genera behavioral_profile (Capa 1)
                           ↓
Semana 2: Coach revisa resultados + perfil → Ajusta plan
          Coach agrega insights: "no le gustan batidos" (Capa 3)
                           ↓
          AI ejecuta con contexto enriquecido
          "Ya que no te gustan los batidos, que tal huevos
           revueltos? Son 350 cal y 25g de proteina"
                           ↓
          Fin de semana → Se actualizan coach_learnings (Capa 2)
          "Subir a 1900 mejoro compliance de 70% a 85%"
                           ↓
Semana 3: AI es significativamente mas inteligente
          Conoce patrones, preferencias, que funciona
                           ↓
          Coach pregunta al AI: "que plan recomiendas para la semana?"
          AI: "Basado en las ultimas 2 semanas, recomiendo 1900 cal
               con comida libre el sabado. El desayuno preparado la
               noche anterior funciono bien. Matias tiene viaje el
               miercoles, sugiero flexibilidad ese dia."
```

Cada semana que pasa, Nova es mejor con ese paciente especifico. No es un chatbot generico — es un asistente que **conoce** al paciente.

### Modelo de Datos para Aprendizaje

```prisma
model PatientProfile {
  id              String   @id @default(uuid())
  patientId       String   @unique @map("patient_id")
  behavioralData  Json     // Capa 1: auto-generado semanalmente
  coachInsights   Json     @default("[]") @map("coach_insights") // Capa 3: editado por coach
  coachLearnings  Json     @default("{}") @map("coach_learnings") // Capa 2: auto-generado
  lastAnalyzedAt  DateTime? @map("last_analyzed_at")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  patient User @relation("PatientBehavioralProfile", fields: [patientId], references: [id], onDelete: Cascade)

  @@map("patient_profiles_ai")
}
```

---

## Plan de Implementacion

### Fase 1: Planes de Coaching (MVP)
- Modelo de datos (CoachingPlan, PatientProfileAI) + migracion
- CRUD de planes desde el dashboard web
- Inyeccion del coaching_context JSON en el system prompt
- Vista de progreso basico (% cumplimiento calorico)
- Coach insights editables por paciente (Capa 3)

### Fase 2: AI Contextual + Aprendizaje
- Nova AI referencia el plan naturalmente en las conversaciones
- Cron semanal que genera behavioral_profile (Capa 1)
- Cron que compara planes versionados y genera coach_learnings (Capa 2)
- Inyeccion completa: plan + today + week + history + 3 capas

### Fase 3: Coach <> AI Chat
- Endpoint de chat privado coach-AI por paciente
- El AI tiene contexto completo (datos + perfil + learnings + insights)
- AI puede recomendar planes basado en historial
- Historial de conversaciones coach-AI

### Fase 4: Notificaciones Proactivas
- Push notifications via Expo cuando el paciente no registra
- Cron job que evalua progreso vs plan y decide si notificar
- Mensajes contextuales: "Tu coach me pidio vigilar tu proteina hoy"

### Fase 5: Dashboard Avanzado + Feedback
- Graficos de cumplimiento por semana con comparativa historica
- Comparativa entre pacientes
- Alertas automaticas (inactividad, desviacion del plan)
- Boton "Enviar nota al coach" en la app del paciente
- Templates de planes reutilizables
- Tarjeta de Objetivos visible para el paciente en la app

---

## Diferencial Competitivo

1. **Para el coach**: Escala su trabajo. Define estrategia una vez, Nova AI ejecuta diariamente.
2. **Para el paciente**: Acompanamiento 24/7 personalizado por su coach, no generico.
3. **Para Nova**: Retention — el coach mantiene a sus pacientes activos.
4. **Moat**: La combinacion coach + AI es dificil de replicar. MyFitnessPal no tiene coaches. Los coaches tradicionales no tienen AI.

---

## Decisiones Tomadas

### 1. Duracion del plan → Semanal fijo (Lunes a Domingo)
La psicologia humana funciona por semanas. El domingo es el dia de "reset" para el coach y el lunes de "estreno" para el paciente. Menos complejidad tecnica para el MVP.

### 2. Notificaciones proactivas → SI
Un coach que solo habla si le hablas no es un coach, es una enciclopedia. Usaremos los Cron Jobs existentes para que Nova envie Push Notifications:
- "Oye Matias, tu coach me pidio que vigilara tu proteina hoy y veo que no has desayunado. Que planeas comer?"
- Requiere: Expo Push Notifications + cron que evalua progreso vs plan

### 3. Visibilidad del plan → Hibrido
- **Visible**: Tarjeta de Objetivos en la app del paciente (calorias, entrenamientos, meta de peso). Claridad de lo que se espera.
- **Invisible**: Las instrucciones libres del coach son el "ingrediente secreto" que Nova suelta naturalmente en la conversacion. El paciente no las ve como texto, las experimenta como guia personalizada del AI.

### 4. Feedback Loop → Asincrono
Boton de "Enviar nota al coach" en la app del paciente. Evita que el coach se sature con mensajes directos pero mantiene el canal abierto. Las notas llegan al dashboard del coach como notificaciones.

### 5. Pricing → Tier Premium (Nova Pro/Business)
Modelo SaaS:
- El coach paga suscripcion mensual por el Dashboard
- Fee por cada "asiento" de paciente activo
- Escalable — el coach paga mas solo cuando crece
