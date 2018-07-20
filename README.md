# vim-node-rpc

## How it works

vim <-> node-rpc <-> neovim-client

## Not supported methods

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

## vim

* `requestId > 0` for request, use `ch_evalexpr`
* `requestId = 0` for notification, use `ch_sendraw`
* `requestId < 0` for response, send by vim

Vim use new line character for the end of JSON text.

Avoid use request for vim that not response, except `redraw`

## TODO

* Checkout what happens on function error
