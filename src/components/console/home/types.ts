export type HomeExtension = {
  id: string;
  name: string;
  handle: string;
};

export type HomeTag = {
  key: string;
  value: string;
};

export type HomeOrg = {
  orgId: string;
  name: string;
  handle: string;
  imageSrc: string;
  isScope: boolean;
  /** Tag pairs, director / studio / year first, then any other tags. */
  tags: HomeTag[];
  extensions: HomeExtension[];
};

export type HomePortfolio = {
  id: string;
  name: string;
  about: string;
  orgs: HomeOrg[];
};
