<template>
    <div class="cardBody" @click="onClick">
        <div>{{ card.id }}</div>
        <div v-if="card.img">
            <img :src="'/img/game/'+card.img"/>
        </div>
        <div class="p-relative">
            <div>{{ card.text }}</div>
            <hr>
            <div class="choice leftChoice">
                <div>{{ card.choices.left.text }}</div>
                <div>
                    {{ nextToString(card.choices.left.next)  }}
                </div>
            </div>
            <div class="choice rightChoice">
                <div>{{ card.choices.right.text }}</div>
                <div>
                    {{ nextToString(card.choices.right.next) }}
                </div>
            </div>
        </div>
    </div>
</template>
<script>

import { defineComponent } from 'vue'

export default defineComponent({
    props: {
        card: {
            type: Object
        }
    },
    emits:['click'],
    computed: {
        computeColor(){
            switch(this.card.type){
                default:
                    return '#636363'
            }
        }
    },
    methods: {
        onClick(){
            this.$emit('click');
        },
        nextToString(n){
            const parts = n.split(':')
            switch(parts[0]){
                case 'ID':
                    return 'Go to -> '+parts[1]
                case 'THEME':
                    return 'Theme -> '+parts[1]
                case 'TEST':
                    return parts[1]+' '+parts[2]+' S->' + this.nextToString(parts[4].split('§').join(':'))+ ' F->'+parts[5]
                default:
                    return n
            }
        }
    },
    mounted(){
        // console.log(this.card)
    }
})
</script>
<style scoped>
.cardBody{
    height: 15vh;
    text-align: center;
    overflow: hidden;
    border-radius: 0.5vh;
    color: white;
    background-color: v-bind(computeColor);
    border: solid 2px white;
}
img{
    max-height: 5vh;
}
.choice{
    position: absolute;
    width: 45%;
}
.leftChoice{
    left: 0;
    background-color: rgb(193, 51, 51);
}
.rightChoice{
    right: 0;
    background-color: rgb(179, 125, 39);
}
</style>
