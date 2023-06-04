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
const EffectType = {
    ENERGY: 'ENERGY',
    ELIMINATION: 'ELIMINATION',
    NONE: 'NONE'
}
/**
 * 
 */
class Effect{
    constructor(){
        this.text = "";
        this.type = EffectType.NONE;
        this.value = 0;
        this.target = "";
    }
}
class Card{
    
    constructor(jsonObject){
        this.single_use = jsonObject.single_use;
        this.id = jsonObject.id;
        this.name = jsonObject.name;
        this.type = jsonObject.type;
        this.theme = jsonObject.theme;
        this.text = jsonObject.text;
        this.choices = jsonObject.choices;
    }
}
export {Card, Effect, CardType, CardTheme, EffectType}