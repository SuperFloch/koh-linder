# Maquette — design C « Braise · Planche »

Référence visuelle retenue pour l'UI du jeu (octobre 2026). Les deux fichiers `.dc.html` sont les maquettes d'origine
(écran d'épreuve et écran de vie de camp, 390 × 844) ; ouvrez-les dans un navigateur ou lisez-les comme spécification.
Canevas complet (toutes les pistes explorées) : https://claude.ai/artifact/WH41UzA2mjiLwbbTdk8axB

- `PlancheEpreuve.dc.html` — épreuve (le mât des Flambeaux)
- `PlancheCamp.dc.html` — vie de camp (matinée)

## Règles de mise en page
- **Le centre de l'écran en partie est TOUJOURS une carte.** Jamais de barre d'outils ni d'élément d'UI sur les côtés :
  tout est en haut (header + bandeau) ou en bas (choix).
- **Header en planche de bois** (`--wood-light` #4a2c1d, bordure `--wood-dark` #1a100d) : jour + période à gauche,
  **avatar du joueur au centre** (médaillon rond qui déborde sous le header, bordure sable, anneau de la couleur d'équipe),
  **jauge d'énergie** à droite. Toucher l'avatar ouvre la liste des candidats.
- **Sous le header** :
  - épreuve : **minimap en bois et sable** (planche bois, cases sable, cases franchies sable foncé, cases spéciales ambre,
    marqueurs d'équipe rouge / jaune) ;
  - camp : **bandeau sable** avec eau / bois / vivres / feu, cabane en 15 segments, ruban des périodes (période en cours en ambre).
- **Carte** : cadre en bois (8 px) autour d'une carte sable ; **illustration en haut** de la plupart des cartes
  (`img` de la carte, sinon une scène dessinée selon le contexte), titre en Lilita One, texte en Rubik.
  Comptes rendus d'équipe : bloc bordé de la couleur de l'équipe, plus petit pour l'équipe adverse.
- **Choix** : deux boutons sous la carte, toujours visibles (gauche vert jungle, droite bleu mer) ; toucher = swiper.
- **Arrière-plan** : paysage tropical dessiné. Épreuves (et intro) : plage, **ciel toujours bleu clair**.
  Camp : plage avec jungle et cabane derrière, **ciel teinté selon la période** (réveil orangé, matin / midi / après-midi
  bleus, soir orange, nuit bleu nuit assombrie).

## Palette « Braise » (dérivée de la charte, saturation ajustée)
| Token | Hex | Rôle |
|---|---|---|
| `--wood-dark` | #1a100d | contours, texte sur sable |
| `--wood-light` | #4a2c1d | header, cadres de carte, minimap |
| `--wood-mid` | #6b4129 | liserés, cabane |
| `--sand-soft` | #e8d49a | cartes, bandeaux, texte sur bois |
| `--sand-deep` | #c9ae6e | cases franchies, séparateurs |
| `--amber` | #f5b942 | accent unique : énergie, période en cours, cases spéciales |
| `--jungle-soft` | #2f5a26 | choix gauche |
| `--sea-soft` | #1d3f63 | choix droite |
| `--team-red-soft` / `--team-yellow-soft` | #e0553f / #e8c93a | marqueurs d'équipe sur fond sable / bois |

Polices : **Lilita One** (titres, chiffres) et **Rubik** (texte), Google Fonts.
