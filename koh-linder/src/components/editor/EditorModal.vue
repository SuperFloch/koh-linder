<template>
    <div v-if="cardModel != {}">
        <input v-model="cardModel.id" type="text" @change="onChange"/>
        <input v-model="cardModel.single_use" type="checkbox" @change="onChange"/>
        <input v-model="cardModel.name" type="text" @change="onChange"/>
        <input v-model="cardModel.text" type="text" @change="onChange"/>
        <select v-model="cardModel.theme">
            <option v-for="opt, index in Object.keys(cardTheme)" :key="index">{{ opt }}</option>
        </select>
        <select v-model="cardModel.type">
            <option v-for="opt, index in Object.keys(cardType)" :key="index">{{ opt }}</option>
        </select>
        <div>
            <h6>Choix :</h6>
            <div class="col">
                <EditorChoice v-model="cardModel.choices.left" @change="onChange"/>
            </div>
        </div>
    </div>
</template>
<script>
import { defineComponent } from 'vue'
import {Card, CardTheme, CardType} from "src/model/Card"
import EditorChoice from './EditorChoice.vue'

export default defineComponent({
    emits: ['change'],
    components: {
        EditorChoice
    },
    data: function(){
        return {
            cardModel: {choices: {left:{}, right:{}}},
            cardTheme: CardTheme,
            cardType: CardType
        }
    },
    methods:{
        onChange(){
            console.log(this.cardModel);
            this.$emit('change');
        },
        load(theCard){
            console.log(theCard)
            this.cardModel = theCard;
        }
    },
    mounted: function(){
        // this.cardModel = this.card;
        console.log(CardTheme)
    }
})
</script>
