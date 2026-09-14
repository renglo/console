declare module "@wl" {
  export const smallLogo: string;
  export const largeLogo: string;
  export const background: string;
  export const captions: {
    appName: string;
    loginTitle: string;
    loginSubtitle: string;
  };
  export const locales: {
    en: {
      appName: string;
      login: {
        title: string;
        subtitle: string;
      };
      email: {
        invite: {
          subject: string;
          subjectHint: string;
          heading: string;
          intro: string;
          code: string;
          link: string;
        };
      };
    };
  };
}
