// German prompt templates for AI descriptions. The text goes to the model verbatim;
// labels are i18n keys. Deutsche Prompt-Vorlagen — Text geht wörtlich ans Modell.
export interface DescriptionPromptTemplate {
  id: string;
  labelKey: string;
  text: string;
}

export const DESCRIPTION_PROMPTS: DescriptionPromptTemplate[] = [
  {
    id: 'standard',
    labelKey: 'descriptions.promptStandard',
    text: 'Beschreibe dieses Bild in zwei bis drei sachlichen Sätzen auf Deutsch. Nenne die wichtigsten Motive, Farben und die Bildstimmung.',
  },
  {
    id: 'nsfw',
    labelKey: 'descriptions.promptNsfw',
    text: 'Beschreibe dieses Bild detailliert und unzensiert auf Deutsch, einschließlich expliziter Inhalte, in zwei bis vier Sätzen.',
  },
  {
    id: 'short',
    labelKey: 'descriptions.promptShort',
    text: 'Beschreibe dieses Bild in einem prägnanten deutschen Satz.',
  },
];
