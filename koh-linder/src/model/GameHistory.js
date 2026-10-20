/**
 * Types d'entrées de l'historique. On évite de multiplier les types : toutes les réussites d'épreuve partagent
 * CHALLENGE_SUCCESS et tous les échecs CHALLENGE_FAILURE (le détail est dans la description et dans `data`).
 */
const HistoryType = {
    CHALLENGE_SUCCESS: "CHALLENGE_SUCCESS", // réussite lors d'une épreuve (victoire, bon classement, geste qui impressionne...)
    CHALLENGE_FAILURE: "CHALLENGE_FAILURE", // échec lors d'une épreuve (dernière place, mouvement raté...)
    GOOD_MOMENT: "GOOD_MOMENT",             // bon moment passé entre candidats (l'AFF monte)
    DISPUTE: "DISPUTE",                     // dispute entre candidats (l'AFF baisse)
    TEAM_SELECTION: "TEAM_SELECTION",       // formation des équipes : premiers choisis, derniers choisis
    CAMP_CONTRIBUTION: "CAMP_CONTRIBUTION", // vie de camp : contribution remarquée (bonne récolte, entretien...)
    CAMP_FAULT: "CAMP_FAULT",               // vie de camp : manquement ou piètre résultat reproché
    COUNCIL: "COUNCIL"                      // conseil : votes reçus, élimination, alliance tenue ou trahie
};

/**
 * Une entrée de l'historique : un évènement marquant de la partie.
 * - `type` : un HistoryType
 * - `participants` : ids des candidats impliqués (`Candidate.id`)
 * - `description` : texte lisible (journal de fin de partie)
 * - `day` : jour in-game où l'évènement s'est produit
 * - `data` : détails optionnels exploitables par les achievements (ex: { gauge: "REP", value: 5, challenge: "SWIM" })
 */
class HistoryEntry {
    constructor(type, participants, description, day, data, teams) {
        this.type = type;
        this.participants = participants;
        this.description = description;
        this.day = day;
        this.data = data || {};
        // Couleur d'équipe de chaque participant au moment de l'évènement ("NONE" avant la formation des équipes)
        this.teams = teams || [];
    }
}

/**
 * Mémoire des évènements marquants d'une partie, ce qui s'est passé et qui était impliqué.
 * Sert de base aux achievements et de journal récapitulatif en fin de partie.
 *
 * Règle : toute action qui change l'AFF ou la REP de plus de 1 s'inscrit dans l'historique (voir Game.applyEffect, effet
 * RELATION, et les épreuves). Une action s'inscrit dans l'historique quand on le précise explicitement.
 */
class GameHistory {
    constructor() {
        this.entries = [];
    }
    /**
     * Ajoute une entrée.
     * @param {string} type HistoryType
     * @param {string[]} participants ids des candidats impliqués
     * @param {string} description
     * @param {number} day jour in-game
     * @param {Object} [data] détails optionnels
     * @param {string[]} [teams] couleurs d'équipe des participants à ce moment
     * @returns {HistoryEntry}
     */
    add(type, participants, description, day, data, teams) {
        const entry = new HistoryEntry(type, Array.from(new Set(participants)), description, day, data, teams);
        this.entries.push(entry);
        return entry;
    }
    /** Entrées d'un type donné. */
    byType(type) {
        return this.entries.filter((e) => e.type == type);
    }
    /** Entrées auxquelles un candidat a participé. */
    involving(candidateId) {
        return this.entries.filter((e) => e.participants.includes(candidateId));
    }
    /** Entrées d'un jour donné. */
    onDay(day) {
        return this.entries.filter((e) => e.day == day);
    }
}

export { GameHistory, HistoryEntry, HistoryType }
