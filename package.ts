import { pathUtils } from './deps.ts'
import { linkBinFiles, removeBinFiles } from './link_bin.ts'
import { BinOwners } from './bin_owners.ts'
import { selectHost } from './host.ts'
import { saveToDisk } from './disk.ts'

export interface PackageParams {
	packageName: PackageName
	packagesDir: string
	binOwners: BinOwners
}

export interface InstallPackageParams extends PackageParams {
	binFiles: string[]
	binNames: string[]
}

export async function installPackage(params: InstallPackageParams): Promise<void> {
	const host = selectHost(params.packageName)
	if (!host) throw new Error(`no known hosts, "${params.packageName.host}"`)

	const version = params.packageName.version || await host.getLatestVersion(params.packageName)
	if (!version) throw new Error(`no versions have been published for package, "${params.packageName.normalized}"`)

	const { stream, name } = await host.download(params.packageName, version)
	await saveToDisk(stream, name, pathUtils.join(params.packagesDir, 'src', params.packageName.normalized))

	await linkBinFiles({
		binFiles: params.binFiles,
		names: params.binNames,
		binOwners: params.binOwners,
		packageName: params.packageName,
		packagesDir: params.packagesDir,
		async removeFn() {
			await removePackage(params)
		},
	})
}

export async function removePackage(params: PackageParams): Promise<void> {
	const packageDir = pathUtils.join(params.packagesDir, 'src', params.packageName.normalized)
	const binOwners = await BinOwners.open(params.packagesDir)

	await removeBinFiles({ binOwners, packageName: params.packageName })
	await Deno.remove(packageDir, { recursive: true })
}

export interface PackageName {
	host: string
	sections: string[]
	normalized: string
	version: string | null
}

export function parsePackageName(name: string): PackageName {
	const sections = name.split('/').filter((section) => section.length)
	if (sections.length < 2) throw new Error(`Invalid name, "${name}". Expected at least two sections of length separated by a slash`)

	const lastSection = sections[sections.length - 1]
	const version = lastSection.split('@')[1] || null

	return {
		host: sections[0],
		sections: sections.slice(1),
		normalized: `${sections[0]}/${sections.slice(1).join('/')}`,
		version,
	}
}
