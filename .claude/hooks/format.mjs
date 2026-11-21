#!/usr/bin/env node
// PostToolUse (Edit|Write) hook: formats the edited file with the project's Prettier. Never blocks.
// Files outside the project (a scratchpad script, another repository) are left alone.
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { gitRoot, localBin, readStdinJson, runNode } from './lib.mjs'

const FORMATTABLE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs|json|css|scss|md|mdx|yml|yaml|html)$/

const insideRoot = (root, file) => {
  const rel = relative(root, resolve(root, file))
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
}

const input = await readStdinJson()
const filePath = input.tool_input?.file_path
if (typeof filePath === 'string' && FORMATTABLE.test(filePath)) {
  const root = gitRoot(input.cwd ?? dirname(filePath)) ?? input.cwd
  const prettier = root && insideRoot(root, filePath) ? localBin(root, 'prettier', 'bin', 'prettier.cjs') : null
  if (prettier) runNode(prettier, ['--write', '--ignore-unknown', filePath], root, 60_000)
}
process.exit(0)
