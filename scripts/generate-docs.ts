import fs from 'fs';
import path from 'path';
import { createProgram } from '../src/cli';

interface Section {
  title: string;
  help: string;
}

function renderSection(section: Section): string {
  return [`## ${section.title}`, '', '```text', section.help.trimEnd(), '```', ''].join('\n');
}

function main(): void {
  const program = createProgram();
  const sections: Section[] = [];

  sections.push({
    title: program.name(),
    help: program.helpInformation(),
  });

  for (const command of program.commands) {
    sections.push({
      title: `${program.name()} ${command.name()}`,
      help: command.helpInformation(),
    });
  }

  const content = [
    '# CLI Reference',
    '',
    'Generated from `--help` output. Do not edit by hand.',
    '',
    ...sections.map(renderSection),
  ].join('\n');

  const docsPath = path.resolve(__dirname, '..', 'docs', 'cli.md');
  fs.writeFileSync(docsPath, content);
  process.stdout.write(`Wrote ${path.relative(process.cwd(), docsPath)}\n`);
}

main();
