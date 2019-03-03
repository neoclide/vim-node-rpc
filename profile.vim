set nocompatible

let s:root = expand('<sfile>:h')
"let g:nvim_node_rpc_debug = 1
execute 'set rtp+='.fnameescape(s:root)
call nvim#rpc#start_server()

function! RequestA()
  call nvim#rpc#request(g:channel_id, 'test', [100])
endfunction

" 1kb
function! RequestB()
  call nvim#rpc#request(g:channel_id, 'test', [1024])
endfunction

" 10kb
function! RequestC()
  call nvim#rpc#request(g:channel_id, 'test', [10240])
endfunction

" 100kb
function! RequestD()
  call nvim#rpc#request(g:channel_id, 'test', [102400])
endfunction

" 1M
function! RequestE()
  call nvim#rpc#request(g:channel_id, 'test', [1024000])
endfunction

function! s:on_stderr(channel, message)
  echohl Error | echon a:message | echohl None
endfunction

function! s:NodeStart()
  let script = s:root.'/bin/server.js'
  call job_start(['node', script], {
        \ 'in_io': 'null',
        \ 'err_cb': function('s:on_stderr'),
        \ 'env': {
        \   'VIM_RPC_LOG_LEVEL': 'info',
        \   'NVIM_LISTEN_ADDRESS': $NVIM_LISTEN_ADDRESS
        \ }
        \})
endfunction

" profile request server
function! StartProfile()
  let file = s:root . '/profile'
  exe 'profile start '.fnameescape(file)
  let range = ['A', 'B', 'C', 'D', 'E']
  for i in range
    execute 'profile func Request'.i
  endfor
  for i in range
    echom i
    for j in range(100)
      call call('Request'.i, [])
    endfor
  endfor
  echom 'done'
endfunction

augroup Test
  autocmd!
  autocmd User NvimRpcInit call s:NodeStart()
augroup end

function! CreateData(count)
  return repeat('a', a:count)
endfunction

command! -nargs=? Openlog :call nvim#rpc#open_log()
