#! /bin/bash

if ! [ -x "$(command -v node)" ]; then
  echo 'node not found.' >&2
  exit 1
fi

if ! [ -x "$(command -v yarn)" ]; then
  echo 'yarn not found.' >&2
  exit 1
fi

if [ ! -f ./lib/index.js ]; then
  echo 'Running yarn install'
  yarn install
fi

vim -S mini.vim
