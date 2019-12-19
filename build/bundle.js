(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(require('@bhmb/bot')) :
  typeof define === 'function' && define.amd ? define(['@bhmb/bot'], factory) :
  (global = global || self, factory(global['@bhmb/bot']));
}(this, (function (bot) { 'use strict';

  function randomId() {
      return Math.random().toString(16).substr(3, 6);
  }
  function upUntil(cls, el) {
      if (el === document.body || el.classList.contains(cls)) {
          return el;
      }
      return upUntil(cls, el.parentElement);
  }
  function getId(box) {
      return box.querySelector('[data-target=id]').value;
  }
  function getPrompt(box) {
      return box.querySelector('[data-target=prompt]').value;
  }
  function getResponses(box) {
      return Array.from(box.querySelectorAll('.response')).map(resp => {
          return {
              match: resp.querySelector('input').value,
              message: resp.querySelector('textarea').value
          };
      }).filter(({ match, message }) => match.length > 0 || message.length > 0);
  }

  var html = "<template data-for=\"response\">\n  <div class=\"response\">\n    <p>Match</p>\n    <input class=\"input is-small\">\n    <p>Message</p>\n    <textarea class=\"textarea is-small is-fluid\" data-target=\"id\"></textarea>\n    <hr>\n  </div>\n</template>\n\n<template data-for=\"prompt\">\n  <div class=\"box\">\n    <div class=\"columns\">\n      <div class=\"column is-narrow is-hidden-touch\">\n        <span class=\"drag\"></span>\n      </div>\n      <div class=\"column\">\n        <details>\n          <summary data-target=\"summary\"></summary>\n          <p class=\"has-text-weight-bold\">Prompt ID</p>\n          <input class=\"input is-small\" data-target=\"id\"></textarea>\n          <p class=\"has-text-weight-bold\">Prompt</p>\n          <textarea class=\"textarea is-small is-fluid\" data-target=\"prompt\"></textarea>\n          <br>\n          <button class=\"button is-small is-primary is-outlined\" data-do=\"add-response\">Add response</button>\n          <div class=\"responses-container\"></div>\n        </details>\n      </div>\n      <div class=\"column is-narrow\">\n        <button class=\"button is-small is-danger is-outlined\" data-do=\"delete\">Delete</button>\n      </div>\n    </div>\n  </div>\n</template>\n\n<div class=\"container is-widescreen prompts\">\n  <section class=\"section is-small\">\n    <span class=\"button is-primary is-adding-message\">+</span>\n    <h3 class=\"title is-4\">Prompt Messages</h3>\n    <ul class=\"content\">\n      <li>These messages can be started by SERVER for a target user.</li>\n      <li>Once started, the user's next message will be taken as the response from the player.</li>\n      <li>Each \"response\" part of a message will be checked in order. If a player's message looks like the \"match\" section of a response, the \"message\" section of the response will be sent. Otherwise, the next response will be checked.</li>\n      <li>If you want a fallback response, leave the \"match\" section of the response empty.</li>\n      <li>{{NAME}}, {{Name}}, and {{name}} in the message will be replaced with the user's name.</li>\n      <li>If you want a response to start another prompt, you can turn on split messages under advanced settings.</li>\n      <li>Prompt IDs may not contain spaces. If they contain spaces /prompt won't work.</li>\n      <li>To remove a response just leave the match and message sections blank and it will be removed when you next load the bot.</li>\n    </ul>\n\n    <h3 class=\"title is-5\">Example:</h3>\n    <div class=\"content\">\n      <ol>\n        <li>Given a prompt with ID \"hi\", prompt \"hi there\" and three responses:</li>\n        <ol>\n          <li>Match \"hi\" to send \"/admin {{name}}\"</li>\n          <li>Match \"hello\" to send \"/ban {{name}}\"</li>\n          <li>Match \"\" to send \"/kick {{name}}\"</li>\n        </ol>\n        <li>When SERVER says /prompt hi PLAYER</li>\n        <li>The bot will send \"hi there\"</li>\n        <li>If PLAYER says \"hi\" they will be admined.</li>\n        <li>If PLAYER says \"hello\" they will be banned.</li>\n        <li>If PLAYER says anything else, they will be kicked.</li>\n      </ol>\n    </div>\n  </section>\n\n  <div class=\"messages-container\"></div>\n</div>\n";

  const KEY = 'prompts';
  function initListeners(ex) {
      function getPrompts() {
          return ex.storage.get(KEY, []);
      }
      // name => prompt id
      const prompts = new Map();
      function startPrompt(message) {
          const [, id = '', name = ''] = message.match(/([^ ]+) (.*)/) || [];
          const player = ex.world.getPlayer(name);
          if (!player.hasJoined) {
              ex.bot.send('Failed to start prompt for {{Name}}, they have never joined.', { name });
              return;
          }
          const prompt = getPrompts().find(p => p.id.trim().toLocaleLowerCase() === id.trim().toLocaleLowerCase());
          if (!prompt) {
              ex.bot.send(`Failed to start prompt ${id} for {{Name}}, not found.`, { name: player.name });
              return;
          }
          ex.bot.send(prompt.prompt, { name: player.name });
          prompts.set(player.name, prompt.id);
      }
      function checkPrompts(player, chat) {
          const promptId = prompts.get(player.name);
          prompts.delete(player.name);
          if (!promptId)
              return; // Nothing to do. No active prompts
          const prompt = getPrompts().find(p => p.id === promptId);
          if (!prompt)
              return; // User edited prompt id before they responded. Cancel
          for (const { match, message } of prompt.responses) {
              if (chat.toLocaleLowerCase().includes(match.toLocaleLowerCase().trim()) && message.length > 0) {
                  ex.bot.send(message, { name: player.name });
                  return;
              }
          }
      }
      function listen({ player, message }) {
          const lowerMessage = message.toLocaleLowerCase();
          if (player.name === 'SERVER' && lowerMessage.startsWith('/prompt ')) {
              startPrompt(message.substr('/prompt '.length));
          }
          else if (name !== 'SERVER') {
              checkPrompts(player, message);
          }
      }
      ex.world.onMessage.sub(listen);
      return () => ex.world.onMessage.unsub(listen);
  }
  function initUi(tab, ui, ex) {
      const addButton = tab.querySelector('.is-adding-message');
      const promptTemplate = tab.querySelector('template[data-for=prompt]');
      const responseTemplate = tab.querySelector('template[data-for=response]');
      const container = tab.querySelector('.messages-container');
      function addMessage(info) {
          ui.buildTemplate(promptTemplate, container, [
              { selector: '[data-target=summary]', text: `${info.id} -> ${info.prompt}` },
              { selector: '[data-target=id]', value: info.id },
              { selector: '[data-target=prompt]', value: info.prompt }
          ]);
          const box = container.querySelector('.box:last-child');
          const responseContainer = box.querySelector('.responses-container');
          for (const resp of info.responses) {
              ui.buildTemplate(responseTemplate, responseContainer, [
                  { selector: 'input', value: resp.match },
                  { selector: 'textarea', value: resp.message }
              ]);
          }
      }
      ex.storage.get(KEY, []).forEach(addMessage);
      function save() {
          const data = Array.from(container.querySelectorAll('.box')).map(box => {
              return {
                  id: getId(box),
                  prompt: getPrompt(box),
                  responses: getResponses(box)
              };
          });
          ex.storage.set(KEY, data);
      }
      addButton.addEventListener('click', () => {
          const id = randomId();
          addMessage({ id, prompt: '', responses: [] });
      });
      container.addEventListener('input', ev => {
          const target = ev.target;
          if (['id', 'prompt'].includes(target.dataset.target || '')) {
              const box = upUntil('box', target);
              box.querySelector('summary').textContent = `${getId(box)} -> ${getPrompt(box)}`;
          }
          save();
      });
      container.addEventListener('click', ev => {
          const target = ev.target;
          if (target.dataset.do === 'add-response') {
              const box = upUntil('box', target);
              const container = box.querySelector('.responses-container');
              ui.buildTemplate(responseTemplate, container, []);
          }
      });
  }
  bot.MessageBot.registerExtension('bibliofile/prompts', ex => {
      const removeListeners = initListeners(ex);
      ex.remove = removeListeners;
      const ui = ex.bot.getExports('ui');
      if (!ui)
          return;
      const tab = ui.addTab('Prompts', 'messages');
      tab.innerHTML = html;
      initUi(tab, ui, ex);
      ex.remove = () => {
          removeListeners();
          ui.removeTab(tab);
      };
  });

})));
//# sourceMappingURL=bundle.js.map
