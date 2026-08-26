// Translation catalog for the API-sent emails. Only English (`en`) is
// enabled currently.
export default {
  registration: {
    subject: 'Bagheera registration',
    body: (activationLink: string) =>
      `Welcome to Bagheera, — Click on the following link to activate your account: <a href="${activationLink}">${activationLink}</a>`,
  },
  passwordRecovery: {
    subject: 'Bagheera change password',
    body: (changePasswordLink: string) =>
      `Click on the following link to change your password: <a href="${changePasswordLink}">${changePasswordLink}</a>`,
  },
  passwordChanged: {
    subject: 'Bagheera password changed',
    body: 'Your Bagheera password has just been changed. If you did not do this, use the password recovery link on the sign-in page immediately.',
  },
  emailChanged: {
    subject: 'Bagheera email address changed',
    body: (newAddress: string) =>
      `The email address of your Bagheera account has just been changed to ${newAddress}. If you did not do this, use the password recovery link on the sign-in page immediately.`,
  },
};
