export interface Section {
  title: string;
  bullets: string[];
}

export function deduplicateSections(sections: Section[], threshold = 0.6): Section[] {
  const kept: string[] = [];
  const result: Section[] = [];

  for (const section of sections) {
    const unique: string[] = [];
    for (const bullet of section.bullets) {
      let isDup = false;
      for (const k of kept) {
        if (computeSimilarity(bullet, k) >= threshold) {
          isDup = true;
          break;
        }
      }
      if (!isDup) {
        unique.push(bullet);
        kept.push(bullet);
      }
    }
    if (unique.length > 0) {
      result.push({ title: section.title, bullets: unique });
    }
  }

  return result;
}

function computeSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const lcs = longestCommonSubstring(a, b);
  return lcs / Math.max(a.length, b.length);
}

function longestCommonSubstring(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  let maxLen = 0;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1;
        maxLen = Math.max(maxLen, dp[i]![j]!);
      }
    }
  }

  return maxLen;
}
