import { BinOwners } from './bin_owners.ts'
import { pathUtils } from './deps.ts'
import { installPackage, parsePackageName, removePackage } from './package.ts'

export interface GoferOptions {
	packagesDir?: string
}

export interface GoferInstallOptions extends GoferOptions {
	binFiles?: string[]
	binNames?: string[]
}

export async function install(name: string, options: GoferInstallOptions = {}): Promise<void> {
	const packagesDir = options.packagesDir || getDefaultPackagesDir()
	const binOwners = await BinOwners.open(packagesDir)
	const packageName = parsePackageName(name)
	const binFiles = options.binFiles || []
	const binNames = options.binNames || []

	await installPackage({ binOwners, packageName, packagesDir, binFiles, binNames })
}

export async function remove(name: string, options: GoferOptions = {}): Promise<void> {
	const packagesDir = options.packagesDir || getDefaultPackagesDir()
	const binOwners = await BinOwners.open(packagesDir)
	const packageName = parsePackageName(name)

	await removePackage({ binOwners, packageName, packagesDir })
}

function getDefaultPackagesDir() {
	const home = Deno.env.get('HOME')
	if (!home) throw new Error("Couldn't detect user HOME")

	return pathUtils.join(home, 'Packages')
}
