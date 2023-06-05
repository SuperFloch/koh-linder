const TeamColor = {
    YELLOW: 'YELLOW',
    RED: 'RED',
    BLUE: 'BLUE',
    GREEN: 'GREEN',
    ORANGE: 'ORANGE',
    PURPLE: 'PURPLE',
    NONE: 'NONE'
}
class Team {
    constructor(color) {
        this.color = color;
        this.camp = new Camp();
        this.ressources = {};
    }
}
class Camp {
    constructor() {
        this.equipements = {}
    }
}

export { Team, Camp, TeamColor }