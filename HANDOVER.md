# Musabaqa — remise aux responsables / handover to the owners

Texte à envoyer aux responsables le jour de la remise (WhatsApp ou email). Remplacez les deux valeurs entre `<…>` : l’adresse de l’application et le lien d’entrée (Réglages → Accès à
l’application, bouton Copier. La première fois, le lien vient de la clé `ORG_ACCESS_KEY` du serveur API :
`https://<adresse>/enter/<clé>`).

English version below.

---

## Français

**Bienvenue sur Musabaqa, l’application du concours.**

Adresse : `https://<adresse>`
Lien d’entrée (à garder entre responsables) : `<lien d’entrée>`

**1. Première ouverture et premier compte**

- Ouvrez le lien d’entrée sur votre téléphone ou ordinateur. L’application y est débloquée.
- La toute première fois, un formulaire « Créer le compte administrateur » s’ouvre : ce compte est
  celui du responsable. Il n’y en a qu’un.
- Ensuite, l’adresse ou l’icône de l’application vous mène à la page de connexion.
- Si le bouton « Continuer avec Google » est présent, vous pouvez créer le compte et vous connecter
  avec votre compte Google au lieu d’un mot de passe. Les deux façons mènent au même compte si
  l’adresse e-mail est la même.

**2. Installer l’application (une fois par appareil)**

Ouvrez d’abord le lien d’entrée ou d’invitation, connectez-vous, puis :

- Android (Chrome) : touchez le bouton « Installer » affiché en haut, ou menu ⋮ → « Installer
  l’application ».
- iPhone / iPad (Safari) : Partager (le carré avec une flèche) → « Sur l’écran d’accueil ».
- Ordinateur (Chrome, Edge) : l’icône d’installation à droite de la barre d’adresse.

L’icône Musabaqa apparaît sur l’écran d’accueil. Elle s’ouvre en plein écran et vous restez
connecté.

**3. Jury et équipe**

- Page Équipe → « Inviter quelqu’un » → choisissez Jury ou Équipe → envoyez le lien sur WhatsApp.
- La personne ouvre le lien : son téléphone est débloqué, elle crée son compte (mot de passe ou
  Google), se connecte, installe l’application comme au point 2. Le lien d’invitation ne sert
  qu’une fois.
- Le lien d’entrée n’est pas nécessaire pour le jury et l’équipe.

**4. Participants et public**

- Le lien d’inscription (page Lien d’inscription) et la page des résultats
  (`https://<adresse>/results`) sont ouverts à tous : partagez-les librement, QR code compris.
- Toute autre personne qui tape l’adresse voit seulement la page des résultats.

**5. Problèmes courants**

- *Changement de téléphone, navigateur vidé* : un responsable rouvre le lien d’entrée ; un membre
  du jury ou de l’équipe demande au responsable un nouveau lien d’invitation… ou le lien d’entrée.
- *Mot de passe oublié (jury, équipe)* : le responsable va dans Équipe → ⋯ → « Mot de passe
  oublié » et envoie le mot de passe temporaire. La personne en choisit un nouveau dans Réglages →
  Mot de passe.
- *Mot de passe oublié (responsable)* : contactez votre contact technique, qui le réinitialise sur
  le serveur.
- *Compte créé avec Google* : il n’a pas de mot de passe. Connectez-vous avec Google ; si besoin,
  le responsable peut donner un mot de passe temporaire comme ci-dessus.
- *Téléphone perdu, quelqu’un quitte l’équipe* : Équipe → désactiver ou retirer la personne. Pour
  verrouiller tous les appareils d’un coup : Réglages → Accès à l’application → « Créer un nouveau
  lien ». Votre navigateur reste débloqué ; chacun des autres devra rouvrir un lien.
- *Plus aucun appareil débloqué* (tous perdus) : le contact technique lance `yarn access:reset` sur
  le serveur ; l’ancien lien d’entrée remis à la livraison fonctionne à nouveau.

---

## English

**Welcome to Musabaqa, the competition app.**

Address: `https://<address>`
Entry link (owners only): `<entry link>`

**1. First opening and first account**

- Open the entry link on your phone or computer. The app is unlocked there.
- The very first time, a "Create the admin account" form opens: that account is the owner's. There is
  only one.
- Afterwards the address or the app icon takes you to the login page.
- If a "Continue with Google" button is shown, you can create the account and log in with your Google
  account instead of a password. Both ways reach the same account when the email is the same.

**2. Install the app (once per device)**

Open the entry or invite link first, log in, then:

- Android (Chrome): tap the "Install" button shown at the top, or menu ⋮ → "Install app".
- iPhone / iPad (Safari): Share (the square with an arrow) → "Add to Home Screen".
- Computer (Chrome, Edge): the install icon at the right of the address bar.

The Musabaqa icon appears on the home screen. It opens full screen and you stay logged in.

**3. Judges and staff**

- Team page → "Invite someone" → choose Judge or Staff → send the link on WhatsApp.
- They open the link: their phone is unlocked, they create their account (password or Google), log in
  and install the app as in step 2. An invite link works once.
- Judges and staff do not need the entry link.

**4. Participants and the public**

- The registration link (Registration link page) and the results page (`https://<address>/results`)
  are open to everyone: share them freely, QR code included.
- Anyone else who types the address only sees the results page.

**5. Common problems**

- *New phone, browser data cleared*: an owner opens the entry link again; a judge or staff member
  asks the admin for a new invite link, or for the entry link.
- *Forgotten password (judge, staff)*: the admin goes to Team → ⋯ → "Forgotten password" and sends
  the temporary password. The person picks a new one in Settings → Password.
- *Forgotten password (admin)*: contact your technical contact, who resets it on the server.
- *Account created with Google*: it has no password. Log in with Google; if needed the admin can give
  a temporary password as above.
- *Lost phone, someone leaves*: Team → deactivate or remove the person. To lock every device at once:
  Settings → Access to the app → "Make a new link". Your browser stays unlocked; everyone else opens
  a link again.
- *No unlocked device left* (all lost): the technical contact runs `yarn access:reset` on the server;
  the original entry link handed over at delivery works again.
