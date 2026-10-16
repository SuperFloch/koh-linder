<template>
  <div class="stretch">
    <div v-if="loadError">Erreur de chargement du contenu : {{ loadError }}</div>
    <div v-else-if="!content">Chargement...</div>
    <template v-else>
      <MainMenuPage class="page stretch" :class="{ 'hidden': currentPage != 'menu' }" :koh-points="profile.kohPoints" @new-game="nav('char_selection')" @load-game="nav('load_game')" @adventurers="nav('gallery')" @achievements="nav('achievements')" @challenges="nav('challenge_debug')" @quit="onQuit" />
      <ChallengeDebugPage class="page stretch" :class="{ 'hidden': currentPage != 'challenge_debug' }" :challenges="content.challenges" @back="nav('menu')" @launch="onLaunchChallenge" />
      <CharSelectionPage class="page stretch" :class="{ 'hidden': currentPage != 'char_selection' }" :characters="content.characters" :resources="content.resources" :profile="profile" @back="nav('menu')" @start="onStart" />
      <CharGalleryPage class="page stretch" :class="{ 'hidden': currentPage != 'gallery' }" :characters="content.characters" :profile="profile" @back="nav('menu')" @unlock="onUnlock" />
      <InGamePage v-if="game" class="page stretch" :class="{ 'hidden': currentPage != 'in_game' }" :game="game" @end="onGameEnd" />
    </template>
  </div>
</template>

<script>
import { defineComponent } from 'vue'
import MainMenuPage from 'src/components/mainMenu/MainMenuPage.vue';
import CharSelectionPage from 'src/components/charSelection/CharSelectionPage.vue'
import CharGalleryPage from 'src/components/charGallery/CharGalleryPage.vue'
import ChallengeDebugPage from 'src/components/debug/ChallengeDebugPage.vue'
import { randomCharacter } from 'src/model/CandidateGenerator';
import InGamePage from 'src/components/game/InGamePage.vue';
import { Game } from 'src/model/Game';
import { loadContent } from 'src/content/ContentLoader';
import { loadProfile, unlockCharacter, addKohPoints } from 'src/content/ProfileStore';

export default defineComponent({
  name: "IndexPage",
  components: {
    MainMenuPage,
    CharSelectionPage,
    CharGalleryPage,
    ChallengeDebugPage,
    InGamePage
  },
  data: function () {
    return {
      currentPage: 'menu',
      content: null,
      loadError: '',
      game: null,
      // Koh-points et personnages débloqués, conservés entre les parties
      profile: loadProfile()
    }
  },
  methods: {
    nav(pageName) {
      this.currentPage = pageName;
    },
    onStart(character) {
      this.game = new Game(this.content, character);
      this.nav('in_game');
    },
    onUnlock(character) {
      unlockCharacter(this.profile, character);
    },
    /**
     * Débogage : lance une épreuve seule avec un joueur et des candidats aléatoires (équipes constituées pour les épreuves
     * d'équipe). La partie se termine à la dernière carte de l'épreuve, sans Koh-points.
     */
    onLaunchChallenge(entry) {
      this.game = new Game(this.content, randomCharacter(this.content.resources), {
        debug: true,
        startCard: entry.start,
        standaloneEnd: entry.end,
        randomTeams: entry.context == 'TEAM'
      });
      this.nav('in_game');
    },
    /**
     * Fin de partie : 1 Koh-point par jour de survie, puis retour au menu.
     */
    onGameEnd() {
      const debug = this.game.debug;
      if (!debug) {
        addKohPoints(this.profile, this.game.kohPointsEarned);
      }
      this.game = null;
      this.nav(debug ? 'challenge_debug' : 'menu');
    },
    onQuit() {

    }
  },
  created: function () {
    loadContent().then((content) => {
      this.content = content;
    }).catch((e) => {
      this.loadError = e.message;
    });
  }
})
</script>
<style></style>
