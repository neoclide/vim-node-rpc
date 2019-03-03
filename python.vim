set nocompatible

let s:root = expand('<sfile>:h')
"let g:nvim_node_rpc_debug = 1
execute 'set rtp+='.fnameescape(s:root)
call nvim#rpc#start_server()

function! s:PythonStart()
  terminal python
  let job = term_getjob("")
  let channel = job_getchannel(job)
  sleep 100m
  let list = [
        \ "from neovim import attach",
        \ "nvim = attach('socket', path='".$NVIM_LISTEN_ADDRESS."')",
        \ "buffer = nvim.buffers[1]"
        \]
  call ch_sendraw(channel, join(list, "\n"))
endfunction

function! s:on_stderr(channel, message)
  echohl Error | echon a:message | echohl None
endfunction

augroup Test
  autocmd!
  autocmd User NvimRpcInit call s:PythonStart()
augroup end

command! -nargs=? Openlog :call nvim#rpc#open_log()
