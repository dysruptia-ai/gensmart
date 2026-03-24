export interface TourStepConfig {
  id: string;
  title: string;
  description: string;
  targetSelector: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  route?: string;
  spotlightPadding?: number;
  clickBeforeSelector?: string;
}

// Welcome tour — runs after registration (3 steps)
export const WELCOME_TOUR_STEPS: TourStepConfig[] = [
  {
    id: 'welcome',
    title: 'onboarding.welcome.title',
    description: 'onboarding.welcome.description',
    targetSelector: '[data-tour="logo"]',
    position: 'bottom',
    route: '/dashboard',
  },
  {
    id: 'create-agent',
    title: 'onboarding.createAgent.title',
    description: 'onboarding.createAgent.description',
    targetSelector: '[data-tour="new-agent-btn"]',
    position: 'bottom',
    route: '/dashboard/agents',
  },
  {
    id: 'choose-method',
    title: 'onboarding.chooseMethod.title',
    description: 'onboarding.chooseMethod.description',
    targetSelector: '[data-tour="agent-method"]',
    position: 'bottom',
    route: '/dashboard/agents/new',
  },
];

// Editor tour — runs first time user opens any agent editor (6 steps)
export const EDITOR_TOUR_STEPS: TourStepConfig[] = [
  {
    id: 'configure-prompt',
    title: 'onboarding.configurePrompt.title',
    description: 'onboarding.configurePrompt.description',
    targetSelector: '[data-tour="prompt-editor"]',
    position: 'right',
  },
  {
    id: 'add-variables',
    title: 'onboarding.addVariables.title',
    description: 'onboarding.addVariables.description',
    targetSelector: '[data-tour="variables-tab"]',
    position: 'bottom',
    clickBeforeSelector: '[data-tab="variables"]',
  },
  {
    id: 'configure-channel',
    title: 'onboarding.configureChannel.title',
    description: 'onboarding.configureChannel.description',
    targetSelector: '[data-tour="channels-section"]',
    position: 'left',
    clickBeforeSelector: '[data-tab="channels"]',
  },
  {
    id: 'publish',
    title: 'onboarding.publish.title',
    description: 'onboarding.publish.description',
    targetSelector: '[data-tour="publish-btn"]',
    position: 'bottom',
  },
  {
    id: 'preview',
    title: 'onboarding.preview.title',
    description: 'onboarding.preview.description',
    targetSelector: '[data-tour="preview-chat"]',
    position: 'left',
  },
  {
    id: 'get-snippet',
    title: 'onboarding.getSnippet.title',
    description: 'onboarding.getSnippet.description',
    targetSelector: '[data-tour="snippet-section"]',
    position: 'top',
    clickBeforeSelector: '[data-tab="channels"]',
  },
];
