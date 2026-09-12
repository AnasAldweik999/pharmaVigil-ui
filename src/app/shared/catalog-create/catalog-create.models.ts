export interface CatalogCreateConfig {
  endpoint: string;
  backRoute: string;
  backLabelKey: string;
  pageTitleKey: string;
  nameLabelKey: string;
  namePlaceholderKey: string;
  minLength: number;
  minLengthErrorKey?: string;
  submitLabelKey: string;
  createdMessageKey: string;
}
