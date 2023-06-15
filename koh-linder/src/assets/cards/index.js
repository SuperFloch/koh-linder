import { Card } from 'src/model/Card';
const fs = require('fs')
const cardFolder = 'src/assets/cards/global';

class CardManager {
    static getAll() {
        var cardList = [];
        fs.readdirSync(cardFolder).forEach(file => {
            var content = fs.readFileSync(cardFolder + '/' + file);
            JSON.parse(content).cards.forEach((c) => {
                cardList.push(Card.deserialize(c));
            });
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
            fs.writeFileSync('src/assets/cards/global/' + g.toLowerCase() + '.json', JSON.stringify({ cards: grouped[g] }));
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