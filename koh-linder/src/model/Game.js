import { Card } from "./Card";
// import CardManager from 'src/assets/cards'
import { Candidate } from "./Character";
import { Team, TeamColor } from "./Team";
const GAME_DEFAULT_DURATION = 40;
class Game {
    constructor() {
        this.candidates = [];
        this.dayCount = 0;
        this.currentDay = 0;

        this.currentInterlocutor = "";

        this.cardQueue = [];
        this.currentCardIndex = 0;

        // this.cardPile = CardManager.getAll();
        this.cardQueue = [];

        this.teams = [];

        // Mock
        var redteam = new Team(TeamColor.RED);
        var yellowTeam = new Team(TeamColor.YELLOW);

        this.teams.push(redteam);
        this.teams.push(yellowTeam);

        // this.cardQueue.push(this.cardPile[0]);
        var player = new Candidate("Bobby");
        player.team = TeamColor.RED
        player.isPlayer = true;
        var otherDude = new Candidate("Charly");
        otherDude.team = TeamColor.YELLOW;
        this.candidates.push(player);
        this.candidates.push(otherDude);
    }
    right() {
        this.next("right");
    }
    left() {
        this.next("left");
    }
    next(leftOrRight) {
        var currentCard = this.cardQueue[this.currentCardIndex];
        currentCard.choices[leftOrRight].effects.forEach((e) => { this.applyEffect(e); });
        var nextCard = this.getNextCard(currentCard.choices[leftOrRight].next);
        this.cardQueue.push(nextCard);
        this.currentCardIndex++;
    }
    applyEffect(effect) { }
    getNextCard(nextString) {
        var tokens = nextString.split(":");

        switch (tokens[0]) {
            case "ID":
                return this.cardPile.find(c => c.id == tokens[1])
            case "THEME":
                var usedIds = this.cardQueue.filter(c => c.single_use).map(c => c.id);
                var possibleCards = this.cardPile.filter(c => !usedIds.includes(c.id) && c.theme == tokens[1]);
                return possibleCards[Math.floor(Math.random() * possibleCards.length)];
            case "TEST":
                // TEST:Entity_Name:STAT:VALUE:Success_Event:Fail_Event
                var peopleToTest = this.getEntityByName(tokens[1]);
                return peopleToTest.getStatTestCard(tokens[2], tokens[3], tokens[4].split("§").join(":"), tokens[5].split("§").join(":"));
            /*
            var result = peopleToTest.statTest(tokens[2], tokens[3]);
            return this.getNextCard(result ? tokens[4].split("§").join(":") : tokens[5].split("§").join(":"));
            */
            default:
                return this.cardPile[Math.floor(Math.random() * this.cardPile.length)];
        }
    }
    getEntityByName(name) {
        switch (name) {
            case "{player}":
                return this.candidates.find(c => c.isPlayer);
            case "{interlocutor}":
                return this.candidates.find(c => c.name == this.currentInterlocutor);
            default:
                return this.candidates.find(c => c.name == tokens[i]);
        }
    }
}
export { Game, GAME_DEFAULT_DURATION }