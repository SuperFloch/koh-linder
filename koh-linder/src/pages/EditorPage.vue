<template>
    <div class="p-relative">
        <h1>Editor</h1>
        <div class="cardGrid">
            <div v-for="theme, index in Object.keys(allCards)" :key="index">
                <div>{{ theme }}</div>
                <div class="cardRow">
                    <EditorCard  v-for="card, cIndex in allCards[theme]" :key="cIndex" :card="card" class="col cardCol" @click="onCardClick(card)"/>
                </div>
            </div>
        </div>
        <EditorModal class="modal absolute-center" :class="{'hidden': !isModalOpen}" ref="editorModal"/>
    </div>
</template>
<script>
import { defineComponent } from 'vue'
import { Card } from "src/model/Card";
import EditorCard from "src/components/editor/EditorCard.vue"
import EditorModal from "src/components/editor/EditorModal.vue"
import gameCards from 'src/assets/cards'
import EditorCardVue from 'src/components/editor/EditorCard.vue';

export default defineComponent({
    components: {
        EditorCard,
        EditorModal
    },
    data:function(){
        return {
            allCards: [],
            isModalOpen: true
        }
    },
    mounted: function(){
        this.allCards = this.groupByTheme(gameCards);
    },
    methods:{
        groupByTheme(cards){
            var ret = {};
            cards.forEach((c)=>{
                if(ret[c.theme] == undefined){
                    ret[c.theme] = [];
                }
                ret[c.theme].push(c);
            });
            return ret;
        },
        onCardClick(card){
            this.$refs.editorModal.load(card);
            //this.toggleModal();
        },
        toggleModal(){
            this.isModalOpen = ! this.isModalOpen;
        }
    }
})
</script>
<style scoped>
.cardRow{
    display: grid;
    grid-template-columns: repeat(8, 1fr);
}
.modal{
    top: auto;
    bottom: 0;
    background-color: rgb(223, 223, 136);
    width: 20vw;
}
</style>
