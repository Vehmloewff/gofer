import { BinOwners } from './bin_owners.ts'
import { dtils, pathUtils } from './deps.ts'
import { PackageName } from './package.ts'

async function findBinFiles(directory: string): Promise<string[]> {
	const paths = await dtils.recursiveReadDir(directory)
	const binFiles = []

	for (const path of paths) {
		const isInBinDir = /\/bin\/[a-zA-Z0-9_-]+$/.test(path)

		if (isInBinDir) binFiles.push(path)
	}

	if (binFiles.length) return binFiles

	const largestFile = await getLargestFile(paths)
	if (largestFile) return [largestFile]

	return []
}

async function getLargestFile(paths: string[]) {
	let largestFile: { size: number; name: string } | null = null

	for (const path of paths) {
		const stat = await Deno.stat(path)
		const largestSize = largestFile?.size ?? 0

		if (stat.size > largestSize) largestFile = { size: stat.size, name: path }
	}

	if (!largestFile) return null

	return largestFile.name
}

export interface LinkBinFilesParams {
	binOwners: BinOwners
	packagesDir: string
	packageName: PackageName
	binFiles: string[]
	names: string[]
	removeFn(): Promise<void>
}

export async function linkBinFiles(params: LinkBinFilesParams): Promise<void> {
	const srcDir = pathUtils.join(params.packagesDir, 'src', params.packageName.normalized)
	const binFiles = params.binFiles.length ? params.binFiles : await findBinFiles(srcDir)
	if (!binFiles) throw new Error('No binary files were found')

	const binDir = pathUtils.join(params.packagesDir, 'bin')
	if (!await dtils.exists(binDir)) await Deno.mkdir(binDir, { recursive: true })

	const linkedNames: string[] = []

	for (const binFileIndex in binFiles) {
		const binFile = binFiles[binFileIndex]
		const name = params.names[binFileIndex] || pathUtils.basename(binFile)
		const binLinkedPath = pathUtils.join(binDir, name)

		await Deno.chmod(binFile, 0o777)

		// If we are overwriting an existing binary of a different package, ask the user if he wants to do this
		const owner = params.binOwners.getOwner(name)
		if (owner && owner.normalized !== params.packageName.normalized) {
			const canOverwrite = await askForOverwrite({
				binOwners: params.binOwners,
				name,
				packagesDir: params.packagesDir,
				previousOwner: owner,
				removeFn: params.removeFn,
			})

			if (!canOverwrite) continue
		}

		if (await dtils.exists(binLinkedPath)) await Deno.remove(binLinkedPath)
		await Deno.symlink(binFile, binLinkedPath, { type: 'file' })

		linkedNames.push(name)
	}

	if (!linkedNames.length) console.log('no binary files linked')
	else if (linkedNames.length === 1) console.log(`linked '${linkedNames[0]}'`)
	else console.log(`linked ${linkedNames.map((name) => `'${name}'`).join(', ')}`)

	if (linkedNames.length) {
		params.binOwners.registerBins(linkedNames, params.packageName)
	}
}

export interface RemoveBinFilesParams {
	packagesDir: string
	packageName: PackageName
	binOwners: BinOwners
}

export async function removeBinFiles(params: RemoveBinFilesParams): Promise<void> {
	const names = params.binOwners.getBinNames(params.packageName)
	for (const name of names) await Deno.remove(pathUtils.join(params.packagesDir, 'bin', name)).catch()

	await params.binOwners.removeBins(names)
}

export interface AskForOverwriteParams {
	packagesDir: string
	name: string
	previousOwner: PackageName
	binOwners: BinOwners
	removeFn(): Promise<void>
}

async function askForOverwrite(params: AskForOverwriteParams): Promise<boolean> {
	const response = prompt(
		`Binary "${params.name}" is already provided by package "${params.previousOwner}". [o]verwrite, [u]ninstall, [s]kip:`,
	)

	if (response === 'o') return true
	else if (response === 'u') {
		await params.removeFn()
		return true
	} else if (response === 's') return false
	else {
		console.log('Invalid option. Expected "o", "u", or "s"')
		return await askForOverwrite(params)
	}
}

export function checkBinInPath(packagesDir: string): void {
	const localBinPath = pathUtils.join(packagesDir, 'bin')
	const binPath = pathUtils.isAbsolute(localBinPath) ? localBinPath : pathUtils.join(Deno.cwd(), localBinPath)

	const path = Deno.env.get('PATH')
	if (!path) throw new Error("Couldn't locate PATH env variable")

	const sections = path.split(':')
	const linkedBinPath = !!sections.find((section) => section === binPath)
	if (linkedBinPath) return

	console.log(`It doesn\'t look like ${binPath} is in your PATH.`)
	console.log('To use binaries installed with gofer, add the following to your .profile or similar:')
	console.log(`  export PATH="${binPath}:$PATH"`)
	console.log()
}
