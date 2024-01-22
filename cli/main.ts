import { cliffy, gofer } from './deps.ts'

await new cliffy.Command()
	.name('gofer')
	.version('0.1.0')
	.description('Install packages from popular hosts')
	.action(() => console.error('A command must be specified'))
	.globalOption('-p, --packages-dir <string>', 'The directory where packages are downloaded. Defaults to ~/Packages')
	// Install command
	.command('install', 'Install a package')
	.option(
		'-f, --file <string>',
		'Path to a binary file in the installation that should be linked. Gofer tries to infer these, but will not if this option is specified',
		{ collect: true },
	)
	.option(
		'-n, --name <string>',
		'The name that a certain binary file should be lined under. Applies to the corresponding binary file for the number of times passed. (ie. the binary file specified by the second -f option will be named according to the second -n option',
		{ collect: true },
	)
	.arguments('<package:string>')
	.action(async (params, name) => {
		await gofer.install(name, { binFiles: params.file, binNames: params.name, packagesDir: params.packagesDir })
	})
	// Remove command
	.command('remove <string>', 'Remove an already installed package')
	.action(async (params, name) => {
		await gofer.remove(name, { packagesDir: params.packagesDir })
	})
	.parse(Deno.args)
