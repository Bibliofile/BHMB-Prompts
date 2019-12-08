export function randomId () {
  return Math.random().toString(16).substr(3, 6)
}

export function upUntil (cls: string, el: HTMLElement): HTMLElement {
  if (el === document.body || el.classList.contains(cls)) {
    return el
  }
  return upUntil(cls, el.parentElement!)
}

export function getId (box: HTMLElement) {
  return (box.querySelector('[data-target=id]') as HTMLInputElement).value
}

export function getPrompt (box: HTMLElement) {
  return (box.querySelector('[data-target=prompt]') as HTMLInputElement).value
}

export function getResponses (box: HTMLElement) {
  return Array.from(box.querySelectorAll('.response')).map(resp => {
    return {
      match: resp.querySelector('input')!.value,
      message: resp.querySelector('textarea')!.value
    }
  }).filter(({ match, message }) => match.length > 0 || message.length > 0)
}
