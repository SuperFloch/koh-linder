import characters from 'src/assets/characters/characters.json';
import { Character } from 'src/model/Character';

var charList = [];
characters.characters.forEach((c)=>{
    charList.push(new Character(c.name));
});

export default charList