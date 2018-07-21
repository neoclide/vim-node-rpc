scriptencoding utf-8
let s:save_cpo = &cpo
set cpo&vim

let root = expand('<sfile>:h')
execute 'set rtp+='.fnameescape(root)

let s:logfile = tempname()
call ch_logfile(s:logfile, 'w')

call nvim#rpc#start_server()

terminal python

let job = term_getjob("")
let channel = job_getchannel(job)
" wait for server start
sleep 200m
call ch_sendraw(channel, "from neovim import attach\n")
call ch_sendraw(channel, "nvim = attach('socket', path='/tmp/vim-rpc')\n")
call ch_sendraw(channel, "buffer = nvim.buffers[1]\n")

command! -nargs=? Openlog :execute 'edit '.s:logfile

let &cpo = s:save_cpo
unlet s:save_cpo
