<template>
  <div class="stretch">
    <MainMenuPage class="page stretch" :class="{ 'hidden': currentPage != 'menu' }" @new-game="nav('char_selection')" @load-game="nav('load_game')" @achievements="nav('achievements')" @quit="onQuit" />
    <CharSelectionPage class="page stretch" :class="{ 'hidden': currentPage != 'char_selection' }" @back="nav('menu')" @start="onStart" />
    <InGamePage class="page stretch" :class="{ 'hidden': currentPage != 'in_game' }" :game="game" />
  </div>
</template>

<script>
import { defineComponent } from 'vue'
import MainMenuPage from 'src/components/mainMenu/MainMenuPage.vue';
import CharSelectionPage from 'src/components/charSelection/CharSelectionPage.vue'
import InGamePage from 'src/components/game/InGamePage.vue';
import { Game } from 'src/model/Game';

export default defineComponent({
  name: "IndexPage",
  components: {
    MainMenuPage,
    CharSelectionPage,
    InGamePage
  },
  data: function () {
    return {
      currentPage: 'in_game',
      game: null
    }
  },
  methods: {
    nav(pageName) {
      this.currentPage = pageName;
    },
    onStart() {
      // this.game = new Game();
      this.nav('in_game');
    },
    onQuit() {

    }
  },
  created: function () {
    this.game = new Game(); // Dev
    window.ipcRenderer.invoke('cards:getAll').then((cards) => {
      this.game.cardPile = cards;
      this.game.cardQueue.push(this.game.cardPile[0]);
    });
  }
})
</script>
<style></style>
