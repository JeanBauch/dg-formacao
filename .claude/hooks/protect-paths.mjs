#!/usr/bin/env node
// PreToolUse (Edit|Write|NotebookEdit) hook: secrets, lockfiles and node_modules are never edited by hand.
// Lockfiles change only through the package manager (`pnpm add/remove/install`).
// Rule files (CLAUDE.md, AGENTS.md, CODING_STANDARDS.md, .claude/**) are a separate layer: on a ticket
// branch (feat/*, fix/*) they are read-only, so an implementer never rewrites its own rules mid-ticket.
// They change on retro branches (chore/*), reviewed by the human.
import { spawnSync } from 'node:child_process'
import { existsSync, realpathSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { gitRoot, readStdinJson } from './lib.mjs'

const ENV_FILE = /^\.env(\..+)?$/
const ENV_ALLOWED = new Set(['.env.example'])
const LOCKFILES = new Set(['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock', 'bun.lock', 'bun.lockb', 'npm-shrinkwrap.json'])
const RULE_FILES = new Set(['CLAUDE.md', 'AGENTS.md', 'CODING_STANDARDS.md'])
const TICKET_BRANCH = /^(feat|fix)\//

export function blockReason(filePath) {
  const normalized = filePath.replace(/\\/g, '/')
  if (/(^|\/)node_modules\//.test(normalized))
    return 'installed packages are shared with the global pnpm store; if a package looks corrupted, stop and tell the user instead of patching it'
  const name = basename(normalized)
  if (ENV_FILE.test(name) && !ENV_ALLOWED.has(name)) return `${name} may hold secrets; edit .env.example and ask the user to update their env file`
  if (LOCKFILES.has(name)) return `${name} is generated; change dependencies with the package manager instead`
  return null
}

/**
 * The canonical spelling of a path that may not exist yet (a Write creating a file): the real path of its
 * nearest existing ancestor plus the rest. This unifies Windows 8.3 short names (RUNNER~1), links and
 * drive-letter case, which `git rev-parse --show-toplevel` never returns.
 */
function canonical(path) {
  let head = resolve(path)
  const rest = []
  while (!existsSync(head)) {
    const parent = dirname(head)
    if (parent === head) return resolve(path)
    rest.unshift(basename(head))
    head = parent
  }
  return join(realpathSync.native(head), ...rest)
}

/** Why a rule file may not change here, or null. `filePath` is resolved against `cwd`. */
export function ruleLayerReason(filePath, cwd) {
  const root = gitRoot(cwd)
  if (!root) return null
  const rel = relative(canonical(root), canonical(resolve(cwd, filePath))).replace(/\\/g, '/')
  if (rel.startsWith('../') || isAbsolute(rel)) return null
  const isRule = RULE_FILES.has(basename(rel)) || /(^|\/)\.claude\//.test(rel)
  if (!isRule) return null
  const branch = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim()
  if (!TICKET_BRANCH.test(branch)) return null
  return `rule files are read-only on ticket branch ${branch}; comment NEEDS-DECISION: on the ticket with the rule change, and the human applies it in /retro`
}

const input = await readStdinJson()
const filePath = input.tool_input?.file_path ?? input.tool_input?.notebook_path
if (typeof filePath === 'string') {
  const reason = blockReason(filePath) ?? ruleLayerReason(filePath, input.cwd ?? process.cwd())
  if (reason) {
    process.stderr.write(`protect-paths: blocked edit to ${filePath}: ${reason}.\n`)
    process.exit(2)
  }
}
process.exit(0)
