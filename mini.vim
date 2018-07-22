let s:root = expand('<sfile>:h')
let g:nvim_node_rpc_debug = 1

augroup rpc_ready
  autocmd!
  autocmd User NvimRpcReady call s:PythonStart()
augroup end

function! s:PythonStart()
  terminal python
  let job = term_getjob("")
  let channel = job_getchannel(job)
  call ch_sendraw(channel, "from neovim import attach\n")
  call ch_sendraw(channel, "nvim = attach('socket', path='/tmp/vim-rpc')\n")
  call ch_sendraw(channel, "buffer = nvim.buffers[1]\n")
endfunction

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

function! s:on_stderr(channel, message)
  echohl Error | echon a:message | echohl None
endfunction

command! -nargs=? Openlog :call nvim#rpc#open_log()
execute 'set rtp+='.fnameescape(s:root)
call nvim#rpc#start_server()
