import { Card } from "./Card";

const Team = {
    YELLOW: 'YELLOW',
    RED: 'RED',
    BLUE: 'BLUE',
    GREEN: 'GREEN',
    ORANGE: 'ORANGE',
    PURPLE: 'PURPLE',
    NONE: 'NONE'
}
class Character {
    constructor(name){
        this.name = name;
        this.cards = [];
        this.team = Team.NONE;
    }
}
class Candidate extends Character{
    constructor(name){
        super(name);
        this.energy = 0;
        this.eliminated = false;
        this.isPlayer = false;
    }
    statTest(stat, valueToReach){
        return true;
    }
    getStatTestCard(stat, valueToReach, success, fail){
        var isSuccess = this.statTest(stat, valueToReach);
        var theCard = new Card({
            "id": "Test",
            "single_use": false,
            "name":"TheTest",
            "theme":"TEST",
            "type":"",
            "text": isSuccess ? "Reussite !" :"Echec",
            "choices": {
                "left":{
                    "effects":[],
                    "text":"Continuer",
                    "next": isSuccess? success : fail
                },
                "right":{
                    "effects":[],
                    "text":"Continuer",
                    "next": isSuccess? success : fail
                }
            }
        });
        return theCard;
    }
}
export {Character, Candidate, Team}