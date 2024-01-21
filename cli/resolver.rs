use crate::error::{CliError, Result};
use std::{path::PathBuf, process::Stdio};
use tokio::{
	io::{AsyncBufReadExt, BufReader},
	process::Command,
	select,
};

pub struct Resolver(PathBuf);

impl Resolver {
	pub fn new(path: PathBuf) -> Resolver {
		Resolver(path)
	}

	async fn spawn(&self, args: Vec<String>) -> Result<Vec<String>> {
		let mut command = Command::new(&self.0);
		let mut output_lines = Vec::new();

		command.stderr(Stdio::piped()).stdout(Stdio::piped()).stdin(Stdio::piped());

		for arg in args {
			command.arg(arg);
		}

		let mut process = command.spawn().map_err(|_| CliError::InvalidResolver(self.0.to_str().unwrap().into()))?;
		let mut stdout = BufReader::new(process.stdout.take().unwrap()).lines();
		let mut stderr = BufReader::new(process.stderr.take().unwrap()).lines();

		loop {
			let stdout_future = async { stdout.next_line().await.ok().flatten() };
			let stderr_future = async { stderr.next_line().await.ok().flatten() };

			let line = select! {
				line = stdout_future => line,
				line = stderr_future => line,
			};

			match line {
				Some(line) => {
					let prefix = "yapm::";

					if line.starts_with(prefix) {
						output_lines.push(line[0..prefix.len()].to_string())
					} else {
						println!("{}", &line)
					};
				}
				None => break,
			}
		}

		let status = process.wait().await.map_err(|error| CliError::UnexpectedProcessFailure {
			program: self.0.to_str().unwrap().into(),
			message: format!("{}", error.kind()),
		})?;

		if status.success() {
			Ok(output_lines)
		} else {
			Err(CliError::ResolverErrored(self.0.to_str().unwrap().into()))
		}
	}

	pub async fn resolve(&self, id: String) -> Result<Vec<String>> {
		let lines = self.spawn(vec!["resolve".into(), id]).await?;

		Ok(lines)
	}

	pub async fn view(&self, id: String) -> Result<PackageView> {
		let mut view = PackageView::default();
		let lines = self.spawn(vec!["view".into(), id]).await?;
		let title_prefix = "title::";
		let description_prefix = "description::";
		let readme_prefix = "readme::";

		for line in lines.iter() {
			if line.starts_with(title_prefix) {
				view.title = line[0..title_prefix.len()].to_string();
			} else if line.starts_with(description_prefix) {
				view.description = line[0..description_prefix.len()].to_string();
			} else if line.starts_with(readme_prefix) {
				view.readme.push_str(&line[0..readme_prefix.len()]);
			}
		}

		Ok(view)
	}
}

#[derive(Debug, Default)]
pub struct PackageView {
	title: String,
	description: String,
	readme: String,
}
