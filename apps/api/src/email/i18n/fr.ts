import { safeHtml } from '../../common/escape-html';
import { emailButton, renderEmailLayout } from '../templates/layout';

// French translation catalog — see en.ts for the interpolation/safeHtml
// and layout rationale; every entry here must mirror en.ts's keys exactly
// (checked by i18n/index.spec.ts).
export default {
  registration: {
    subject: 'Inscription Bagheera',
    body: (activationLink: string) =>
      renderEmailLayout({
        locale: 'fr',
        preheader: 'Créez votre compte et enregistrez votre première clé d’accès.',
        heading: 'Bienvenue sur Bagheera',
        bodyHtml:
          safeHtml`<p style="margin:0 0 20px;">Cliquez sur le bouton ci-dessous pour créer votre compte et enregistrer votre première clé d'accès.</p>` +
          emailButton('Créer mon compte', activationLink),
      }),
  },
  accountExists: {
    subject: 'Vous avez déjà un compte Bagheera',
    body: (signInLink: string) =>
      renderEmailLayout({
        locale: 'fr',
        preheader: 'Cette adresse email a déjà un compte.',
        heading: 'Vous avez déjà un compte',
        bodyHtml:
          safeHtml`<p style="margin:0 0 20px;">Quelqu'un, sans doute vous, a demandé à créer un compte Bagheera avec cette adresse email, mais elle en a déjà un. Connectez-vous plutôt avec votre clé d'accès. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email — rien n'a été modifié.</p>` +
          emailButton('Me connecter', signInLink),
      }),
  },
  emailChanged: {
    subject: 'Bagheera - adresse email modifiée',
    body: (newAddress: string) =>
      renderEmailLayout({
        locale: 'fr',
        preheader: "L'adresse email de votre compte a été modifiée.",
        heading: 'Adresse email modifiée',
        bodyHtml: safeHtml`<p style="margin:0;">L'adresse email de votre compte Bagheera vient d'être changée pour <strong style="color:#f2efe9;">${newAddress}</strong>. Si vous n'êtes pas à l'origine de cette action, connectez-vous immédiatement avec votre clé d'accès et vérifiez votre compte.</p>`,
      }),
  },
  confirmEmailChange: {
    subject: 'Confirmez votre nouvelle adresse email Bagheera',
    body: (confirmLink: string) =>
      renderEmailLayout({
        locale: 'fr',
        preheader: 'Confirmez votre nouvelle adresse email.',
        heading: 'Confirmez votre nouvelle adresse email',
        bodyHtml:
          safeHtml`<p style="margin:0 0 20px;">Un changement de l'adresse email de votre compte Bagheera vers cette adresse a été demandé. Cliquez sur le bouton ci-dessous pour le confirmer. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email — l'adresse email de votre compte ne change pas tant que ce lien n'est pas cliqué.</p>` +
          emailButton('Confirmer mon adresse email', confirmLink),
      }),
  },
  addressInUse: {
    subject: 'Bagheera - adresse email déjà utilisée',
    body: renderEmailLayout({
      locale: 'fr',
      preheader: 'Un autre compte a demandé à utiliser cette adresse email.',
      heading: 'Adresse email déjà utilisée',
      bodyHtml: safeHtml`<p style="margin:0;">Un autre compte Bagheera a demandé à changer son adresse email pour celle-ci. Elle appartient déjà à votre compte, donc rien n'a été modifié. Si les deux comptes sont à vous, choisissez une autre adresse pour l'autre compte ; sinon, ignorez cet email.</p>`,
    }),
  },
  passkeyRegistered: {
    subject: 'Bagheera - clé d’accès ajoutée',
    body: renderEmailLayout({
      locale: 'fr',
      preheader: 'Une nouvelle clé d’accès a été ajoutée à votre compte.',
      heading: 'Nouvelle clé d’accès ajoutée',
      bodyHtml: safeHtml`<p style="margin:0;">Une nouvelle clé d'accès vient d'être ajoutée à votre compte Bagheera. Si vous n'êtes pas à l'origine de cette action, connectez-vous immédiatement avec une de vos autres clés d'accès et supprimez celle-ci depuis les paramètres de votre compte.</p>`,
    }),
  },
  passkeyRemoved: {
    subject: 'Bagheera - clé d’accès supprimée',
    body: renderEmailLayout({
      locale: 'fr',
      preheader: 'Une clé d’accès a été supprimée de votre compte.',
      heading: 'Clé d’accès supprimée',
      bodyHtml: safeHtml`<p style="margin:0;">Une clé d'accès vient d'être supprimée de votre compte Bagheera. Si vous n'êtes pas à l'origine de cette action, connectez-vous immédiatement avec une de vos clés d'accès restantes et vérifiez celles listées dans les paramètres de votre compte.</p>`,
    }),
  },
};
