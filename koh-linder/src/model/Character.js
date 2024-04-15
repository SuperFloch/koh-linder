import { Card } from "./Card";
import { TeamColor } from "./Team";

const Attribute = {
    STR: "STR"
};

class Character {
    constructor(charEntity) {
        this.name = charEntity.name;
        this.cards = charEntity.cards;
        this.sex = charEntity.sex;
    }
}
class Candidate extends Character {
    constructor(name) {
        super(name);
        this.energy = 0;
        this.eliminated = false;
        this.isPlayer = false;
        this.team = TeamColor.NONE;
    }
    statTest(stat, valueToReach) {
        return true;
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