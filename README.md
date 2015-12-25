Advanced Autocomplete
=====================

[![Join the chat at https://gitter.im/extplug/advanced-autocomplete](https://badges.gitter.im/extplug/advanced-autocomplete.svg)](https://gitter.im/extplug/advanced-autocomplete?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

ExtPlug plugin that adds additional autocomplete suggestions based on room
settings, for example to provide autocompletion for bot commands.

| ![Example using basicBot commands](http://i.imgur.com/hBMuB5F.png) |
|----------------|
| Example using basicBot commands. |

## Installation

You can install this plugin by going to your ExtPlug settings menu, pressing
"Install Plugin", and entering this Plugin URL:

```
https://extplug.github.io/advanced-autocomplete/build/advanced-autocomplete.js;extplug/advanced-autocomplete/main
```

## Room Settings

**Note: This section is intended for room hosts only.**

You can add custom autocomplete suggestions to your room by adding an
`autocomplete` property to your room settings file. The `autocomplete` property
should contain an Array of "Completion" objects, defining different trigger
characters and autocomplete suggestions.

A Completion object comes in two flavours:

 * a preset. This style uses one of the built-in autocomplete packages in the
   plugin. Currently, it only contains a preset for [basicBot commands](https://github.com/Yemasthui/basicBot/blob/master/commands.md):

   ```json
   { "preset": "basicbot" }
   ```

   This will add all the basicBot commands to the `!` trigger.

 * a custom suggestions list. This style allows you to add your own suggestions.

   ```javascript
   {
     "trigger": "!",
     "suggestions": [ /* ... */ ]
   }
   ```

   See [Custom Suggestions](#custom-suggestions) for possible formats for the
   `suggestions` property.

   When a user types the string in the `trigger` property, the given suggestions
   start to show up.

### Custom Suggestions

The `suggestions` property contains an Array of possible suggestions. These
suggestions can be:

 * a string. This will be shown as a bare string in the suggestions list.
 * an object. This allows you to control the look and feel of your suggestions
   a bit more. A suggestion object has:

     * a `string` property, containing the text that should be inserted when the
       user selects the suggestion.
     * an `icon` property, containing an icon className that will be shown to
       the left of the suggestion.
     * a `description` property, containing a super-short description of the
       suggestion that will be displayed next to the suggestion in the list.
     * a `role` property that hides the suggestion from users below the given
       rank. Note that this should be a Number! (Summary: 0 = No rank,
       1 = Resident DJ, 2 = Bouncer, 3 = Manager, 4 = Cohost, 5 = Host)

       The `role` property defaults to 0 (meaning everyone is allowed to see the
       suggestion) if it's missing.

   A suggestion object roughly looks like this:

   ```json
   {
     "string": "!ban",
     "icon": "icon-ban",
     "role": 3
   }
   ```

  Or one without rank restrictions:

  ```json
  {
    "string": "!eta",
    "icon": "icon-current-dj-white"
  }
  ```

### Example

Full example, with bot commands using a `!` trigger and "emote" commands
(perhaps turned into images by a different plugin) using a `%` trigger:

```json
{
  "autocomplete": [
    {
      "trigger": "!",
      "suggestions": [
        "!woot",
        { "string": "!eta", "icon": "icon-current-dj-white" },
        { "string": "!ban", "icon": "icon-ban", "role": 3 }
      ]
    },
    {
      "trigger": "%",
      "suggestions": [ "%shrug", "%lol", "%tableflip" ]
    }
  ]
}
```

If you are running basicBot, you can just use:

```json
{
  "autocomplete": [
    { "preset": "basicbot" }
  ]
}
```

## Building

**Note: this section is intended for developers only.**

This plugin uses NPM for dependency management and `gulp` for building.

```
npm install
gulp build
```

The built plugin will be stored at `build/advanced-autocomplete.js`.

## License

[MIT](./LICENSE)

