import { safeHtml } from '../../common/escape-html';

// French translation catalog — see en.ts for the interpolation/safeHtml
// rationale; every entry here must mirror en.ts's keys exactly (checked by
// i18n/index.spec.ts).
export default {
  registration: {
    subject: 'Inscription Bagheera',
    body: (activationLink: string) =>
      safeHtml`Bienvenue sur Bagheera — Cliquez sur le lien suivant pour activer votre compte : <a href="${activationLink}">${activationLink}</a>`,
  },
  passwordRecovery: {
    subject: 'Bagheera - changement de mot de passe',
    body: (changePasswordLink: string) =>
      safeHtml`Cliquez sur le lien suivant pour changer votre mot de passe : <a href="${changePasswordLink}">${changePasswordLink}</a>`,
  },
  passwordChanged: {
    subject: 'Bagheera - mot de passe modifié',
    body: "Le mot de passe de votre compte Bagheera vient d'être modifié. Si vous n'êtes pas à l'origine de cette action, utilisez immédiatement le lien de récupération de mot de passe sur la page de connexion.",
  },
  emailChanged: {
    subject: 'Bagheera - adresse email modifiée',
    body: (newAddress: string) =>
      safeHtml`L'adresse email de votre compte Bagheera vient d'être changée pour ${newAddress}. Si vous n'êtes pas à l'origine de cette action, utilisez immédiatement le lien de récupération de mot de passe sur la page de connexion.`,
  },
  confirmEmailChange: {
    subject: 'Confirmez votre nouvelle adresse email Bagheera',
    body: (confirmLink: string) =>
      safeHtml`Un changement de l'adresse email de votre compte Bagheera vers cette adresse a été demandé. Cliquez sur le lien suivant pour le confirmer : <a href="${confirmLink}">${confirmLink}</a>. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email — l'adresse email de votre compte ne change pas tant que ce lien n'est pas cliqué.`,
  },
  passkeyRegistered: {
    subject: 'Bagheera - clé d’accès ajoutée',
    body: "Une nouvelle clé d'accès vient d'être ajoutée à votre compte Bagheera, lui permettant de se connecter sans mot de passe. Si vous n'êtes pas à l'origine de cette action, changez immédiatement votre mot de passe depuis la page de connexion et supprimez cette clé depuis les paramètres de votre compte.",
  },
};
