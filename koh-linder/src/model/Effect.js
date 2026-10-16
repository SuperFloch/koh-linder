/**
 * - ENERGY : ajoute `value` à l'énergie de `target` (bornée à 0–100).
 * - RELATION : fait varier de `value` la jauge `gauge` (AFF par défaut, ou REP) de l'opinion de `target` envers `about`
 *   (`about` = "{player}" par défaut). Non bornée.Un changement de plus de 1 (en valeur absolue) s'inscrit dans
 *   l'historique (GameHistory) : `historyType` (HistoryType) et `description` (texte du journal, variables acceptées) les
 *   précisent ; `history: false` supprime l'inscription automatique (l'appelant inscrit alors une entrée groupée).
 * - SET_INTERLOCUTOR : définit l'interlocuteur courant. `target` = nom du candidat ou "RANDOM".
 * - ELIMINATION : élimine `target`.
 * - TEAM_RELATION : tous les membres d'une équipe modifient de `value` leur jauge `gauge` envers chacun des autres membres
 *   (liens d'équipe). `target` = "PLAYER_TEAM", "RED", "YELLOW" ou "ALL" (les deux équipes). Une seule entrée d'historique
 *   par équipe (participants = tous les membres) si |value| > 1 ; `description` accepte `{team}` (nom de l'équipe).
 * - PICK_TEAMMATES : tire `value` coéquipiers au hasard dans l'équipe `target` (même valeurs que TEAM_RELATION) et range leurs
 *   noms dans les variables listées dans `vars` (ex. ["bannerA", "bannerB"]) ; `excludePlayer: true` écarte le joueur.
 * Effets d'épreuve, communs à toutes les épreuves : `target` = identifiant de l'épreuve (ex. "SWIM"). Le moteur délègue à la
 * classe de l'épreuve (model/challenges), qui définit ce que chacun signifie concrètement.
 * - CHALLENGE_START : démarre l'épreuve (`params` optionnel : surcharge des paramètres propres à l'épreuve).
 * - CHALLENGE_MOVE : modifie de `value` le score d'avancement du candidat `about`.
 * - CHALLENGE_END : résultats et conséquences (classement, REP...).
 * - CHALLENGE_UPDATE : fait avancer le déroulement automatique de l'épreuve (ex: choix des non-joueurs).
 * - CHALLENGE_CLOSE : retire l'épreuve et son affichage.
 * `target` accepte "{player}", "{interlocutor}", un nom, ou pour RELATION/ENERGY un groupe :
 *   "ALL" (tous les autres candidats encore en jeu) / "TEAM" (coéquipiers de `about`).
 */
const EffectType = {
    ENERGY: 'ENERGY',
    RELATION: 'RELATION',
    SET_INTERLOCUTOR: 'SET_INTERLOCUTOR',
    ELIMINATION: 'ELIMINATION',
    CHALLENGE_START: 'CHALLENGE_START',
    CHALLENGE_MOVE: 'CHALLENGE_MOVE',
    CHALLENGE_END: 'CHALLENGE_END',
    CHALLENGE_CLOSE: 'CHALLENGE_CLOSE',
    CHALLENGE_UPDATE: 'CHALLENGE_UPDATE',
    TEAM_RELATION: 'TEAM_RELATION',
    PICK_TEAMMATES: 'PICK_TEAMMATES',
    NONE: 'NONE'
}
class Effect {
    constructor() {
        this.text = "";
        this.type = EffectType.NONE;
        this.value = 0;
        this.target = "";
        this.gauge = "";
        this.about = "";
    }
}
export { Effect, EffectType }
