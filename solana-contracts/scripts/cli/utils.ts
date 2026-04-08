import { spawn } from "bun";
import { createInterface, Interface } from "readline";

let rl: Interface | null = null;

export function initReadline(): Interface {
  if (!rl) {
    rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }
  return rl;
}

export function closeReadline(): void {
  if (rl) {
    rl.close();
    rl = null;
  }
}

export function question(prompt: string): Promise<string> {
  const readline = initReadline();
  return new Promise((resolve) => {
    readline.question(prompt, (answer) => {
      resolve(answer.trim());
    });
  });
}

export async function selectOption(prompt: string, options: string[]): Promise<number> {
  console.log(`\n${prompt}`);
  options.forEach((opt, i) => console.log(`  ${i + 1}. ${opt}`));

  while (true) {
    const answer = await question(`\nSelect (1-${options.length}): `);
    const num = parseInt(answer);
    if (num >= 1 && num <= options.length) {
      return num - 1;
    }
    console.log("Invalid selection. Please try again.");
  }
}

export async function runCommand(
  command: string,
  args: string[]
): Promise<{ success: boolean; output: string }> {
  console.log(`\n> ${command} ${args.join(" ")}\n`);

  const proc = spawn({
    cmd: [command, ...args],
    stdout: "pipe",
    stderr: "pipe",
    env: process.env,
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  if (stdout) console.log(stdout);
  if (stderr) console.error(stderr);

  return { success: exitCode === 0, output: stdout + stderr };
}
