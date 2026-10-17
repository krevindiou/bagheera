import { nextTick } from 'vue';

// Invalid-submit callback for vee-validate's `handleSubmit`. The submit
// button is disabled while validating, which drops focus to <body>; this
// puts it back on the first control marked `aria-invalid` (FormField sets it
// once the error renders, hence the tick). Scoped to the form that fired
// the event, so a page behind a drawer is never searched.
export function focusFirstInvalid({ evt }: { evt?: Event } = {}): void {
  void nextTick(() => {
    const form = evt?.target instanceof Element ? evt.target.closest('form') : null;
    (form ?? document).querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  });
}
