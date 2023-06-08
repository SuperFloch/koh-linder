<template>
    <div class="cardBody" @click="onClick">
        <div>{{ card.id }}</div>
        <div>
            <img :src="card.img"/>
        </div>
        <div class="p-relative">
            <div>{{ card.text }}</div>
            <div class="choice leftChoice">{{ card.choices.left.text }}</div>
            <div class="choice rightChoice">{{ card.choices.right.text }}</div>
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
    methods: {
        onClick(){
            this.$emit('click');
        }
    }
})
</script>
<style scoped>
.cardBody{
    background-color: rgb(74, 167, 74);
    height: 10vh
}
.choice{
    position: absolute;
    width: 40%;
}
.leftChoice{
    left: 0;
    background-color: rgb(221, 99, 99);
}
.rightChoice{
    right: 0;
    background-color: rgb(222, 164, 71);
}
</style>
