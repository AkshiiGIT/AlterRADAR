# Telegram — liaison par clé en mode local

Chaque utilisateur possède son **bot Telegram personnel**, créé gratuitement via @BotFather ; AlterRADAR n'héberge pas de bot commun. **Le bot ne stocke pas les CV sur un serveur AlterRADAR** : les fichiers restent locaux jusqu'à leur transmission optionnelle à Telegram.

1. Via Telegram, ouvrir [@BotFather](https://t.me/BotFather), utiliser `/newbot`, choisir un nom unique et récupérer le token secret.
2. Dans **Surveillance & Telegram**, coller le token, puis **Enregistrer**. Le token est chiffré avec le coffre du système (Electron `safeStorage`), si disponible.
3. Cliquer sur **Générer le lien de liaison**. AlterRADAR affiche un code aléatoire de **16 caractères hexadécimaux**, valable 10 minutes, et l'URL de votre bot.
4. Ouvrir une conversation **privée** avec votre bot, envoyer **seulement la clé**. Les commandes `/connect CLE` et `/start CLE` sont aussi acceptées. Le polling `getUpdates` associe le Chat ID du message seulement si le code et l'expiration sont exacts et si l'émetteur est bien le propriétaire de ce chat privé.
5. L'ordinateur confirme automatiquement la liaison via un message sur le bot. Activer les notifications et, si souhaité, la validation des dossiers.

Pour une offre, le bot montre le titre, l'entreprise, le lieu, un extrait descriptif, le lien de l'annonce, et le contact RH/LinkedIn **uniquement si celui-ci a été ajouté depuis une source vérifiée**. Si l'option est activée, il transmet deux fichiers `.docx` (CV + lettre) et les boutons **Valider ce dossier / À corriger**.

Chaque bouton est lié à la **version précise** des deux documents, à un nonce à usage unique et à l'identifiant du chat privé. Un changement de document annule le droit d'envoi pour cette version. Après validation, le mode **Brouillon** prépare un `.eml` local contenant l'e-mail avec les deux pièces jointes ; le mode **SMTP** ne peut envoyer automatiquement que si une adresse officielle et un compte SMTP ont été configurés. Une candidature via formulaire externe nécessite encore un dépôt manuel.

Si le code ne fonctionne pas, vérifier qu'AlterRADAR tourne sur le PC (connecté à Internet), que le code date de moins de dix minutes, que vous écrivez au bon bot en privé et que ni webhook ni autre logiciel n'utilise le jeton pour consommer `getUpdates`.

**Confidentialité :** Les chats de bots Telegram ne sont pas des conversations secrètes chiffrées de bout en bout ; les documents transmis quittent le PC pour Telegram. Si cette transmission est indésirable, désactiver l'option de partage des documents.
