import { MessageBot, MessageBotExtension, Player } from '@bhmb/bot'
import { UIExtensionExports } from '@bhmb/ui'

import { randomId, upUntil, getId, getPrompt, getResponses } from './utils'

import html from './tab.html'

interface MessageInfo {
  id: string
  prompt: string
  responses: { match: string, message: string }[]
}
const KEY = 'prompts'

function initListeners (ex: MessageBotExtension) {
  function getPrompts () {
    return ex.storage.get(KEY, [] as MessageInfo[])
  }

  // name => prompt id
  const prompts = new Map<string, string>()

  function startPrompt (message: string) {
    const [, id = '', name = ''] = message.match(/([^ ]+) (.*)/) || []
    const player = ex.world.getPlayer(name)
    if (!player.hasJoined) {
      ex.bot.send('Failed to start prompt for {{Name}}, they have never joined.', { name })
      return
    }

    const prompt = getPrompts().find(p => p.id.trim().toLocaleLowerCase() === id.trim().toLocaleLowerCase())

    if (!prompt) {
      ex.bot.send(`Failed to start prompt ${id} for {{Name}}, not found.`, { name: player.name })
      return
    }

    ex.bot.send(prompt.prompt, { name: player.name })
    prompts.set(player.name, prompt.id)
  }

  function checkPrompts (player: Player, chat: string) {
    const promptId = prompts.get(player.name)
    prompts.delete(player.name)
    if (!promptId) return // Nothing to do. No active prompts

    const prompt = getPrompts().find(p => p.id === promptId)
    if (!prompt) return // User edited prompt id before they responded. Cancel

    for (const { match, message } of prompt.responses) {
      if (chat.toLocaleLowerCase().includes(match.toLocaleLowerCase().trim()) && message.length > 0) {
        ex.bot.send(message, { name: player.name })
        return
      }
    }
  }

  function listen ({ player, message }: { player: Player, message: string }) {
    const lowerMessage = message.toLocaleLowerCase()
    if (player.name === 'SERVER' && lowerMessage.startsWith('/prompt ')) {
      startPrompt(message.substr('/prompt '.length))
    } else if (name !== 'SERVER') {
      checkPrompts(player, message)
    }
  }

  ex.world.onMessage.sub(listen)
  return () => ex.world.onMessage.unsub(listen)
}

function initUi (tab: HTMLElement, ui: UIExtensionExports, ex: MessageBotExtension) {
  const addButton = tab.querySelector('.is-adding-message') as HTMLButtonElement
  const promptTemplate = tab.querySelector('template[data-for=prompt]') as HTMLTemplateElement
  const responseTemplate = tab.querySelector('template[data-for=response]') as HTMLTemplateElement
  const container = tab.querySelector('.messages-container') as HTMLElement

  function addMessage (info: MessageInfo) {
    ui.buildTemplate(promptTemplate, container, [
      { selector: '[data-target=summary]', text: `${info.id} -> ${info.prompt}` },
      { selector: '[data-target=id]', value: info.id },
      { selector: '[data-target=prompt]', value: info.prompt }
    ])
    const box = container.querySelector('.box:last-child') as HTMLElement
    const responseContainer = box.querySelector('.responses-container') as HTMLElement
    for (const resp of info.responses) {
      ui.buildTemplate(responseTemplate, responseContainer, [
        { selector: 'input', value: resp.match },
        { selector: 'textarea', value: resp.message }
      ])
    }
  }

  ex.storage.get<MessageInfo[]>(KEY, []).forEach(addMessage)
  function save () {
    const data: MessageInfo[] = Array.from(container.querySelectorAll<HTMLElement>('.box')).map(box => {
      return {
        id: getId(box),
        prompt: getPrompt(box),
        responses: getResponses(box)
      }
    })

    ex.storage.set(KEY, data)
  }

  addButton.addEventListener('click', () => {
    const id = randomId()
    addMessage({ id, prompt: '', responses: [] })
  })

  container.addEventListener('input', ev => {
    const target = ev.target as HTMLElement
    if (['id', 'prompt'].includes(target.dataset.target || '')) {
      const box = upUntil('box', target)
      box.querySelector('summary')!.textContent = `${getId(box)} -> ${getPrompt(box)}`
    }

    save()
  })

  container.addEventListener('click', ev => {
    const target = ev.target as HTMLElement
    if (target.dataset.do === 'add-response') {
      const box = upUntil('box', target)
      const container = box.querySelector('.responses-container') as HTMLElement
      ui.buildTemplate(responseTemplate, container, [])
    }
  })
}

MessageBot.registerExtension('bibliofile/prompts', ex => {
  const removeListeners = initListeners(ex)
  ex.remove = removeListeners

  const ui = ex.bot.getExports('ui') as UIExtensionExports | undefined
  if (!ui) return

  const tab = ui.addTab('Prompts', 'messages')
  tab.innerHTML = html
  initUi(tab, ui, ex)

  ex.remove = () => {
    removeListeners()
    ui.removeTab(tab)
  }
})
