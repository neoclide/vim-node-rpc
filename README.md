# vim-node-rpc

This module is made to make vim start a messagepack server as neovim
does, so that neovim remote plugins could work for vim.

Tested on vim 8.1.150.

## How it works

![group](https://user-images.githubusercontent.com/251450/43032696-d71ef922-8cef-11e8-9ecc-392b1fbc29ed.png)

## Play with it

Install [nodejs](https://nodejs.org/en/download/) and [yarn](https://yarnpkg.com/en/docs/install)

Install [python-client](https://github.com/neovim/python-client) (used for testing) by:

    pip install neovim

Start testing service by:

    ./start.sh

You will get the message of service started.

In another terminal, connect a python REPL to rpc service like:

```python
>>> from neovim import attach
# Create a python API session attached to unix domain socket created above:
>>> nvim = attach('socket', path='/tmp/vim-rpc')
# Now do some work.
>>> buffer = nvim.current.buffer # Get the current buffer
>>> buffer[0] = 'replace first line'
>>> buffer[:] = ['replace whole buffer']
>>> nvim.command('vsplit')
>>> nvim.windows[1].width = 10
>>> nvim.vars['global_var'] = [1, 2, 3]
>>> nvim.eval('g:global_var')
[1, 2, 3]
```

## Limitation

There're some methods that no clear way to implement for vim:

* `nvim_execute_lua`
* `nvim_input`
* `nvim_buf_get_keymap`
* `nvim_buf_get_commands`
* `nvim_buf_get_mark`
* `nvim_buf_add_highlight`
* `nvim_buf_clear_highlight`
* `nvim_replace_termcodes`
* `nvim_subscribe`
* `nvim_unsubscribe`
* `nvim_get_color_by_name`
* `nvim_get_color_map`
* `nvim_get_keymap`
* `nvim_get_commands`
* `nvim_set_client_info`
* `nvim_get_chan_info`
* `nvim_list_chans`
* `nvim_call_atomic`
* `nvim_parse_expression`
* `nvim_get_proc_children`
* `nvim_get_proc`

Some methods (window and tab related) requires python support of vim to work,
you should either have `has('python')` or `has('python3')` to `1` with vim.

## Tips

* `requestId > 0` for request, use `ch_evalexpr`
* `requestId = 0` for notification, use `ch_sendraw`
* `requestId < 0` for response, send by vim

Vim use new line character for the end of JSON text.

Avoid use request for vim that not response.

## LICENSE

MIT
