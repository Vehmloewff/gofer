import { dtils, pathUtils } from './deps.ts'
import { parsePackageName } from './package.ts'
import { PackageName } from './package.ts'

export class BinOwners {
	#packagesDir: string
	#data: Record<string, string>

	static async open(packagesDir: string): Promise<BinOwners> {
		const data = await dtils.readJson(pathUtils.join(packagesDir, 'bin_owners.json')) || {}

		return new this(packagesDir, data)
	}

	constructor(packagesDir: string, data: Record<string, string>) {
		this.#packagesDir = packagesDir
		this.#data = data
	}

	getOwner(binName: string): PackageName | null {
		const ownerString = this.#data[binName]
		if (!ownerString) return null

		return parsePackageName(ownerString)
	}

	hasName(binName: string): boolean {
		return !!this.#data[binName]
	}

	getBinNames(owner: PackageName): string[] {
		const names: string[] = []

		for (const name in this.#data) {
			if (owner.normalized === this.#data[name]) names.push(name)
		}

		return names
	}

	async registerBins(binNames: string[], owner: PackageName): Promise<void> {
		for (const name of binNames) this.#data[name] = owner.normalized

		await this.#save()
	}

	async removeBins(binNames: string[]): Promise<void> {
		for (const name of binNames) delete this.#data[name]

		await this.#save()
	}

	async #save() {
		await dtils.writeJson(pathUtils.join(this.#packagesDir, 'bin_owners.json'), this.#data)
	}
}
