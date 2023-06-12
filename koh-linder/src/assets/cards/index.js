import introCards from 'src/assets/cards/global/intro.json';
import { Card } from 'src/model/Card';
const fs = require('fs')

class CardManager {
    static getAll() {
        var cardList = [];
        introCards.cards.forEach((c) => {
            cardList.push(Card.deserialize(c));
        });
        return cardList
    }
    static getAllGrouped() {
        return this.groupByTheme(this.getAll())
    }
    static saveAll(cardList) {
        var grouped = this.groupByTheme(cardList);
        this.saveAllGrouped(grouped);
    }
    static saveAllGrouped(grouped) {
        Object.keys(grouped).forEach((g) => {
            fs.writeFileSync('src/assets/cards/global/' + g.toLowerCase() + '.json', JSON.stringify(grouped[g]));
            console.log('Saved : ', 'src/assets/cards/global/' + g.toLowerCase() + '.json')
        });
    }
    static groupByTheme(cards) {
        var ret = {};
        cards.forEach((c) => {
            if (ret[c.theme] == undefined) {
                ret[c.theme] = [];
            }
            ret[c.theme].push(c);
        });
        return ret;
    }
}

export default CardManager