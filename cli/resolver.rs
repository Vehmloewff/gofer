use std::{path::PathBuf, process::Stdio};

use tokio::{
	io::{AsyncBufReadExt, AsyncReadExt, BufReader},
	join,
	process::Command,
	select,
};

use crate::error::{CliError, Result};

pub struct Resolver(PathBuf);

impl Resolver {
	pub fn new(path: PathBuf) -> Resolver {
		Resolver(path)
	}

	async fn spawn(&self, args: Vec<String>) -> Result<Vec<String>> {
		let mut command = Command::new(self.0).stderr(Stdio::piped()).stdout(Stdio::piped()).stdin(Stdio::piped());
		let mut output_lines = Vec::new();

		for arg in args {
			command.arg(arg);
		}

		let mut process = command.spawn().map_err(|_| CliError::InvalidResolver(self.0.to_str().unwrap().into()))?;
		let mut stdout = BufReader::new(process.stdout.take().unwrap()).lines();
		let mut stderr = BufReader::new(process.stderr.take().unwrap()).lines();

		loop {
			select! {
				line = stdout.next_line()=> {
					output_lines.push(line)
				},
				line = stderr.next_line() => {
					output_lines.push(line)
				}
			};
		}
	}
}
