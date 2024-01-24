export type Os = 'darwin' | 'linux' | 'android' | 'windows' | 'freebsd' | 'netbsd' | 'aix' | 'solaris' | 'illumos'
export type Architecture = 'x86_64' | 'aarch64'

interface ItemRatings {
	id: string
	isSpecial: boolean
	osRating: number
	archRating: number
}

export class OsTargetMatcher {
	#expectedOs: Os
	#expectedArch: Architecture
	#items: ItemRatings[] = []

	constructor(os: Os, arch: Architecture) {
		this.#expectedOs = os
		this.#expectedArch = arch
	}

	match(id: string, rawName: string): void {
		const name = rawName.toLowerCase()

		this.#items.push({
			id,
			isSpecial: isNameSpecial(name),
			archRating: getArchScore(this.#expectedArch, name),
			osRating: getOsScore(this.#expectedOs, name),
		})
	}

	getHighestRanked(allowSpecial = false): string | null {
		let highestScore = 0
		let highestScoreHolder: string | null = null

		for (const ranking of this.#items) {
			if (!allowSpecial && ranking.isSpecial) continue

			const totalScore = ranking.archRating + ranking.osRating
			if (totalScore < highestScore) continue

			highestScore = totalScore
			highestScoreHolder = ranking.id
		}

		return highestScoreHolder
	}
}

function getArchScore(expectedArch: Architecture, name: string) {
	if (expectedArch === 'aarch64') return countManyInstances(['64', 'arm', 'aarch'], name)
	if (expectedArch === 'x86_64') return countManyInstances(['x64', 'x86_64', 'amd', 'intel', '86'], name)

	throw new Error(`unknown arch, "${expectedArch}"`)
}

function getOsScore(expectedOs: Os, name: string) {
	if (expectedOs === 'darwin') return countManyInstances(['mac', 'apple', 'darwin'], name)

	return countInstances(expectedOs, name)
}

function isNameSpecial(name: string) {
	const sections = name.split('.')
	const extension = sections[sections.length - 1]

	if (!extension || extension === 'zip' || extension === 'tar' || extension === 'gz') return false

	return true
}

function countManyInstances(needles: string[], haystack: string) {
	let instances = 0

	for (const needle of needles) instances += countInstances(needle, haystack)

	return instances
}

function countInstances(needle: string, haystack: string) {
	let lastEnding = 0
	let instances = 0

	while (true) {
		const index = haystack.indexOf(needle, lastEnding)
		if (index === -1) break

		instances++
		lastEnding = index + needle.length
	}

	return instances
}
