import * as fs from 'fs'
import * as path from 'path'
import * as pkgDir from 'pkg-dir'
import * as readPkg from 'read-pkg'
import getConf from '../getConf'
import getScript from './getScript'
import { isGhooks, isHusky, isPreCommit } from './is'

const hookList = [
  'applypatch-msg',
  'pre-applypatch',
  'post-applypatch',
  'pre-commit',
  'prepare-commit-msg',
  'commit-msg',
  'post-commit',
  'pre-rebase',
  'post-checkout',
  'post-merge',
  'pre-push',
  'pre-receive',
  'update',
  'post-receive',
  'post-update',
  'push-to-checkout',
  'pre-auto-gc',
  'post-rewrite',
  'sendemail-validate'
]

function writeHook(filename: string, script: string) {
  fs.writeFileSync(filename, script, 'utf-8')
  fs.chmodSync(filename, parseInt('0755', 8))
}

function createHook(filename: string, script: string) {
  // Get name, used for logging
  const name = path.basename(filename)

  // Check if hook exist
  if (fs.existsSync(filename)) {
    const hook = fs.readFileSync(filename, 'utf-8')

    // Migrate
    if (isGhooks(hook)) {
      console.log(`migrating existing ghooks script: ${name}`)
      return writeHook(filename, script)
    }

    // Migrate
    if (isPreCommit(hook)) {
      console.log(`migrating existing pre-commit script: ${name}`)
      return writeHook(filename, script)
    }

    // Update
    if (isHusky(hook)) {
      return writeHook(filename, script)
    }

    // Skip
    console.log(`skipping existing user hook: ${name}`)
    return
  }

  // Create hook if it doesn't exist
  writeHook(filename, script)
}

function createHooks(filenames: string[], script: string) {
  filenames.forEach(filename => createHook(filename, script))
}

function canRemove(filename: string): boolean {
  if (fs.existsSync(filename)) {
    const data = fs.readFileSync(filename, 'utf-8')
    return isHusky(data)
  }

  return false
}

function removeHook(filename: string) {
  fs.unlinkSync(filename)
}

function removeHooks(filenames: string[]) {
  filenames.filter(canRemove).forEach(removeHook)
}

function getHooks(gitDir: string): string[] {
  const gitHooksDir = path.join(gitDir, 'hooks')
  return hookList.map(hookName => path.join(gitHooksDir, hookName))
}

export function install(gitDir: string, huskyDir: string, isCI: boolean) {
  console.log('husky > setting up git hooks')
  const userDir = pkgDir.sync(path.join(huskyDir, '..'))
  const conf = getConf(userDir)

  if (process.env.HUSKY_SKIP_INSTALL === 'true') {
    console.log(
      "HUSKY_SKIP_INSTALL environment variable is set to 'true',",
      'skipping Git hooks installation.'
    )
    return
  }

  if (isCI && conf.skipCI) {
    console.log('CI detected, skipping Git hooks installation.')
    return
  }

  if (userDir === null) {
    console.log("Can't find package.json, skipping Git hooks installation.")
    return
  }

  if (path.join(userDir, '.git') !== gitDir) {
    console.log(
      `Expecting package.json to be at the same level as .git, skipping Git hooks installation.`
    )
    console.log(`gitDir: ${gitDir}`)
    console.log(`userDir: ${userDir}`)
    return
  }

  if (!fs.existsSync(path.join(userDir, '.git/hooks'))) {
    console.log(
      "Can't find .git/hooks directory. You can try to fix this error by creating it manually."
    )
    console.log('Skipping Git hooks installation.')
    return
  }

  // Create hooks
  const hooks = getHooks(gitDir)
  const script = getScript(userDir)
  createHooks(hooks, script)

  console.log(`husky > done`)
}

export function uninstall(gitDir: string, huskyDir: string) {
  console.log('husky > uninstalling git hooks')
  const userDir = pkgDir.sync(path.join(huskyDir, '..'))

  if (path.join(userDir, '.git') === gitDir) {
    // Remove hooks
    const hooks = getHooks(gitDir)
    removeHooks(hooks)
  }

  console.log('husky > done')
}
