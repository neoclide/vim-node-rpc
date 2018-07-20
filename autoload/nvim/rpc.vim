scriptencoding utf-8
let s:save_cpo = &cpo
set cpo&vim

let s:script = expand('<sfile>:h:h:h').'/lib/index.js'
let s:channel = v:null
" used for socket path
call delete('/tmp/nvim')
let s:tempname = '/tmp/nvim'

function! s:on_error(channel, msg)
  echohl Error | echom a:msg | echohl None
endfunction

let s:start = 0

function! s:on_notify(channel, result)
  if a:result ==# 'ready'
    call system('echo "'.s:tempname.'" | pbcopy')
    echo s:tempname
  endif
endfunction

function! nvim#rpc#start_server()
  let s:start = reltime()
  let job = job_start('node '.s:script, {
        \ 'in_mode': 'json',
        \ 'out_mode': 'json',
        \ 'err_mode': 'nl',
        \ 'callback': function('s:on_notify'),
        \ 'err_cb': function('s:on_error'),
        \ 'timeout': 3000
        \})
  let s:channel = job_getchannel(job)
  " send channel id to backend
  let info = ch_info(s:channel)
  let fns = nvim#api#func_names()
  let data = json_encode([0, ['ready', [info.id, fns, s:tempname]]])
  call ch_sendraw(s:channel, data."\n")
endfunction

function! nvim#rpc#request(method, ...) abort
  let args = get(a:, 1, [])
  return ch_evalexpr(s:channel, [a:method, args])
endfunction

function! nvim#rpc#notify(method, ...) abort
  " use 0 as vim request id
  let args = get(a:, 1, [])
  let data = json_encode([0, [a:method, args]])
  call ch_sendraw(s:channel, data."\n")
endfunction

let &cpo = s:save_cpo
unlet s:save_cpo
