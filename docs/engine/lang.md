# Localization

[`Lang.hx`](../../LaBrute/src/com/Lang.hx) provides the display names and descriptions used for engine concepts. It maps enum positions to strings rather than changing the underlying enums or combat behavior. The source defines French (`fr`), Spanish (`es`), English (`en`), and German (`de`) catalogs, then selects French by default during static initialization.

## Catalog groups

Every language catalog supplies these arrays:

| Array | Content and related concepts |
|---|---|
| `CARACS` | The four characteristics: force, agility, speed, and life/endurance. See [gladiator characteristics](gladiator.md#base-stats-and-level-up-characteristics). |
| `SUPERS` | Display names for the ten [`_Super`](data.md#bonus-and-fighter-enums) values. |
| `PERMANENTS` | Names for the 27 [`_Permanent`](data.md#bonus-and-fighter-enums) values. |
| `WEAPONS` | Names for the 28 [`_Weapons`](data.md#other-progression-and-combat-enums) values. |
| `FOLLOWERS` | Names for the five [`_Followers`](data.md#other-progression-and-combat-enums) values. |
| `TALENTS` | Names for the five [`_Talent`](data.md#other-progression-and-combat-enums) values. |
| `MISC` | General interface strings: input prompt, appearance/color controls, error and wait messages, name prompt, life/super/specialty labels, win suffix, and verification text. |
| `DESCRIPTIONS` | User-facing descriptions for permanent bonuses, supers, and talents. The arrays follow the permanent, super, then talent ordering. |
| `DESCADVANCED` | Short mechanical summaries corresponding to those same bonus groups. This catalog is compiled into the `neko` target only. |

`PCOUNT` and `SCOUNT` are derived from the lengths of `_Permanent` and `_Super`. They are enum counts, not catalog-specific translations.

## Translation tables

The tables below list every string in the four source catalogs, in source-array order. The entry labels identify the corresponding enum value where applicable; \n marks an explicit line break in a source string. The advanced descriptions are available only in the neko build.

### Characteristics

| Entry | fr | es | en | de |
|---|---|---|---|---|
| Strength | Force | Fuerza | Strength | Kraft |
| Agility | Agilité | Agilidad | Agility | Flinkheit |
| Speed | Rapidité | Velocidad | Speed | Geschwindigkeit |
| Endurance | Endurance | Resistencia | Endurance | Ausdauer |

### Super names

| Entry | fr | es | en | de |
|---|---|---|---|---|
| THIEF | Voleur | Ladrón | Thief | Dieb |
| BRUTE | Brute féroce | Bruto Feroz | Fierce Brute | Wilde Bestie |
| MEDECINE | Potion tragique | Poción trágica | Tragic Potion | Tragischer Trank |
| NET | Filet | Red | Net | Netz |
| BOMB | Bombe | Bomba | Bomb | Bombe |
| GRAB | Marteau-pilon | Martillo | Hammer | Dampfhammer |
| SHOUT | Cri-qui-poutre | Grito maldito | Cry of the Damned | Höllenschrei |
| HYPNO | Hypnose | Hipnosis | Hypnosis | Hypnose |
| DOWNPOUR | Déluge | Diluvio | Flash Flood | Sintflut |
| TRAPPER | Trappeur | Cazador | Tamer | Dompteur |

### Permanent names

| Entry | fr | es | en | de |
|---|---|---|---|---|
| SUPER_FORCE | Force herculéenne | Fuerza de Hércules | Herculean Strength | Herkulische Kräfte |
| SUPER_AGILITY | Agilité du félin | Agilidad felina | Feline Agility | Katzenflinkheit |
| SUPER_SPEED | Frappe éclair | Golpe del rayo | Lightning Bolt | Blitzschlag |
| SUPER_LIFE | Vitalité | Vitalidad | Vitality | Vitalität |
| IMMORTALITY | Immortel | Inmortal | Immortality | Unsterblichkeit |
| BLADE_MASTER | Maître d'armes | Maestro de Armas | Weapons Master | Waffenmeister |
| BRAWL_MASTER | Arts martiaux | Artes Marciales | Martial Arts | Kampfkunst |
| VIGILANCE | 6ème sens | 6º sentido | 6th Sense | Sechster Sinn |
| PUGNACITY | Pugnace | Belicoso | Hostility | Kämpfernatur |
| TWISTER | Tornade de coups | Tornado de golpes | Fists of Fury | Schlaggewitter |
| SHIELD | Bouclier | Escudo | Shield | Schild |
| ARMOR | Armure | Armadura | Armor | Rüstung |
| LEATHER_SKIN | Peau renforcée | Piel reforzada | Toughened Skin | Elefantenhaut |
| UNTOUCHABLE | Intouchable | Intocable | Untouchable | Unberührbarkeit |
| VANDALISM | Vandalisme | Vandalismo | Sabotage | Sabotage |
| CHOC | Choc | Choque | Shock | Schock |
| BLUNT_MASTER | Gros-bras | Brazo fuerte | Bodybuilder | Mächtiger Arm |
| MERCILESS | Implacable | Implacable | Relentless | Gnadenlos |
| SURVIVAL | Survie | Supervivencia | Survival | Überleben |
| LEAD_BONES | Squelette plomb | Esqueleto de plomo | Lead Skeleton | Bleiskelett |
| BALLERINA | Ballerines | Bailarín | Ballet Shoes | Ballettschuhe |
| STAYER | Persévérant | Perseverante | Determination | Entschlossenheit |
| WARM_BLOODED | Sang-chaud | Sangre caliente | First Strike | Erstschlag |
| INCREVABLE | Increvable | Inagotable | Resistant | Resistenz |
| DIESEL | Méditation | Meditación | Reconnaissance | Kampfsinn |
| COUNTER | Contre | Contra | Counter-Attack | Konterangriff |
| IRON_HEAD | Tête-de-fer | Cabeza de acero | Iron Head | Eisenschädel |

### Weapon names

| Entry | fr | es | en | de |
|---|---|---|---|---|
| HANDS | mains | manos | hands | Hände |
| KNIFE | couteau | cuchillo | knife | Messer |
| SWORD | glaive | espadón | broadsword | Breitschwert |
| LANCE | lance | lanza | lance | Lanze |
| STICK | bâton | bastón | baton | Stock |
| TRIDENT | trident | tridente | trident | Dreizack |
| AXE | hache | hacha | hatchet | Beil |
| SCIMETAR | cimeterre | cimitarra | scimitar | Krummsäbel |
| HAMMER | marteau | martillo | axe | Hammer |
| BIG_SWORD | épée | espada | sword | Schwert |
| FAN | éventail | abanico | fan | Fächer |
| SHURIKEN | shuriken | shuriken | shuriken | Shuriken |
| FANGS | crocs | colmillos | fangs | Stoßzahn |
| WOOD_CLUB | massue | maza | bumps | Keule |
| IRON_CLUB | étoile du matin | mamporro | morning star | Morgenstern |
| BONE_CLUB | os de mammouth | hueso de mamut | mammoth bone | Mammutknochen |
| FLAIL | fléau | mangual | flail | Dreschflegel |
| WHIP | fouet | látigo | whip | Peitsche |
| SAI | sai | sai | sai | Sai |
| POIREAU | poireau | puerro | leek | Porree |
| MUG | mug | taza | mug | Tasse |
| POELE | poêle | sartén | frying pan | Pfanne |
| POUSSIN | piou piou | piopio | piopio | Piou Piou |
| HALBERD | hallebarde | alabarda | halbard | Hallebarde |
| TROMBONNE | trombone | trombón | trombone | Posaune |
| KEYBOARD | clavier | teclado | keyboard | Klavier |
| NOODLES | bol de noodle | bol de ramen | noodle bowl | Nudelschale |
| RACKET | raquette | raqueta | racquet | Schläger |

### Follower names

| Entry | fr | es | en | de |
|---|---|---|---|---|
| DOG_0 | chien A | perro A | dog A | Hund A |
| DOG_1 | chien B | perro B | dog B | Hund B |
| DOG_2 | chien C | perro C | dog C | Hund C |
| PANTHER | panthère | pantera | panther | Panther |
| BEAR | ours | oso | bear | Bär |

### Talent names

| Entry | fr | es | en | de |
|---|---|---|---|---|
| HYPERACTIVE | Régénération | Regeneración | Regeneration | Regeneration |
| COOK | Cuisinier | Jefe | Chef | Chef |
| SPY | Espion | Espía | Spy | Spion |
| SABOTEUR | Saboteur | Saboteador | Saboteur | Saboteur |
| STRIKER | Renforts | Refuerzos | Backup | Backup |

### Interface strings

| Entry | fr | es | en | de |
|---|---|---|---|---|
| Input prompt | TAPE ICI | Teclea aqui | TYPE HERE | HIER EINGEBEN |
| Appearance control | Changer l'apparence | Cambiar la apariencia | Change appearance | Aussehen ändern |
| Color control | Changer les couleurs | Cambiar los colores | Change colours | Farben ändern |
| Error message | Une erreur est survenue, veuillez réessayer. | Ha ocurrido un error. Vuelve a intentarlo, por favor. | An error has occured, please try again. | Es ist ein Fehler aufgetreten, versuche es bitte noch einmal. |
| Name prompt | Choisi un nom pour\ngénérer une Brute | Elige un nombre\npara generar un Bruto | Choose a name to\ngenerate a Brute | Wähle bitte einen Namen\n für deinen Brutalo. |
| Life label | Vie | Vida | Life | Leben |
| Super label | Supers | Super | Super | Super |
| Specialties label | Spécialités | Especialidades | Specialities | Spezialfähigkeiten |
| Win suffix |  gagne le match ! |  gana el combate |  wins the fight! |  hat gewonnen! |
| Verification prompt | Copie ici les 4 caractères\naffichés en dessous | Escribe aqui los caracteres\nque ves aqui. | Type in the characters\nyou see below here | Trage hier die unten\nangezeigten Zeichen ein. |
| Verification error | Les caractères sont incorrects. Essaye à nouveau ! | Los caracteres que has escrito no coinciden. Vuelve a intentarlo. | The characters don't match. Please try again. | Deine Eingabe war nicht korrekt. Versuche es bitte noch einmal! |
| Wait message | Veuillez patienter... | Espera por favor... | Please wait... | Habe bitte etwas Geduld... |

### Descriptions

| Entry | fr | es | en | de |
|---|---|---|---|---|
| Permanent: SUPER_FORCE | Avec ta force, tu es capable de déplacer des montagnes ! Mais pour l'instant, t'as un adversaire à cogner. | ¡Lo sabemos, eres capaz de levantar un tanque de guerra! Pero de momento nada de eso... ¡tienes un adversario que destrozar! | You're strong enough to move mountains, but first you must defeat your opponent. | Du bist so stark, du kannst sogar Berge verschieben! Im Moment hast du aber noch einen Gegner vor dir. |
| Permanent: SUPER_AGILITY | Tu n'as pas de pelote de laine pour t'amuser, mais tu peux toujours embêter la brute en face. | Si estás aburrido, siempre puedes ir a masacrar al Bruto de enfrente. | You don't even have a ball of string to play with, but you can always thump an opponent. | Du hast gerade keinen Wollknäuel zum Spielen, aber vielleicht willst du ja den Brutalo vor dir ärgern. |
| Permanent: SUPER_SPEED | Tu distribues des coups plus vite que ton ombre et plus vite que les dents de ton adversaire. | Eres más rápido que tu propia sombra. ¡Si yo fuera tu adversario, empezaría a rezar! | You strike faster than your shadow and bite harder than your opponents. | Deine Schläge landen schneller bei deinem Gegner als dieser überhaupt blinzeln kann. |
| Permanent: SUPER_LIFE | Ton espérance de vie a augmenté ! Désormais tu tiendras debout plus longtemps dans l'arène. | ¡Tu esperanza de vida ha aumentado! Ahora podrás resistir más tiempo en pie frente a tu adversario. | Your life expectancy has increased! You'll now be able to fight for longer in the arena. | Deine Lebenserwartung ist soeben gestiegen! Du wirst ab sofort länger in der Arena durchhalten. |
| Permanent: IMMORTALITY | Ta santé a atteint un niveau inimaginable ! Il est devenu très difficle de te terrasser lors d'un combat. | Tu salud ha alcanzado un nivel inimaginable. Te has convertido en la peor pesadilla para tus enemigos. | Your health has increased dramatically! Now it'll be much harder for your opponents to knock you out. | Du bist so gesund wie noch nie zuvor! Wer soll DICH jetzt im Kampf noch schlagen?! |
| Permanent: BLADE_MASTER | Grâce à ta maîtrise, tu causes plus de dégâts à ton adversaire avec les armes tranchantes. | Tu dominio de las armas blancas ha hecho de ti un tipo muy, pero muy peligroso. | After having mastered all edged weapons, you're a much bigger threat to your opponents. | Du hast deine Waffenkunst perfektioniert. Ab sofort fügst du deinem Gegner mit deinen Hieb- und Stichwaffen noch mehr Schaden zu. |
| Permanent: BRAWL_MASTER | Les cours de Chuck Norris ont porté leurs fruits ! Maintenant tu mets les pieds où tu veux... et c'est souvent dans la tronche. | ¡Las clases de Chuck Norris han dado sus frutos! Puedes ser feo y tonto... pero nadie se reirá de ti. | The Chuck Norris course you took has really paid off! Now you can walk wherever you want... and more often than not it'll be all over your opponent's ugly face! | Chuck Norris' Nachhilfestunden zahlen sich so langsam aus! Deine Schläge landen dort, wo du sie haben willst - im Gesicht deines Gegners! |
| Permanent: VIGILANCE | Ta vigilance aiguisée te permet d'anticiper les fourberies de ton adversaire et de frapper avant lui ! | ¡Tu vista de águila te permite anticipar las intenciones de tu adversario y golpeas antes que él! | Your eagle-eyed vigilance allows you to anticipate when your opponents are sneaking up on you. Now when you attack they won't know what hit them! | Dank deines geschärften Kampfsinns bist du in der Lage, die miesen Tricks deines Gegners zu erahnen und ihm zuvorzukommen. |
| Permanent: PUGNACITY | Dans l'arène tu n'es vraiment pas ingrat... Quand on te donne un coup, tu le rends aussitôt, et gratuitement ! | Después de todo eres un tipo generoso... ¡Cuando te tocan devuelves el golpe enseguida y hasta sin razón! | You're very polite when you're fighting in the arena. Whenever one of your opponents attacks you, you return the favour......for free! | Du bist in der Arena nicht gerade zimperlich... Sobald du einsteckst, teilst du sofort wieder aus - und das nicht zu knapp! |
| Permanent: TWISTER | ... et tu tapes tapes tapes, c'est ta façon d'aimer, ce rythme qui t'entraîne jusqu'au bout de la nuit, éveille en toi le tourbillon d'un vent de foliiiiiie ! | ... la cucaracha, la cucaracha, ya no puede caminar, porque tu Bruto, porque tu Bruto, tararararará. | ... and you scratch, claw, bite, that's just your little way of showing love! You're a mad torrent of misdirected love! | ... du drischst, drischst, drischst und drischst auf deinen Gegner ein und vergisst alles um dich herum. Hurrikan Katrina ist ein Witz gegen dich! |
| Permanent: SHIELD | Un bouclier. Pour parer les coups... des fois. | Un escudo te protegerá de los golpes... bueno, a veces. | A shield. To stop the blows...well, some of them at least. | Mit einem Schild kannst du Schläge abwehren. Na, wer's braucht... |
| Permanent: ARMOR | Ca, c'est une armure. Un truc qu'on met par dessus son t-shirt pour pas le salir. En même temps, ça permet de mieux résister aux attaques. | Una armadura: mucho mejor que una camiseta limpia. También sirve para frenar los golpes. | What's this? It's a coat of armour. The idea is that you put it on over your t-shirt so that it doesn't get dirty. It also helps to protect you from your opponent's blows. | Das ist eine Rüstung, Kleiner. So'n Ding ziehst du dir übers T-Shirt, damit es nicht schmutzig wird. Außerdem hilft es dir, Angriffe abzuwehren. |
| Permanent: LEATHER_SKIN | A force de se faire taper, on finit par évoluer. Ta brute possède maintenant une peau plus résistante. | La evolución se hace a base de golpes. Tu Bruto posee ahora una piel más resistente. | All the knocks you've taken up until now have actually helped you to develop. Your Brute is now much tougher and has a much thicker skin. | Durch das ganze Prügeln wirst du zwangsläufig irgendwann mal stärker. Dein Brutalo hat sich eine lederne dicke Haut angekämpft! |
| Permanent: UNTOUCHABLE | Tu évites les coups plus facilement. C'est très énervant, surtout pour ton adversaire. | Evitas los golpes fácilmente. Eso puede enojar mucho a tu enemigo. | You can now avoid attacks much more easily. This is really annoying............but only for your opponents! | Es fällt dir immer einfacher, den Schlägen deines Gegners auszuweichen. Das geht dem mächtig auf den Senkel. |
| Permanent: VANDALISM | Certaines brutes font du vandalisme dans la rue, mais toi tu préfères vandaliser ton adversaire. Chaque coup te permet de détruire une de ses armes. | Algunos Brutos hacen vandalismo en la calle, pero tú  lo haces sobre tu adversario. Cada golpe te permite destruir una de sus armas. | Some Brutes choose to vandalise the streets, but you prefer to vandalise your opponents! Each blow will destroy one of your opponent's weapons. | Manche Brutalos lieben es, Straßenzüge zu verwüsten, doch du verwüstet lieber die Waffen deines Gegners. He he! |
| Permanent: CHOC | Tes coups sont tellement surprenants que ton adversaire en laisse tomber son arme... Profites-en pour lui en montrer d'autres ! | Tus golpes son tan espectaculares que tu adversario deja caer su propia arma... ¡Es muy útil para ganar nuevos fans! | Your attack takes your opponent by surprise and he drops his weapon. Now you can show it off to your friends! | Deine Schläge kommen derart überraschend, dass dein Gegner vor lauter Schreck seine Waffe fallen lässt... Nutze diese Gelegenheit! |
| Permanent: BLUNT_MASTER | Grâce à tes gros bras, tu manipules les armes lourdes aussi facilement qu'un micro. Tu es le Philippe Risoli de la massue. | Manipulas las armas pesadas como si nada gracias a tus músculos de acero. Eres el Schwarzenegger de la maza. | Thanks to your huge biceps you can now use heavy weapons. Bravo Mr Muscle! | Deine kräftigen Oberarme schwingen deine Waffen so kinderleicht wie ein Mikro. Du bist der Thomas Gottschalk der Keulenschwinger! |
| Permanent: MERCILESS | Lorsque tu colles des baffes, elles arrivent toujours à destination. Personne ne peut les arrêter. En tout cas pas ton adversaire. | Cuando repartes tortas, siempre llegan a su destino y nadie puede pararlas. ¡Tu enemigo puede empezar a sobarse! | When you attack, you're always on target. Nobody can stop you. Most certainly not your opponent! | Keine Ahnung wie du das machst, aber deine Ohrfeigen finden immer ihr Ziel. Niemand kann sich ihnen entziehen. Dein Gegner schon mal gar nicht. |
| Permanent: SURVIVAL | Les années de lutte t'ont rendu increvable. Les coups mortels te laissent 1 point de vie au lieu de t'abattre. | Los años de lucha te han vuelto casi invencible. Los golpes mortales te dejan con 1 punto de vida en lugar de dejarte fuera de combate. | Years of fighting have made you invincible. Mortal blows have gained you 1 life point instead of knocking you out. | Zahlreiche Jahre harter Kämpfe haben dich fast unverwundbar gemacht. Selbst nach normalerweise tödlichen Schlägen bleibt dir noch ein Lebenspunkt übrig. |
| Permanent: LEAD_BONES | Pas toujours pratique pour se déplacer, le plombage intégral de la cage thoracique permet néanmoins de réduire considerablement les dégâts des armes contondantes. | No es muy fácil de llevar, pero un refuerzo metálico de tu caja toráxica reducirá el impacto de los golpes. | Although it's extremely heavy, a lead skeleton is essential as it considerably reduces blunt weapon damage. | Auch wenn es extrem viel wiegt, ein Bleiskelett ist nötig, es schwächt Schaden durch stumpfe Waffen erheblich ab. |
| Permanent: BALLERINA | La danse des cygnes n'a aucun secret pour toi, impossible que ton adversaire t'atteigne, enfin, tant qu'il pige pas le truc. | Joaquín Cortés es un calcetín viejo al lado tuyo, te mueves tan bien que tus adversarios no logran ni tocarte. | You've mastered the swan dance, making it impossible for your opponent to reach you, as long as he hasn't mastered it too! | Du hast den Tanz des Schwans erlernt. Solange dein Gegner ihn nicht ebenfalls beherrscht, kann er nicht nahe an dich rankommen. |
| Permanent: STAYER | Rien ne te décourage, chaque échec te rend plus fort. Lorsqu'un coup ne porte pas, tu en lances un autre. | Nada te desanima, cada derrota te hace más fuerte. Incluso cuando golpeas al aire, le sigues golpeando. | Nothing can stop you! Each defeat makes you stronger, if one of your blows fails to land, you immediately strike again! | Nichts kann dich aufhalten! Jede Niederlage macht dich nur stärker. Geht einer deiner Schläge mal daneben, haust du sofort erneut zu. |
| Permanent: WARM_BLOODED | Tes adversaires entrent dans l'arène, mais toi tu préferes rentrer dans tes adversaires, tu es toujours le premier à frapper. | Eres el más rápido del oeste: Ni bien tus adversarios han entrado en la arena y tu ya les diste un golpe. | Your opponents enter the arena slowly, but you prefer to get stuck in straight away! You're always the first to attack! | Deine Gegner betreten gemächlich die Arena. Aber du kommst lieber direkt zur Sache! Der erste Angriff gehört immer dir! |
| Permanent: INCREVABLE | Pour te mettre au tapis, il faut s'y prendre à plusieurs fois... C'est cinq beignes minimum, sinon rien. | Dejarte en la lona, no es nada fácil... Se requiere por lo menos cinco buenas bofetadas. | It takes your opponents endless blows to knock you out. It takes at least 5 blows before you feel anything. | Dein Gegner muss endlos auf dich einschlagen, um dich k.o. zu hauen. Du musst mindestens 5 Schläge einstecken, ehe du überhaupt etwas spürst. |
| Permanent: DIESEL | Pour analyser les failles de ton adversaire, tu es prêt à prendre ton temps, mais lorsque tu démarres rien ne t'arrete. | Te tomas tu tiempo para analizar los puntos débiles de tu adversario, ¡pobre de él si se cruza en tu camino! | You're prepared to take your time in order to analyse your opponent's weaknesses, but once you start fighting, nothing will stop you. | Du nimmst dir von nun an die Zeit, die Schwachstellen deines Gegners herauszufinden. Wenn du dann loslegst, wird dich nichts aufhalten können. |
| Permanent: COUNTER | La meilleur attaque ? C'est la défense bien entendu ! Pour chaque coup paré, tu ripostes automatiquement. | ¿Intentaron golpearte? ¡Eso no se puede quedar así! Por cada golpe evitado, respondes al instante. | What's the best form of attack? Defense of course! You'll immediately strike back after blocking your opponent's blow. | Die beste Art anzugreifen? Durch Verteidigung natürlich! Du schlägst sofort zurück, sobald du einen Schlag deines Gegners abgeblockt hast. |
| Permanent: IRON_HEAD | Lorsque tu prends un coup, c'est ton adversaire qui doit résister à l'impact ! | Cuando tu adversario piensa en lanzar un golpe, debe prepararse a recibir uno. | Your opponent will be damaged by his own blows! | Dein Gegner wird durch seine eigenen Schläge verletzt! |
| Super: THIEF | Cette compétence te permet d'emprunter discrétement l'arme de ton adversaire et de l'essayer sur lui. | Esta competencia te permite tomar discretamente el arma de tu adversario y usarla sobre él. | This skill allows you to discreetly steal your opponent's weapon and then use it against him. | Mit dieser Fähigkeit kannst du dir die Waffe deines Gegners ausleihen und sie an ihm ausprobieren. |
| Super: BRUTE | Maintenant, t'es une vraie brute. Encore plus qu'avant. Tu peux effectuer une charge puissante pendant un combat. | ¡Ahora eres más bruto que antes! Tus descargas son aún más violentas durante el combate. | Now you're a real Brute. You're more powerful and violent than ever during fights. | Du bist jetzt ein richtiger Brutalo! Noch viel brutaler und grausamer als vorher. In deinen Kämpfen lässt du richtig dicke Schlagladungen von dir. |
| Super: MEDECINE | Boooooire un p'tit coup c'est agréaaableuuu ! Oui, mais pas pour tout le monde.... Ce jus de pêche restaure une partie de ton énergie au cours du combat. | Beeber un poooquito no haaace daaaño, ¡hip!  Este traguito restaura una parte de tu energía durante el combate. | Have a little sip of this. It could make you a bit drunk. Hic... hic... This peach juice restores some of your energy lost during the fight | Komm her, ich schenk dir ein! Austeilen macht dir so richtig Spaß! Jupp, das weckt Lebenskräfte. |
| Super: NET | Un filet classique. Pas aussi cool que la toile de Spiderman, mais faudra faire avec... Ton adversaire sera immobilisé jusqu'à ce que tu lui portes un coup. | Una red clásica. No es tan chula como la de Spiderman, pero al menos podrás inmovilizar a tu adversario hasta que le des un golpe. | A classic net. Not as cool as Spiderman's, but it's good enough for your opponent... Your enemy will be immobilised until you hit him again. | Ein Kampfnetz - ist zwar nicht ganz so cool wie das von Spiderman, aber es hilft: Dein Gegner verheddert sich und kann dann von dir vermöbelt werden. |
| Super: BOMB | Un peu comme une bombe à eau, mais en plus méchant. | Es como lanzar un globito de agua, pero mucho más divertido. | A bit like a water bomb, but far more deadly! | Das Ding hier ist 'ne Art Wasserbombe - nur noch fieser. |
| Super: GRAB | Une technique de catch qui consiste à sauter avec l'adversaire, et retomber dessus. | Una técnica de catch que consiste en saltar con el adversario y caer encima de él. Puede provocar heridas graves. | A catching technique which consists of jumping into the air with your opponent, and then falling on top of him. | Der Dampfhammer! Wer kennt ihn nicht? Eine klassische Catchtechnik. Spring mit deinem Gegner in die Luft und fall mit ihm danach auf den Boden! |
| Super: SHOUT | Des bêtes féroces, ça ? Pfffff... Il suffit de crier un peu pour les faire fuir... | ¿Bestias feroces? ¡Ja!... Pégales un grito y verás como saldrán corriendo. | Fierce beasts? Pfffff... You only need to scream and they'll run for their lives! | Wilde Bestien?! Das da? Pffff... Du musst nur ein wenig schreien, dann ergreifen sie schon die Flucht! Dass ich nicht lache! |
| Super: HYPNO | Lorsqu'il s'agit de faire du charme aux animaux domestiques, personne ne t'égale. Ils te suivent au doigt et à l'oeil. | Hueles como un animal, por eso los dominas como si fueran dóciles caniches. | When it comes to training domestic animals, no one comes close to you. They follow your every beck and call. | Im Haustiere zähmen macht dir keiner so schnell was vor. Die Viecher gehorchen dir aufs Wort. |
| Super: DOWNPOUR | Puisque se ballader avec 100 kilos d'armes t'es devenu insupportable, tu as trouvé un astucieux stratagème pour voyager léger.  | Pasearse por la calle con 100 kilos de armas es pesado. Pero has encontrado un modo eficaz de aligerar tu carga.  | Walking around carrying 100 kilos of weapons is very tiring but you have found a clever way of travelling light. | 100 Kilo Waffen mit sich herumzuschleppen ist auf die Dauer etwa mühsam... aber du hast dir etwas Geniales einfallen lassen. |
| Super: TRAPPER | Rien ne se perd, tout se transforme. Tu consommes toutes les viandes mortes de l'arène. | Nada se desperdicia. Te comes todo lo que cae en la arena. | Recycle! Make it part of your everyday cycle! You gobble up all the dead bodies in the arena. | Recycling! Mach es zum Teil deines Lebens! Du sammelst alle Leichen in der Arena ein. |
| Talent: HYPERACTIVE | Grâce à ta capacité de cicatrisation hors-normes, tu ne rates jamais un combat ! | Gracias a tu extraordinaria capacidad de cicatrización no te pierdes ningún combate | Due to your extraordinary ability to heal yourself, you never lose a fight! | Dank deiner außergewöhnlichen Selbstheilungskräfte verlierst du nie einen Kampf! |
| Talent: COOK | Toutes les brutes le savent, le gros du combat se joue avant l'arène. Le plus souvent, du coté de la cantine... | Todos los Brutos lo saben, el combate empieza antes de entrar a la arena. Y terminan... en la cantina. | All brutes know that the biggest fight is in the canteen, not the arena! | Jeder Brutalo weiß - die größten Kämpfe werden nicht in der Arena ausgetragen, sondern in der Kantine. |
| Talent: SPY | Un coup d'oeil et quelques renseignements permettent souvent d'éviter les longs séjours à l'hopital. | Unos guiños de ojo y una buena fuente de información pueden evitarte una larga estadía en el hospital. | By carrying our some reconnaissance missions before your fight, you’ll avoid long hospital visits. | Durch Schärfen deiner Sinne vor dem Kampf vermeidest du lange Krankenhausaufenthalte. |
| Talent: SABOTEUR | Du marteau en mousse à l'épee en plastique, tu es le roi de l'imitation, tes adversaires n'y voient que du feu. | Desde pequeño ya les sacabas la lengua a tus amigos, hoy eres un verdadero carnicero. | From foam hammers to plastic swords, you’re fake weapon king! Your opponents won’t notice until it’s too late. | Von Schwamm-Hämmern bis zu Plastik-Schwertern, du bist der König der Waffen-Attrappen! Bis deine Gegner das merken, ist es schon zu spät für sie. |
| Talent: STRIKER | Parceque l'amitié c'est le partage, tu as appris à partager tes baffes pour que les adversaires de tes collègues profitent aussi un peu. | Porque los amigos de tus amigos también son tus amigos, repartes bofetadas en los combates de tus compañeros. | Friendship is all about sharing. Luckily for you, you’ve learnt to share your blows with your opponents so that they can have some too! | Bei Freundschaft geht es um's Teilen. Gut dass du gelernt hast, Schläge auszuteilen. So haben deine Gegner auch was davon. |

### Advanced descriptions (neko only)

| Entry | fr | es | en | de |
|---|---|---|---|---|
| Permanent: SUPER_FORCE | Force +3 Force +50% | Fuerza +3 Fuerza +50% | Strength +3 Strength +50% | Kraft +3 Kraft +50% |
| Permanent: SUPER_AGILITY | Agilité +3 Agilité +50% | Agilidad +3 Agilidad +50% | Agility +3 Agility +50% | Flinkheit +3 Flinkheit +50% |
| Permanent: SUPER_SPEED | Rapidité +3 Rapidité +50% | Velocidad +3 Velocidad +50% | Speed +3 Speed +50% | Geschwindigkeit +3 Geschwindigkeit +50% |
| Permanent: SUPER_LIFE | Endurance +3 Endurance +50% | Resistencia +3 Resistencia +50% | Endurance +3 Endurance +50% | Ausdauer +3 Ausdauer +50% |
| Permanent: IMMORTALITY | Endurandce +250% Force -25% Agilite -25% Rapidite -25% | Resistencia +250% Fuerza -25% Agilidad -25% Velocidad -25% | Endurance +250% Strength -25% Agility -25% Speed -25% | Ausdauer +250% Kraft -25% Flinkheit -25% Geschwindigkeit -25% |
| Permanent: BLADE_MASTER | Dégâts des armes tranchantes : +50% | Daños con arma blanca: +50% | Sharp weapon damage: +50% | Schaden mit Stichwaffen: +50% |
| Permanent: BRAWL_MASTER | Dégâts à mains nues : +100% | Daños con puño limpio: +100% | Bare-handed damage: +100% | Schaden mit bloßen Händen: +100% |
| Permanent: VIGILANCE | Chances de contre : +10% | +10% posibilidad de bloqueo | +10% chance of block | +10% Chance zu blocken |
| Permanent: PUGNACITY | Chances de riposte : +30% | +30% posibilidad de contraataque | +30% chance of counter-attack | +30% Chance auf Konterangriff |
| Permanent: TWISTER | Chances de combo : +20% | +20% posibilidad de combo | +20% chance of combo | +20% Chance auf Combo |
| Permanent: SHIELD | Chances de parade : +45% | +45% posibilidad de rechazo | +45% chance of parry | +45% Chance zu parieren |
| Permanent: ARMOR | Armure +5 Rapidité -10% | Blindaje +5 Velocidad -10% | Armor +5 Speed -10% | Rüstung +5 Geschwindigkeit -10% |
| Permanent: LEATHER_SKIN | Armure +2 | Blindaje +2 | Armor +2 | Rüstung +2 |
| Permanent: UNTOUCHABLE | Chances d'esquive +30% | +30% posibilidad de evasión | +30% chance of evasion | +30% Chance auszuweichen |
| Permanent: VANDALISM | Détruit une arme à chaque coup qui blesse | Destruye un arma cada vez que lanzas un golpe certero | Destroy a weapon each time you land a blow | Zerstört eine Waffe bei jedem deiner Treffer |
| Permanent: CHOC | Chance de désarmer +50% | +50% posibilidades de desarme | +50% chance of disarmament | +50% Chance auf Entwaffnung |
| Permanent: BLUNT_MASTER | Interval -25% entre les coups d'armes lourdes | Intervalo de -25% entre ataques pesados | -25% interval between heavy weapon attacks | -25% Pause zwischen Angriffen mit schweren Waffen |
| Permanent: MERCILESS | Chance de toucher +30% | +30% de posibilidades de herir a tu oponente | +30% chance of injuring your opponent | +30% Chance, Gegner zu verletzen |
| Permanent: SURVIVAL | Le premier coup t'amenant à 0 pv ou moins te laisse à 1 pv. | El primer golpe que recibes en una pelea te dejará con 0 o 1 PV. | The first blow you receive during a fight will lose you 0 or possibly 1 HP. | Der erste Treffer, den du einsteckst, kostet dich nur 0-1 LP. |
| Permanent: LEAD_BONES | Les armes lourdes t'infligent 30% de dégâts en moins. | Las armas pesadas causan al menos 30% de daños. | Heavy weapons inflict at least 30% damage. | Schwere Waffen fügen min. 30% Schaden zu. |
| Permanent: BALLERINA | Le premier coup de chaque combat est automatiquement esquivé. | El primer golpe de cada pelea sera automáticamente esquivado. | The first blow of each fight will be automatically avoided. | Der erste Treffer im Kampf wird automatisch verhindert. |
| Permanent: STAYER | Tant que le coup ne blesse pas, 70% de chance d'attaquer à nouveau. | Si tu golpe no hiere a tu oponente, hay un 70% de posibilidades que tu Bruto lance otro ataque. | If your blow does not hurt your opponent, there is a 70% chance of your Brute launching another attack. | Falls dein Schlag deinen Gegner nicht verletzt, erhältst du zu 70% einen weiteren Angriff. |
| Permanent: WARM_BLOODED | Initiative +200. | +200 de iniciativa. | Initiative +200. | Initiative +200. |
| Permanent: INCREVABLE | Chaque coup reçu ne peut pas te faire perdre plus de 20% de ta barre. | Los golpes de tu oponente sólo pueden reducir tu vida en 20%. | Opponent's blows can only decrease your health bar by 20%. | Gegnerische Treffer kosten dich max. 20% deiner Lebensleiste. |
| Permanent: DIESEL | Initiative -200 Rapidité +5 Rapidité +150%. | Iniciativa -200 Velocidad +5 Velocidad +150%. | Initiative -200 Speed +5 Speed +150%. | Initiative -200 Geschwindigkeit +5 Geschwindigkeit +150%. |
| Permanent: COUNTER | Chances de parade +10%. Chaque coups paré entraine une riposte automatique. | +10% de posibilidades de evasión. Tu Bruto contraatacará después de cada golpe bloqueado exitosamente. | +10% chance of evasion. Your Brute will counter-attack after each blow successfully blocked. | +10% Chance auszuweichen. Dein Brutalo erhält bei jedem erfolgreichen Block einen Konterangriff. |
| Permanent: IRON_HEAD | Pour chaque coup te ciblant, ton adversaire a 30% de chance de perdre son arme. | Por cada ataque dirigido a ti, tu oponente tendrá 30% de posibilidades de perder su arma. | For each attack targeted at you, your opponent will have a 30% chance of losing their weapon. | Bei jedem Angriff gegen dich verliert dein Gegner zu 30% seine Waffe. |
| Super: THIEF | Action (x2) Ta brute prend l'arme de son adversaire. | Acción (x2) Tu Bruto coge el arma de su oponente. | Action (x2) Your Brute picks up his opponent's weapon. | Aktion (x2) Dein Brutalo nimmt die Waffe deines Gegners. |
| Super: BRUTE | Action (x1) Ta brute double les dégats du prochain assaut. | Acción (x1) Los golpes de tu Bruto causan doble daño durante el próximo ataque. | Action (x1) Your Brute's blows will cause double damage during the next attack. | Aktion (x1) Dein Brutalo verursacht mit dem nächsten Angriff doppelten Schaden. |
| Super: MEDECINE | Action (x1) Ta brute récupère entre 25% et 50% des pv perdus. | Acción (x1) Tu Bruto recupera entre 25% y 50% PV. | Action (x1) Your Brute regains between 25% and 50% HP. | Aktion (x1) Dein Brutalo erhält zwischen 25% und 50% LP zurück. |
| Super: NET | Action (x1) Le filet empêche la cible de bouger/esquiver/parer jusqu'au prochain coup reçu. | Acción (x1) La red impide que tu víctima se mueva hasta el próximo golpe. | Action (x1) The net stops the target from evading your next attack. | Aktion (x1) Das Netz verhindert, dass dein Ziel deinem nächsten Angriff ausweicht. |
| Super: BOMB | Action (x2) Entre 15 et 25 dégats sur tous les adversaires. | Acción (x2) Entre 15 y 25 daños a todos tus oponentes. | Action (x2) Between 15 and 25 damage inflicted on all your opponents. | Aktion (x2) Alle deine Gegner erleiden zwischen 15 und 25 Schaden. |
| Super: GRAB | Action (x1) Ta brute inflige de lourds dégats dépendant de sa force à son adversaire. | Acción (x1) Tu Bruto causa daños graves según la fuerza de su adversario. | Action (x1) Your Brute inflicts heavy damage depending on the strength of your opponent. | Aktion (x1) Dein Brutalo verursacht je nach der Kraft deines Gegners schweren Schaden. |
| Super: SHOUT | Action (x2) Cri repoussant les animaux ( 50% de réussite ). | Acción (x2) Grito auyentador de animales (50% de posibilidades de éxito). | Action (x2) Animal repelling scream ( 50% chance of success). | Aktion (x2) Dein Brutalo stößt einen Schrei aus, der Tiere vertreibt (50% Erfolgschance). |
| Super: HYPNO | Action (x1) Ta brute contrôle les animaux de son adversaire. | Acción (x1) Tu Bruto controla los animales de su adversario. | Action (x1) Your Brute takes control of your opponent's animals. | Aktion (x1) Dein Brutalo übernimmt die Kontrolle über die Tiere deines Gegners. |
| Super: DOWNPOUR | Action (x1) Ta brute lance instantanément la moitié de ses armes sur son adversaire. | Acción (x1) Tu Bruto ataca con la mitad de todas sus armas. | Action (x1) Your Brute instantly attacks his opponent with half their weaponry. | Aktion (x1) Dein Brutalo greift den Gegner mit der Hälfte seiner Waffen an. |
| Super: TRAPPER | Action (x4) Ta brute récupère entre 20 et 50% de son energie selon la qualité de la viande. | Acción (x4) Tu Bruto recupera entre 20 y 50% de su energía según la calidad de la carne. | Action (x4) Your brute regains between 20 and 50% of his health depending on the quality of the meat. | Aktion (x4) Dein Brutalo erhält zwischen 20 und 50% seiner LP zurück, je nach Güte des Fleisches. |
| Talent: HYPERACTIVE | Tu peux subir une blessure de plus par jour. | Puedes soportar una herida más por día. | You can withstand one extra death each day. | Du widerstehst jeden Tag einem weiteren Tod. |
| Talent: COOK | (24h) Tes futurs adversaires subissent 2% de dégats à la fin de chacune de leurs actions. | (24h) Tus futuros oponentes sufren 2% de daños al final de cada una de sus acciones. | (24h) Your future opponents will suffer 2% damage at the end of each of their actions. | (24h) Deine künftigen Gegner erleiden 2% Schaden am Ende jeder ihrer Aktionen. |
| Talent: SPY | (24h) Tu peux accéder aux détails des fiches de tes adversaires. | (24h) Puedes acceder a los perfiles de tus oponentes. | (24h) Access your opponents profiles. | (24h) Zugriff auf die Profile deiner Gegner. |
| Talent: SABOTEUR | (24h) Sabote une arme pour chacun de tes futurs adversaire ( init -100 lorsqu'elle est utilisée ). | (24h) Destruye el arma de cada uno de tus futuros oponentes (iniciativa -100 cuando es utilizado). | (24h) Destroy one of your future opponents( initiative -100 until it’s used). | (24h) Zerstört einen deiner zukünftigen Gegner (Initiative -100 bis zur Benuztung). |
| Talent: STRIKER | (24h) Ta brute peut intervenir dans les combats de ses collègues de niveau superieur. | (24h) Tu Bruto puede intervenir en los combates de sus colegas de nivel superior. | (24h) Your Brute can help superior team-members during fights. | (24h) Dein Brutalo kann stärkeren Team-Mitgliedern in Kämpfen helfen. |

## Selecting a language

`setLang(lang)` looks up the named language object and copies each expected catalog array onto the `Lang` class. It throws if the language is unknown or a required array is missing; there is no silent fallback in this method. `__init__()` registers the four catalogs and calls `setLang("fr")` to initialize the public arrays.

## Looking up a bonus name

`getBonus(b)` pattern-matches the `_Bonus` tag (`Permanent`, `Weapons`, `Super`, `Followers`, or `Talent`) and uses the enum's position to return the matching string from the corresponding catalog. For this lookup to remain correct, the localized arrays must preserve the enum order defined in [`Data.hx`](data.md#bonus-and-fighter-enums).

Localization changes affect labels and descriptions only. The numeric effects are defined by [`Gladiator`](gladiator.md#permanent-bonus-effects) and the combat resolution is defined by [`Arena`](arena.md).
