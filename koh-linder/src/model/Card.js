import { TouchSwipe } from "quasar";

/**
 * Le type de carte définit si la carte a des propriétés particulière (Si il y a plus à faire que Gauche ou droite)
 */
const CardType = {
    NARRATION: 'NARRATION',
};
/**
 * Définit le groupe auquel la carte appartient. Le genre d'épreuve etc...
 */
const CardTheme = {
    INTRO: 'INTRO',
    DIALOG: 'DIALOG',
};
class Card {
    constructor() {
        this.single_use = false;
        this.id = "rand" + Math.floor(Math.random() * 5000);
        this.name = "";
        this.type = CardType.NARRATION;
        this.theme = CardTheme.INTRO;
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

    static deserialize(jsonObject) {
        var card = new Card();
        card.single_use = jsonObject.single_use;
        card.id = jsonObject.id;
        card.name = jsonObject.name;
        card.type = jsonObject.type;
        card.theme = jsonObject.theme;
        card.text = jsonObject.text;
        card.choices = jsonObject.choices;
        return card;
    }
}
export { Card, CardType, CardTheme }