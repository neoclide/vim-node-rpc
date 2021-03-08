let s:root = expand('<sfile>:h')

function! s:NodeStart()
  let script = s:root.'/bin/server.js'
  
  call neovim_rpc#jobstart(['node', script], {})
endfunction

function! RequestA()
  call neovim_rpc#rpcrequest(g:channel_id, 'test', 100)
endfunction

function! RequestB()
  call neovim_rpc#rpcrequest(g:channel_id, 'test', 1024)
endfunction

function! RequestC()
  call neovim_rpc#rpcrequest(g:channel_id, 'test', 10240)
endfunction

function! RequestD()
  call neovim_rpc#rpcrequest(g:channel_id, 'test', 102400)
endfunction

function! RequestE()
  call neovim_rpc#rpcrequest(g:channel_id, 'test', 1024000)
endfunction

function! s:on_stderr(channel, message)
  echohl Error | echon a:message | echohl None
endfunction

execute 'set rtp+=$HOME/.vim/bundle/vim-hug-neovim-rpc'
let address = neovim_rpc#serveraddr()
let parts = split(address, ':')
let $NVIM_LISTEN_PORT = parts[1]

call timer_start(100, { -> s:NodeStart()})

function! s:Start()
  profile start ~/result

  let range = ['A', 'B', 'C', 'D', 'E']
  for i in range
    execute 'profile func Request'.i
  endfor
  for i in range
    echom i
    for j in range(1000)
      call call('Request'.i, [])
    endfor
  endfor
  echom 'done'
endfunction

augroup Test
  autocmd!
  "autocmd user ServerInit call s:Start()
augroup end

function! CreateData(count)
  let res = ''
  for i in range(a:count)
    let res = res.'a'
  endfor
  return res
endfunction
