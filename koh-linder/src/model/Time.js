/**
 * Cycle jour / nuit. Une journée est découpée en périodes ; chaque candidat a un nombre d'actions limité par période et doit
 * toutes les dépenser avant que la période suivante ne commence.
 */
const Period = {
    WAKE: "WAKE",           // Réveil : 1 action de réveil
    MORNING: "MORNING",     // Matin : 2 actions (tâches)
    NOON: "NOON",           // Midi : 1 action de repas
    AFTERNOON: "AFTERNOON", // Après-midi : 3 actions (tâches)
    EVENING: "EVENING",     // Soir : 1 action de repas
    NIGHT: "NIGHT"          // Nuit : 1 action sociale, puis le sommeil
};

const PERIOD_ORDER = [Period.WAKE, Period.MORNING, Period.NOON, Period.AFTERNOON, Period.EVENING, Period.NIGHT];

const PERIOD_LABELS = {
    WAKE: "Réveil",
    MORNING: "Matin",
    NOON: "Midi",
    AFTERNOON: "Après-midi",
    EVENING: "Soir",
    NIGHT: "Nuit"
};

/** Nombre d'actions par candidat et par période (une journée sans épreuve). */
const PERIOD_ACTIONS = {
    WAKE: 1,
    MORNING: 2,
    NOON: 1,
    AFTERNOON: 3,
    EVENING: 1,
    NIGHT: 1
};

/** Nature des actions d'une période. */
const PeriodKind = {
    WAKE: "WAKE",     // choix de réveil
    TASK: "TASK",     // tâches (récolte, ravitaillement, entretien, social) : consomment de l'énergie
    MEAL: "MEAL",     // repas
    SOCIAL: "SOCIAL"  // action sociale de nuit
};

const PERIOD_KINDS = {
    WAKE: PeriodKind.WAKE,
    MORNING: PeriodKind.TASK,
    NOON: PeriodKind.MEAL,
    AFTERNOON: PeriodKind.TASK,
    EVENING: PeriodKind.MEAL,
    NIGHT: PeriodKind.SOCIAL
};

export { Period, PERIOD_ORDER, PERIOD_LABELS, PERIOD_ACTIONS, PeriodKind, PERIOD_KINDS }
