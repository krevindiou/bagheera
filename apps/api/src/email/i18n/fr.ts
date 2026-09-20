import { safeHtml } from '../../common/escape-html';

// French translation catalog — see en.ts for the interpolation/safeHtml
// rationale; every entry here must mirror en.ts's keys exactly (checked by
// i18n/index.spec.ts).
export default {
  registration: {
    subject: 'Inscription Bagheera',
    body: (activationLink: string) =>
      safeHtml`Bienvenue sur Bagheera — Cliquez sur le lien suivant pour créer votre compte et enregistrer votre première clé d'accès : <a href="${activationLink}">${activationLink}</a>`,
  },
  emailChanged: {
    subject: 'Bagheera - adresse email modifiée',
    body: (newAddress: string) =>
      safeHtml`L'adresse email de votre compte Bagheera vient d'être changée pour ${newAddress}. Si vous n'êtes pas à l'origine de cette action, connectez-vous immédiatement avec votre clé d'accès et vérifiez votre compte.`,
  },
  confirmEmailChange: {
    subject: 'Confirmez votre nouvelle adresse email Bagheera',
    body: (confirmLink: string) =>
      safeHtml`Un changement de l'adresse email de votre compte Bagheera vers cette adresse a été demandé. Cliquez sur le lien suivant pour le confirmer : <a href="${confirmLink}">${confirmLink}</a>. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email — l'adresse email de votre compte ne change pas tant que ce lien n'est pas cliqué.`,
  },
  passkeyRegistered: {
    subject: 'Bagheera - clé d’accès ajoutée',
    body: "Une nouvelle clé d'accès vient d'être ajoutée à votre compte Bagheera. Si vous n'êtes pas à l'origine de cette action, connectez-vous immédiatement avec une de vos autres clés d'accès et supprimez celle-ci depuis les paramètres de votre compte.",
  },
};
