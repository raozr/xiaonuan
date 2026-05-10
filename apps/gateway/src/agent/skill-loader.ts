import { readFile } from 'fs/promises';
import { join } from 'path';

export interface Skill {
  name: string;
  description: string;
  phase: string[];
  priority: string;
  content: string;
}

const SKILLS_DIR = join(process.cwd(), '..', '..', 'packages', 'skills');

const SKILL_FILES: Record<string, string> = {
  'companion-persona': join(SKILLS_DIR, 'companion-persona', 'SKILL.md'),
  'memory-protocol': join(SKILLS_DIR, 'memory-protocol', 'SKILL.md'),
  'conversation-strategy': join(SKILLS_DIR, 'conversation-strategy', 'SKILL.md'),
  'conversation-flow': join(SKILLS_DIR, 'conversation-flow', 'SKILL.md'),
  'greeting-protocol': join(SKILLS_DIR, 'greeting-protocol', 'SKILL.md'),
};

function parseFrontmatter(raw: string): Record<string, string> {
  const meta: Record<string, string> = {};
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return meta;
  const fmBody = match[1];
  if (fmBody) {
    fmBody.split('\n').forEach((line) => {
      const [key, ...rest] = line.split(':');
      if (key && rest.length) {
        meta[key.trim()] = rest.join(':').trim();
      }
    });
  }
  return meta;
}

export async function loadSkill(name: string): Promise<Skill | null> {
  const path = SKILL_FILES[name];
  if (!path) return null;

  try {
    const raw = await readFile(path, 'utf-8');
    const meta = parseFrontmatter(raw);
    const content = raw.replace(/^---\n[\s\S]*?\n---\n/, '').trim();

    return {
      name,
      description: meta.description || '',
      phase: (meta.phase || 'all')
        .split(/,\s*/)
        .map((p) => p.trim().toLowerCase()),
      priority: meta.priority || '',
      content,
    };
  } catch {
    return null;
  }
}

export async function loadSkillsForPhase(phase: string): Promise<Skill[]> {
  const skills: Skill[] = [];

  for (const name of Object.keys(SKILL_FILES)) {
    const skill = await loadSkill(name);
    if (!skill) continue;
    if (skill.phase.includes('all') || skill.phase.includes(phase.toLowerCase())) {
      skills.push(skill);
    }
  }

  return skills;
}
