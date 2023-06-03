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
    constructor(){
        super();
        this.energy = 0;
        this.eliminated = false;
        this.isPlayer = false;
    }
}
export {Character, Candidate, Team}