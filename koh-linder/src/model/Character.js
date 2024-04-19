import { Card } from "./Card";
import { TeamColor } from "./Team";

const Attribute = {
    STR: "CON", // Constitution (Force/Endurance)
    INT: "INT", // Intellect
    SWI: "SWI", // Nage
    AGI: "AGI", // Agilité/Précision
    OBS: "OBS", // Observation
    SOC: "SOC", // Social
};

class Character {
    constructor(charEntity) {
        this.name = charEntity.name;
        this.cards = charEntity.cards;
        this.sex = charEntity.sex;
        if (charEntity.attributes) {
            this.attributes = charEntity.attributes;
        } else {
            this.attributes = {
                STR: 0,
                INT: 0,
                SWI: 0,
                AGI: 0,
                OBS: 0,
                SOC: 0,
            }
        }
    }
}
class Candidate extends Character {
    constructor(name) {
        super(name);
        this.energy = 0;
        this.eliminated = false;
        this.isPlayer = false;
        this.team = TeamColor.NONE;
        this.modifiers = [];
    }
    statTest(stat, valueToReach) {
        const d20Result = Math.floor(Math.random() * 20);
        return this.attributes[stat] + d20Result > valueToReach;
    }
    getStatTestCard(stat, valueToReach, success, fail) {
        var isSuccess = this.statTest(stat, valueToReach);
        var theCard = Card.deserialize({
            "id": "Test",
            "single_use": false,
            "name": "TheTest",
            "theme": "TEST",
            "type": "",
            "text": isSuccess ? "Reussite !" : "Echec",
            "choices": {
                "left": {
                    "effects": [],
                    "text": "Continuer",
                    "next": isSuccess ? success : fail
                },
                "right": {
                    "effects": [],
                    "text": "Continuer",
                    "next": isSuccess ? success : fail
                }
            }
        });
        return theCard;
    }
}
export { Character, Candidate, Attribute }