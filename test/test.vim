func MyHandler(channel, msg)
  echom "from the handler: " . a:msg
endfunc
call ch_logfile('/tmp/vim.log', 'W')
let channel = ch_open('localhost:8088', {'callback': "MyHandler"})

let info = ch_info(channel)
let data = json_encode([0, 'channelId', info.id])
" send channel id

"
"let job = job_start(command, {
"    \ 'in_mode': 'json',
"    \ 'out_mode': 'json',
"    \ 'err_mode': 'nl',
"    \ 'timeout': 3000
"    \})
"let channel = job_getchannel(job)
