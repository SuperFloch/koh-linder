<template>
    <img v-if="url" class="faceImg" :src="url" alt="" draggable="false" @error="onError" />
    <template v-else>{{ name.charAt(0) }}</template>
</template>
<script>
import { defineComponent } from 'vue'
import { contentUrl } from 'src/content/ContentLoader';

// Personnages sans dossier de contenu (profils générés, personnage créé par le joueur) : jamais de portrait à chercher
const NO_PORTRAIT = /^(gen_|custom|debug_)/;
// Portraits introuvables, pour ne pas réessayer (et ne pas multiplier les erreurs 404) à chaque affichage
const MISSING = new Set();

/**
 * Portrait d'un candidat : l'image `content/characters/<id>/portrait.png` si elle existe, sinon l'initiale du prénom. À placer dans le
 * cercle de l'avatar (l'image le remplit).
 */
export default defineComponent({
    props: {
        id: {
            type: String,
            default: ''
        },
        name: {
            type: String,
            default: ''
        }
    },
    data() {
        return { failed: false };
    },
    computed: {
        url() {
            if (!this.id || NO_PORTRAIT.test(this.id) || MISSING.has(this.id) || this.failed) {
                return null;
            }
            return contentUrl('characters/' + this.id + '/portrait.png');
        }
    },
    methods: {
        onError() {
            MISSING.add(this.id);
            this.failed = true;
        }
    }
})
</script>
<style scoped>
.faceImg {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
}
</style>
