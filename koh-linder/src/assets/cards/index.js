import introCards from 'src/assets/cards/global/intro.json';
import { Card } from 'src/model/Card';

var cardList = [];
introCards.cards.forEach((c) => {
    cardList.push(Card.deserialize(c));
});

export default cardList