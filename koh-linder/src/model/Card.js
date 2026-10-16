/**
 * Le type de carte définit si la carte a des propriétés particulière (Si il y a plus à faire que Gauche ou droite)
 * - NARRATION : carte classique, gauche/droite mènent à `choices.<sens>.next`.
 * - DICE : jet de dé. Utilise le champ `dice` ({ entity, stat, threshold, success, fail }), `next` des choix est ignoré.
 * - PORTRAITS : carte spéciale qui fait défiler les portraits et noms des candidats.
 * - CHALLENGE_TURN : un tour d'épreuve, résolu par l'épreuve elle-même (`Challenge.playTurn`, sens de swipe = choix).
 *   Champ `challenge: { id, onFinish }` : id de l'épreuve et `next` à suivre quand le joueur a terminé.
 * Champ optionnel `on_enter: [effects]` : effets appliqués dès que la carte devient la carte courante.
 */
const CardType = {
    NARRATION: 'NARRATION',
    DICE: 'DICE',
    PORTRAITS: 'PORTRAITS',
    CHALLENGE_TURN: 'CHALLENGE_TURN',
};
/**
 * Définit le groupe auquel la carte appartient. Le genre d'épreuve etc...
 * Les thèmes sont libres (définis par les fichiers de cartes), cette liste n'est qu'indicative.
 */
const CardTheme = {
    INTRODUCTION: 'INTRODUCTION',
};
class Card {
    constructor() {
        this.single_use = false;
        this.id = "rand" + Math.floor(Math.random() * 5000);
        this.name = "";
        this.type = CardType.NARRATION;
        this.theme = CardTheme.INTRODUCTION;
        this.img = "";
        this.text = "";
        this.choices = {
            left: {
                text: "OK",
                next: ""
            },
            right: {
                text: "OK",
                next: ""
            }
        };
    }

    /**
     * Copie tous les champs du JSON (y compris `dice`, `effects`...) pour ne rien perdre à la sauvegarde.
     */
    static deserialize(jsonObject) {
        var card = new Card();
        Object.assign(card, jsonObject);
        if (!card.type) {
            card.type = CardType.NARRATION;
        }
        return card;
    }
}
export { Card, CardType, CardTheme }
