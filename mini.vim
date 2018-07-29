let s:root = expand('<sfile>:h')
"let g:nvim_node_rpc_debug = 1

"function! s:PythonStart()
"  terminal python
"  let job = term_getjob("")
"  let channel = job_getchannel(job)
"  call ch_sendraw(channel, "from neovim import attach\n")
"  call ch_sendraw(channel, "nvim = attach('socket', path='/tmp/vim-rpc')\n")
"  call ch_sendraw(channel, "buffer = nvim.buffers[1]\n")
"endfunction

function! s:NodeStart()
  let script = s:root.'/bin/server.js'
  call job_start(['node', script], {
        \ 'in_io': 'null',
        \ 'err_cb': function('s:on_stderr'),
        \ 'env': {
        \   'NVIM_LISTEN_ADDRESS': $NVIM_LISTEN_ADDRESS
        \ }
        \})
endfunction

function! RequestA()
  call nvim#rpc#request(g:channel_id, 'test', [100])
endfunction

function! RequestB()
  call nvim#rpc#request(g:channel_id, 'test', [1024])
endfunction

function! RequestC()
  call nvim#rpc#request(g:channel_id, 'test', [10240])
endfunction

function! RequestD()
  call nvim#rpc#request(g:channel_id, 'test', [102400])
endfunction

function! RequestE()
  call nvim#rpc#request(g:channel_id, 'test', [1024000])
endfunction

function! s:on_stderr(channel, message)
  echohl Error | echon a:message | echohl None
endfunction

command! -nargs=? Openlog :call nvim#rpc#open_log()
execute 'set rtp+='.fnameescape(s:root)
call nvim#rpc#start_server()

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

"augroup Test
"  autocmd!
"  autocmd user ServerInit call s:Start()
"augroup end

function! CreateData(count)
  let res = ''
  for i in range(a:count)
    let res = res.'a'
  endfor
  return res
endfunction
