define(function (require, exports, module) {

  const { around } = require('meld')
  const { isArray, extend } = require('underscore')
  const Plugin = require('extplug/Plugin')
  const SuggestionView = require('plug/views/rooms/chat/ChatSuggestionView')
  const ChatView = require('plug/views/rooms/chat/ChatView')
  // prevent r.js from optimising this (:
  const templateItem = (0, require)('hbs!templates/room/chat/ChatSuggestionItem')

  const presets = {
    basicbot: require('./presets/basicbot')
  }

  // kinda random, height of a single suggestion item according to plug.dj
  const ITEM_HEIGHT = 38

  module.exports = Plugin.extend({
    name: 'Advanced Autocomplete',
    description: 'Autocompletes things in chat according to the current room ' +
                 'settings. Room owners might use this for bot commands or ' +
                 'silly memes.',

    enable() {
      const plugin = this

      this.onUpdate()
      this.ext.roomSettings.on('change:autocomplete', this.onUpdate, this)

      // builds a suggestions array for the current input text
      this._checkAdvice = around(SuggestionView.prototype, 'check', function (joinpoint) {
        let res = joinpoint.proceed()

        // clear the suggestion objects by default (used by our patched
        // updateSuggestions to determine if we matched custom suggestions)
        this.suggestionObjects = []

        // original check() resulted in suggestions
        if (this.suggestions.length) {
          return res
        }

        let [ message, caret ] = joinpoint.args
        plugin.completions.forEach(o => {
          let start = message.lastIndexOf(` ${o.trigger}`, caret)
          if (start === -1) {
            start = message.indexOf(o.trigger) === 0 ? 0 : -1
          }
          else {
            start = start + 1
          }

          if (start !== -1) {
            this.type = o.trigger
            let typed = message.substr(start + o.trigger.length)
            if (typed.length >= 1) {
              this.suggestionObjects = o.suggestions
                .filter(suggestion => (suggestion.string || '').indexOf(typed) === 0)
                .slice(0, 10)
                .sort((a, b) => a.string > b.string ? 1
                              : a.string < b.string ? -1
                              : 0)
              this.suggestions = this.suggestionObjects.map(sug => sug.string)
            }
            else {
              this.suggestions = []
            }
          }
        })

        return res
      })

      // displays the suggestions list
      this._updateAdvice = around(SuggestionView.prototype, 'updateSuggestions', function (joinpoint) {
        if (this.type !== '@' && this.type !== ':' &&
            this.suggestions.length > 0 &&
            this.suggestionObjects && this.suggestionObjects.length > 0) {
          // not users, nor emoji: this is a custom suggestion list
          let items = this.suggestionObjects.map((suggestion, i) => {
            return $(templateItem({
              value: this.type + suggestion.string,
              index: i,
              image: plugin.getImage(suggestion)
            })).mousedown(this.pressBind).mouseenter(this.overBind)
          })
          this.$itemContainer
            .empty()
            .append(items)
          // random copy-paste bits from plug.dj's SuggestionView#updateSuggestion
          if (this.index === -1 || this.index >= this.suggestions.length) {
            this.index = 0
          }
          this.updateSelectedSuggestion()
          this.$el.height(this.suggestions.length * ITEM_HEIGHT)
          _.delay(this.showBind, 10)
          _.delay(this.showBind, 15)
          this.$document.on('mousedown', this.documentClickBind)
        }
        else {
          return joinpoint.proceed()
        }
      })

      // computes the correct selection range for custom suggestions
      // plug.dj uses "getMentionsRange" if the suggestion type == "@", or
      // "getEmojiRange" otherwise, so we'll hijack getEmojiRange for everything
      // else as well! :D
      this._rangeAdvice = around(ChatView.prototype, 'getEmojiRange', function (joinpoint) {
        let suggestionView = this.suggestionView
        let trigger = suggestionView.type

        // it really is an emoji thing
        if (trigger === ':') {
          return joinpoint.proceed()
        }

        let caret = this.getCaratPosition()
        if (caret > 0) {
          let message = this.chatInput.value.substr(0, caret),
            start = message.lastIndexOf(` ${trigger}`)
          if (start === -1) {
            start = message.indexOf(trigger) === 0 ? 0 : -1
          }
          else {
            start = start + 1
          }
          return [ start + trigger.length, caret ]
        }
      })

      // thingy to center small icons semi-properly
      this.Style({
        '.extplug-ac-centering': {
          'display': 'flex',
          'align-items': 'center',
          'justify-content': 'center',
          'height': '100%',

          'i.icon': {
            'display': 'block',
            'position': 'static'
          }
        }
      })
    },

    disable() {
      this._checkAdvice.remove()
      this._updateAdvice.remove()
      this._rangeAdvice.remove()
      this.ext.roomSettings.off('change:autocomplete', this.onUpdate)
    },

    // builds image HTML for a given suggestion
    getImage(suggestion) {
      if (suggestion.icon) {
        return $('<div />').addClass('extplug-ac-centering').append(
          $('<i />').addClass(`icon ${suggestion.icon}`)
        )[0].outerHTML
      }
      return ''
    },

    // builds the appropriate set of possible autocomplete suggestions
    // (without things that are irrelevant to the user etc)
    onUpdate() {
      let completions = this.ext.roomSettings.get('autocomplete') || []
      // clean up autocomplete settings
      this.completions = completions
        // remove invalid entries
        .filter(comp => comp && (!!comp.preset ||
                                 !!comp.trigger && isArray(comp.suggestions)))
        // resolve presets
        .map(comp => comp.preset && comp.preset in presets
                   ? extend({}, presets[comp.preset] || {}, comp)
                   : comp)
        .map(o => {
          // clean up suggestions lists
          o.suggestions = o.suggestions
            // convert shorthand strings to suggestion objects
            .map(sug => typeof sug === 'string' ? { string: sug } : sug)
            // remove invalid entries
            .filter(sug => typeof sug.string === 'string')
            // remove suggestions that cannot be selected by the user
            // (mostly intended for bot commands)
            .filter(sug => (sug.role || 0) <= API.getUser().role)
            // strip command prefix from suggestion strings
            .map(sug => {
              if (sug.string.indexOf(o.trigger) === 0) {
                sug.string = sug.string.slice(o.trigger.length)
              }
              return sug
            })
          return o
        })
        // sort by trigger length, so longer triggers get checked for
        // completions _after_ shorter triggers.
        // this way longer triggers will overwrite shorter triggers.
        // this is useful for a kind of multiple-autocomplete, for example for a
        // room bot with a "!ban" command:
        // ! triggers "!mute" and "!ban",
        // !ban triggers "!ban perma", "!ban day" and "!ban hour"
        // now if the user completes "!ban", autocomplete will switch to using
        // the !ban trigger, and offer suggestions for "perma", "hour" and "day"
        .sort((a, b) => a.trigger.length - b.trigger.length)
    }

  })

})
