import { Card } from "./Card";
const GAME_DEFAULT_DURATION = 40;
class Game{
    constructor(){
        this.candidates = [];
        this.dayCount = 0;
        this.currentDay = 0;

        this.cardQueue = [];
        this.currentCardIndex = 0;

        this.cardQueue.push(new Card("Carte 1"));
        this.cardQueue.push(new Card("Carte 2"));
        this.cardQueue.push(new Card("Carte 3"));
    }
    next(){
        this.currentCardIndex++;
        if(this.currentCardIndex >= this.cardQueue.length){
            this.currentCardIndex = 0;
        }
    }
}
export {Game, GAME_DEFAULT_DURATION}