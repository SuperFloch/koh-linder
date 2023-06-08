<template>
    <div v-if="cardModel != {}">
        <input v-model="cardModel.id" type="text" @change="onChange"/>
        <input v-model="cardModel.single_use" type="checkbox" @change="onChange"/>
        <input v-model="cardModel.name" type="text" @change="onChange"/>
        <input v-model="cardModel.text" type="text" @change="onChange"/>
    </div>
</template>
<script>
import { defineComponent } from 'vue'
import {Card, CardTheme, CardType} from "src/model/Card"

export default defineComponent({
    data: function(){
        return {
            cardModel: {}
        }
    },
    methods:{
        onChange(){
            console.log(this.cardModel)
        },
        load(theCard){
            console.log(theCard)
            this.cardModel = theCard;
        }
    },
    mounted: function(){
        // this.cardModel = this.card;
    }
})
</script>
