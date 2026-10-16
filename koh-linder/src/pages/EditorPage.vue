<template>
    <q-page class="pageBody">
        <div class="title">Editor</div>
        <q-btn v-if="fsSupported" @click="openFolder" glossy color="secondary">Ouvrir le dossier content</q-btn>
        <q-btn v-else @click="exportCards" glossy color="secondary">Exporter les cartes</q-btn>
        <q-btn @click="refresh" glossy color="primary">Refresh</q-btn>
        <span class="status">{{ status }}</span>
        <div class="row">
            <div class="cardGrid col-9">
                <div v-for="theme, index in Object.keys(allCards)" :key="index">
                    <div class="themeTitle">{{ theme }}</div>
                    <div class="cardRow">
                        <EditorCard  v-for="card, cIndex in allCards[theme]" :key="cIndex" :card="card" class="col cardCol" @click="onCardClick(card)"/>
                        <q-btn color="primary" glossy @click="addCard(theme)">
                            <div class="flex justify-center items-center full-height"><span>Add +</span></div>
                        </q-btn>
                    </div>
                </div>
            </div>
            <div class="col-3">
                <EditorPanel class="panel" :class="{'hidden': !isModalOpen}" ref="editorModal" @change="onChange" :all-cards="allCards" @validate="toggleModal(false)"/>
            </div>
        </div>

    </q-page>
</template>
<script>
import { defineComponent } from 'vue'
import { Card } from "src/model/Card";
import EditorCard from "src/components/editor/EditorCard.vue"
import EditorPanel from "src/components/editor/EditorPanel.vue"
import { loadContent } from "src/content/ContentLoader";
import { isSupported, openContentFolder, readCards, saveCards, downloadCards, groupByTheme } from "src/content/ContentStore";

export default defineComponent({
    components: {
        EditorCard,
        EditorPanel
    },
    data:function(){
        return {
            allCards: {},
            isModalOpen: true,
            fsSupported: isSupported(),
            dirHandle: null,
            saveQueue: Promise.resolve(),
            status: ''
        }
    },
    mounted: function(){
        this.refresh();
    },
    methods:{
        groupByTheme,
        async openFolder(){
            try {
                this.dirHandle = await openContentFolder();
                this.refresh();
            } catch (e) {
                this.status = e.message;
            }
        },
        exportCards(){
            downloadCards(this.allCards);
        },
        onCardClick(card){
            this.$refs.editorModal.load(card);
            this.toggleModal(true);
        },
        toggleModal(showIt){
            this.isModalOpen = showIt;
        },
        onChange(){
            if(!this.dirHandle){
                this.status = this.fsSupported
                    ? "Modifications non enregistrées : ouvrez le dossier content pour sauvegarder."
                    : "Modifications non enregistrées : utilisez Exporter.";
                return;
            }
            // Les sauvegardes sont mises en file pour ne pas s'écraser entre elles
            this.saveQueue = this.saveQueue
                .then(() => saveCards(this.dirHandle, this.allCards))
                .then(() => { this.status = "Enregistré"; })
                .catch((e) => { this.status = "Erreur de sauvegarde : " + e.message; });
        },
        addCard(theme){
            var card = new Card();
            card.theme = theme;
            this.allCards[theme].push(card);
            this.onChange();
        },
        async refresh(){
            try {
                if(this.dirHandle){
                    this.allCards = this.groupByTheme(await readCards(this.dirHandle));
                } else {
                    // Lecture seule depuis le contenu servi par l'application
                    this.allCards = this.groupByTheme((await loadContent()).cards);
                }
            } catch (e) {
                this.status = e.message;
            }
        }
    }
})
</script>
<style scoped>
.pageBody{
    background-image: url('img/editor/bg.jpg');
    background-size: cover;
    padding: 2vh 5vw;
}
.title{
    font-size: 5em;
    text-align: center;
}
.cardGrid{
    border: white solid 3px;
    border-radius: 3vh;
    background-color: rgba(0,0,0,0.3);
    padding: 2vh 2vw;
}
.themeTitle{
    font-size: 2em;
    width: 100%;
    border-bottom: solid 1px white;
    color: white;
    margin-bottom: 1vh;
}
.cardRow{
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    grid-column-gap: 1vw;
    grid-row-gap: 1vh;
}
.panel{
    border: white solid 3px;
    border-radius: 3vh;
    background-color: rgba(0,0,0,0.3);
    padding: 2vh 2vw;
}
</style>
