if exists('g:did_node_rpc_loaded') || v:version < 800 || has('nvim')
  finish
endif
let g:did_node_rpc_loaded = 1

let s:is_win = has("win32") || has("win64")
let s:clientIds = []
let s:logfile = tempname()
let s:channel = v:null
let s:script = resolve(expand('<sfile>:h:h:h').'/lib/index.js')


" env used only for testing purpose
if !empty($NVIM_LISTEN_ADDRESS)
  call delete($NVIM_LISTEN_ADDRESS)
  let s:tempname = $NVIM_LISTEN_ADDRESS
else
  let s:tempname = tempname()
  if s:is_win
    let $NVIM_LISTEN_ADDRESS = '\\?\pipe\'.s:tempname
  else
    let $NVIM_LISTEN_ADDRESS = s:tempname
  endif
endif

if get(g:, 'coc_node_rpc_debug', 0)
  call ch_logfile(s:logfile, 'w')
endif

function! s:on_error(channel, msg)
  echohl Error | echom '[vim-node-rpc] rpc error: ' .a:msg | echohl None
endfunction

function! s:on_notify(channel, result)
  let [event, data] = a:result
  if event ==# 'ready'
    doautocmd User NvimRpcInit
  elseif event ==# 'connect'
    call add(s:clientIds, data)
  elseif event ==# 'disconnect'
    call filter(s:clientIds, 'v:val == '.data)
  else
    echo 'notification:'. json_encode(a:result)
  endif
endfunction

function! s:on_exit(channel)
  let s:channel = v:null
  doautocmd User NvimRpcExit
endfunction

function! nvim#rpc#get_command() abort
  if !filereadable(s:script)
    echohl Error | echon '[vim-node-rpc] script file not found!' | echohl None
    return ''
  endif
  return ['node', s:script]
endfunction

function! nvim#rpc#start_server() abort
  if !empty(s:channel)
    let state = ch_status(s:channel)
    if state ==# 'open' || state ==# 'buffered'
      " running
      return
    endif
  endif
  if !executable('node')
    echohl Error
    echon '[vim-node-rpc] node executable not found on $PATH.'
    echohl None
    return
  endif
  let command = nvim#rpc#get_command()
  if empty(command) | return | endif
  let options = {
        \ 'in_mode': 'json',
        \ 'out_mode': 'json',
        \ 'err_mode': 'nl',
        \ 'callback': function('s:on_notify'),
        \ 'err_cb': function('s:on_error'),
        \ 'close_cb': function('s:on_exit'),
        \ 'timeout': 3000,
        \ 'env': {
        \   'NVIM_LISTEN_ADDRESS': $NVIM_LISTEN_ADDRESS
        \ }
        \}
  if has("patch-8.1.350")
    let options['noblock'] = 1
  endif
  let job = job_start(command, options)
  let s:channel = job_getchannel(job)
  let status = ch_status(job)
  if status !=# 'open' && status !=# 'buffered'
    echohl Error | echon '[vim-node-rpc] failed to start vim-node-rpc service!' | echohl None
    return
  endif
  let info = ch_info(s:channel)
  let data = json_encode([0, ['ready', [info.id]]])
  call ch_sendraw(s:channel, data."\n")
endfunction

function! nvim#rpc#request(clientId, method, ...) abort
  if !nvim#rpc#check_client(a:clientId)
    return
  endif
  let args = get(a:, 1, [])
  let res = ch_evalexpr(s:channel, [a:clientId, a:method, args], {'timeout': 5000})
  if type(res) == 1 && res ==# '' | return '' | endif
  let [l:errmsg, res] =  res
  if l:errmsg
    echohl Error | echon '[rpc.vim] client error: '.l:errmsg | echohl None
  else
    return res
  endif
endfunction

function! nvim#rpc#notify(clientId, method, ...) abort
  if empty(s:channel) | return | endif
  let args = get(a:000, 0, [])
  " use 0 as vim request id
  let data = json_encode([0, [a:clientId, a:method, args]])
  call ch_sendraw(s:channel, data."\n")
endfunction

function! nvim#rpc#open_log()
  execute 'vs '.s:logfile
endfunction

function! nvim#rpc#check_client(clientId)
  if empty(s:channel) | return 0 | endif
  return index(s:clientIds, a:clientId) >= 0
endfunction

function! nvim#rpc#install_node_rpc(...) abort
  let prompt = get(a:, 1, 1)
  if prompt
    let res = input('[vim-node-rpc] vim-node-rpc module not found, install? [y/n]')
    if res !=? 'y' | return 0 | endif
  endif
  let cmd = ''
  let idx = inputlist(['Select package manager:', '1. npm', '2. yarn'])
  if idx <= 0 | return 0 | endif
  if idx == 1
    let isLinux = !s:is_win && substitute(system('uname'), '\n', '', '') ==# 'Linux'
    if executable('npm')
      let cmd = (isLinux ? 'sudo ' : ' ').'npm i -g vim-node-rpc'
    else
      echohl Error | echon '[vim-node-rpc] executable "npm" not find in $PATH' | echohl None
      return 0
    endif
  else
    if executable('yarn')
      let cmd = 'yarn global add vim-node-rpc'
    else
      echohl Error | echon '[vim-node-rpc] executable "yarn" not find in $PATH' | echohl None
      return 0
    endif
  endif
  execute '!'.cmd
  return v:shell_error == 0
endfunction
