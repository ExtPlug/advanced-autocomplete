

function _slicedToArray(arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i['return']) _i['return'](); } finally { if (_d) throw _e; } } return _arr; } else { throw new TypeError('Invalid attempt to destructure non-iterable instance'); } }

define('extplug/advanced-autocomplete/main',['require','exports','module','meld','underscore','extplug/Plugin','plug/views/rooms/chat/ChatSuggestionView','plug/views/rooms/chat/ChatView'],function (require, exports, module) {
  var _require = require('meld');

  var around = _require.around;

  var _require2 = require('underscore');

  var isArray = _require2.isArray;
  var extend = _require2.extend;

  var Plugin = require('extplug/Plugin');
  var SuggestionView = require('plug/views/rooms/chat/ChatSuggestionView');
  var ChatView = require('plug/views/rooms/chat/ChatView');
  // prevent r.js from optimising this (:
  var templateItem = (0, require)('hbs!templates/room/chat/ChatSuggestionItem');

  // kinda random, height of a single suggestion item according to plug.dj
  var ITEM_HEIGHT = 38;

  module.exports = Plugin.extend({
    name: 'Advanced Autocomplete',
    description: 'Autocompletes things in chat according to the current room ' + 'settings. Room owners might use this for bot commands or ' + 'silly memes.',

    enable: function enable() {
      var plugin = this;

      this.onUpdate();
      this.ext.roomSettings.on('change:autocomplete', this.onUpdate, this);

      // builds a suggestions array for the current input text
      this._checkAdvice = around(SuggestionView.prototype, 'check', function (joinpoint) {
        var _this = this;

        var res = joinpoint.proceed();

        // clear the suggestion objects by default (used by our patched
        // updateSuggestions to determine if we matched custom suggestions)
        this.suggestionObjects = [];

        // original check() resulted in suggestions
        if (this.suggestions.length) {
          return res;
        }

        var _joinpoint$args = _slicedToArray(joinpoint.args, 2);

        var message = _joinpoint$args[0];
        var caret = _joinpoint$args[1];

        plugin.completions.forEach(function (o) {
          var start = message.lastIndexOf(' ' + o.trigger, caret);
          if (start === -1) {
            start = message.indexOf(o.trigger) === 0 ? 0 : -1;
          } else {
            start = start + 1;
          }

          if (start !== -1) {
            (function () {
              _this.type = o.trigger;
              var typed = message.substr(start + o.trigger.length);
              if (typed.length >= 1) {
                _this.suggestionObjects = o.suggestions.filter(function (suggestion) {
                  return (suggestion.string || '').indexOf(typed) === 0;
                }).slice(0, 10).sort(function (a, b) {
                  return a.string > b.string ? 1 : a.string < b.string ? -1 : 0;
                });
                _this.suggestions = _this.suggestionObjects.map(function (sug) {
                  return sug.string;
                });
              } else {
                _this.suggestions = [];
              }
            })();
          }
        });

        return res;
      });

      // displays the suggestions list
      this._updateAdvice = around(SuggestionView.prototype, 'updateSuggestions', function (joinpoint) {
        var _this2 = this;

        if (this.type !== '@' && this.type !== ':' && this.suggestions.length > 0 && this.suggestionObjects && this.suggestionObjects.length > 0) {
          // not users, nor emoji: this is a custom suggestion list
          var items = this.suggestionObjects.map(function (suggestion, i) {
            return $(templateItem({
              value: _this2.type + suggestion.string,
              index: i,
              image: plugin.getImage(suggestion)
            })).mousedown(_this2.pressBind).mouseenter(_this2.overBind);
          });
          this.$itemContainer.empty().append(items);
          // random copy-paste bits from plug.dj's SuggestionView#updateSuggestion
          if (this.index === -1 || this.index >= this.suggestions.length) {
            this.index = 0;
          }
          this.updateSelectedSuggestion();
          this.$el.height(this.suggestions.length * ITEM_HEIGHT);
          _.delay(this.showBind, 10);
          _.delay(this.showBind, 15);
          this.$document.on('mousedown', this.documentClickBind);
        } else {
          return joinpoint.proceed();
        }
      });

      // computes the correct selection range for custom suggestions
      // plug.dj uses "getMentionsRange" if the suggestion type == "@", or
      // "getEmojiRange" otherwise, so we'll hijack getEmojiRange for everything
      // else as well! :D
      this._rangeAdvice = around(ChatView.prototype, 'getEmojiRange', function (joinpoint) {
        var suggestionView = this.suggestionView;
        var trigger = suggestionView.type;

        // it really is an emoji thing
        if (trigger === ':') {
          return joinpoint.proceed();
        }

        var caret = this.getCaratPosition();
        if (caret > 0) {
          var message = this.chatInput.value.substr(0, caret),
              start = message.lastIndexOf(' ' + trigger);
          if (start === -1) {
            start = message.indexOf(trigger) === 0 ? 0 : -1;
          } else {
            start = start + 1;
          }
          return [start + trigger.length, caret];
        }
      });

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
      });
    },

    disable: function disable() {
      this._checkAdvice.remove();
      this._updateAdvice.remove();
      this._rangeAdvice.remove();
      this.ext.roomSettings.off('change:autocomplete', this.onUpdate);
    },

    // builds image HTML for a given suggestion
    getImage: function getImage(suggestion) {
      if (suggestion.icon) {
        return $('<div />').addClass('extplug-ac-centering').append($('<i />').addClass('icon ' + suggestion.icon))[0].outerHTML;
      }
      return '';
    },

    // builds the appropriate set of possible autocomplete suggestions
    // (without things that are irrelevant to the user etc)
    onUpdate: function onUpdate() {
      var completions = this.ext.roomSettings.get('autocomplete') || [];
      // clean up autocomplete settings
      this.completions = completions
      // remove invalid entries
      .filter(function (comp) {
        return comp && !!comp.trigger && isArray(comp.suggestions);
      }).map(function (o) {
        // clean up suggestions lists
        o.suggestions = o.suggestions
        // convert shorthand strings to suggestion objects
        .map(function (sug) {
          return typeof sug === 'string' ? { string: sug } : sug;
        })
        // remove invalid entries
        .filter(function (sug) {
          return typeof sug.string === 'string';
        })
        // remove suggestions that cannot be selected by the user
        // (mostly intended for bot commands)
        .filter(function (sug) {
          return (sug.role || 0) <= API.getUser().role;
        })
        // strip command prefix from suggestion strings
        .map(function (sug) {
          if (sug.string.indexOf(o.trigger) === 0) {
            sug.string = sug.string.slice(o.trigger.length);
          }
          return sug;
        });
        return o;
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
      .sort(function (a, b) {
        return a.trigger.length - b.trigger.length;
      });
    }

  });
});
