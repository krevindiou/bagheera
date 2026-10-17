import { nextTick } from 'vue';
import { afterEach, describe, expect, it } from 'vitest';
import { focusFirstInvalid } from './focusFirstInvalid';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('focusFirstInvalid', () => {
  it('focuses the first aria-invalid control of the form that fired the event', async () => {
    document.body.innerHTML = `
      <input id="other" aria-invalid="true" />
      <form id="f">
        <input id="ok" />
        <input id="first" aria-invalid="true" />
        <input id="second" aria-invalid="true" />
        <button id="save" type="submit">Save</button>
      </form>`;
    const form = document.getElementById('f')!;
    const submit = new Event('submit');
    form.dispatchEvent(submit);

    focusFirstInvalid({ evt: submit });

    expect(document.activeElement).toBe(document.body);
    await nextTick();
    expect(document.activeElement?.id).toBe('first');
  });

  it('finds the form from a click on a button inside it', async () => {
    document.body.innerHTML = `
      <input id="other" aria-invalid="true" />
      <form><input id="mine" aria-invalid="true" /><button id="b" type="button">Go</button></form>`;
    const click = new MouseEvent('click', { bubbles: true });
    document.getElementById('b')!.dispatchEvent(click);

    focusFirstInvalid({ evt: click });
    await nextTick();

    expect(document.activeElement?.id).toBe('mine');
  });

  it('falls back to the document when no event is given', async () => {
    document.body.innerHTML = '<input id="a" /><input id="b" aria-invalid="true" />';

    focusFirstInvalid({});
    await nextTick();

    expect(document.activeElement?.id).toBe('b');
  });

  it('does nothing when no control is invalid', async () => {
    document.body.innerHTML = '<form><input id="a" /></form>';

    focusFirstInvalid({});
    await nextTick();

    expect(document.activeElement).toBe(document.body);
  });
});
