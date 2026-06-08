/**
 * First-time onboarding copy, separated from the card render so the wording can change
 * without touching the component. Contract: a short title + a list of 4 short steps per role.
 */
export const ONBOARDING_TITLE_COACH = "Bienvenido — así te movés acá";
export const ONBOARDING_TITLE_ATLETA = "Bienvenido — así te movés acá";

export const COACH_STEPS: readonly string[] = [
  "Este es tu Plantel: cada atleta y su estado de readiness (verde / ámbar / rojo).",
  "Tocá un atleta para ver su detalle: carga, recuperación y progreso del año.",
  "En Macros elegís un macrociclo y se lo asignás a un atleta.",
  "En Invitaciones compartís tu código para que tus atletas se vinculen.",
];

export const ATLETA_STEPS: readonly string[] = [
  "Esto es Hoy: tu check-in de bienestar y tu plan del día.",
  "Tocá «Iniciar entrenamiento» y registrás serie por serie; los discos te muestran cómo cargar la barra.",
  "En Mi progreso seguís tu evolución.",
  "En Cuenta están tus datos y tu coach vinculado.",
];
