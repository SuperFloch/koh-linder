<template>
    <div v-if="cardModel != {}" class="modalBody">
        <div>
            <label for="idInput">ID : </label>
            <input v-model="cardModel.id" type="text" @change="onChange" id="idInput"/>
        </div>

        <div>
            <label for="singleUseInput">Single Use : </label>
            <input v-model="cardModel.single_use" type="checkbox" @change="onChange" id="singleUseInput"/>
        </div>

        <div>
            <label for="nameInput">Name : </label>
            <input v-model="cardModel.name" type="text" @change="onChange" id="nameInput"/>
        </div>

        <div>
            <label for="textInput">Text : </label>
            <input v-model="cardModel.text" type="text" @change="onChange" id="textInput"/>
        </div>

        <div>
            <label for="themeInput">Theme : </label>
            <select v-model="cardModel.theme" @change="onChange">
                <option v-for="opt, index in Object.keys(cardTheme)" :key="index" id="themeInput">{{ opt }}</option>
            </select>
        </div>

        <div>
            <label for="typeInput">Type : </label>
            <select v-model="cardModel.type" id="typeInput" @change="onChange">
                <option v-for="opt, index in Object.keys(cardType)" :key="index">{{ opt }}</option>
            </select>
        </div>

        <div>
            <h6>Choix :</h6>
            <div class="col">
                <EditorChoice v-model="cardModel.choices.left" @change="onChange" :all-cards="allCards" ref="choiceLeft"/>
            </div>
            <div class="col">
                <EditorChoice v-model="cardModel.choices.right" @change="onChange" :all-cards="allCards" ref="choiceRight"/>
            </div>
        </div>
        <button @click="validate">Valider</button>
    </div>
</template>
<script>
import { defineComponent } from 'vue'
import {Card, CardTheme, CardType} from "src/model/Card"
import EditorChoice from './EditorChoice.vue'

export default defineComponent({
    emits: ['change', 'validate'],
    components: {
        EditorChoice
    },
    props:{
        allCards: {
            type: Object
        }
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
            this.$emit('change');
        },
        load(theCard){
            this.cardModel = theCard;
            this.$refs.choiceLeft.load();
            this.$refs.choiceRight.load();
        },
        validate(){
            this.$emit('validate');
        }
    },
    mounted: function(){
        // this.cardModel = this.card;
        // console.log(this.allCards)
    }
})
</script>
<style scoped>
.modalBody{
    background-color: rgb(223, 223, 136);
}
</style>
