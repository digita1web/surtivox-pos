import { canAdvance, canFinish, canSkip, hasProgress, type WizardDraft } from './productWizard.ts';

export interface StepActions {
  showBack: boolean;
  primary: { label: string; enabled: boolean } | null;
  showSkip: boolean;
  isWelcome: boolean;
  isFinish: boolean;
}

export const WELCOME_LABELS = { start: 'Empezar', quickSale: 'Vender ahora sin registrar' } as const;

export function stepActions(draft: WizardDraft): StepActions {
  switch (draft.step) {
    case 'welcome':
      return { showBack: false, primary: null, showSkip: false, isWelcome: true, isFinish: false };
    case 'photo': {
      const has = draft.photoUri !== null;
      return {
        showBack: true,
        primary: has ? { label: 'Siguiente', enabled: true } : null,
        showSkip: canSkip('photo') && !has,
        isWelcome: false,
        isFinish: false,
      };
    }
    case 'details':
      return {
        showBack: true,
        primary: { label: 'Siguiente', enabled: canAdvance(draft) },
        showSkip: false,
        isWelcome: false,
        isFinish: false,
      };
    case 'category': {
      const has = draft.categoryId !== null;
      return {
        showBack: true,
        primary: has ? { label: 'Siguiente', enabled: true } : null,
        showSkip: canSkip('category') && !has,
        isWelcome: false,
        isFinish: false,
      };
    }
    case 'price':
      return {
        showBack: true,
        primary: { label: 'Crear producto', enabled: canFinish(draft) },
        showSkip: false,
        isWelcome: false,
        isFinish: true,
      };
  }
}

export type ExitAction = 'leave' | 'confirm';

export function exitAction(draft: WizardDraft): ExitAction {
  return hasProgress(draft) ? 'confirm' : 'leave';
}

export type ResumeOffer = 'none' | 'offer';

export function resumeOffer(stored: WizardDraft | null): ResumeOffer {
  return stored !== null && hasProgress(stored) ? 'offer' : 'none';
}

export function shouldSaveDraft(draft: WizardDraft): boolean {
  return hasProgress(draft);
}

export const RESUME_LABELS = { continue: 'Continuar donde quedaste', restart: 'Empezar de nuevo' } as const;
