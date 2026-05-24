import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

/**
 * Code style enforcement tests based on SPEC-V0.5.md Boundaries:
 * - All API calls through services/api.ts, no raw fetch
 * - NativeWind (className) instead of StyleSheet
 * - Theme constants from theme.ts
 */

function getAllFiles(dir: string, fileList: string[] = []): string[] {
  const files = readdirSync(dir);
  for (const file of files) {
    const filePath = join(dir, file);
    if (statSync(filePath).isDirectory()) {
      if (file !== '__tests__' && file !== 'node_modules' && file !== '.expo') {
        getAllFiles(filePath, fileList);
      }
    } else if (extname(file) === '.tsx' || extname(file) === '.ts') {
      fileList.push(filePath);
    }
  }
  return fileList;
}

describe('Code Style Enforcement', () => {
  const srcDir = join(__dirname, '..');
  const appDir = join(__dirname, '..', '..', 'app');

  describe('No raw StyleSheet imports (SPEC Boundaries)', () => {
    it('should not import StyleSheet from react-native in any component', () => {
      const files = [
        ...getAllFiles(srcDir),
        ...getAllFiles(appDir),
      ].filter(f => !f.includes('hooks/useWebSocket') && !f.includes('hooks/useVoice'));

      const violations: string[] = [];
      for (const file of files) {
        const content = readFileSync(file, 'utf-8');
        if (content.includes('import') && content.includes('StyleSheet') && content.includes('react-native')) {
          violations.push(file.replace(srcDir, 'src').replace(appDir, 'app'));
        }
      }

      expect(violations).toEqual([]);
    });
  });

  describe('No raw fetch outside services/ (SPEC Boundaries)', () => {
    it('should not call fetch() directly outside of services/ directory', () => {
      const srcFiles = getAllFiles(srcDir)
        .filter(f => !f.includes('/services/'))
        .filter(f => !f.includes('__tests__'))
        .filter(f => !f.includes('hooks/useWebSocket') && !f.includes('hooks/useVoice'));

      const appFiles = getAllFiles(appDir).filter(f => !f.includes('__tests__'));
      const files = [...srcFiles, ...appFiles];

      const violations: string[] = [];
      for (const file of files) {
        const content = readFileSync(file, 'utf-8');
        // Match fetch( but not in comments
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.startsWith('//') || line.startsWith('*')) continue;
          if (/\bfetch\s*\(/.test(line)) {
            violations.push(`${file.replace(srcDir, 'src').replace(appDir, 'app')}:${i + 1}`);
          }
        }
      }

      expect(violations).toEqual([]);
    });
  });

  describe('Theme constants usage (SPEC Code Style)', () => {
    it('should export all required color tokens from theme.ts', async () => {
      const { colors } = await import('../utils/theme');

      // SPEC-mandated colors
      expect(colors.surface).toBe('#fcf9f4');
      expect(colors.surfaceLowest).toBe('#ffffff');
      expect(colors.surfaceContainer).toBe('#f0ede9');
      expect(colors.primary).toBe('#8f4e00');
      expect(colors.primaryContainer).toBe('#ff9f43');
      expect(colors.primaryFixed).toBe('#ffdcc2');
      expect(colors.onSurface).toBe('#1c1c19');
      expect(colors.onSurfaceVariant).toBe('#544437');
      expect(colors.error).toBe('#ba1a1a');
      expect(colors.errorContainer).toBe('#ffdad6');
      expect(colors.outline).toBe('#877365');
      expect(colors.outlineVariant).toBe('#dac2b1');
    });

    it('should export touch target sizes per SPEC', async () => {
      const { spacing } = await import('../utils/theme');

      // COMPANIONEE touch target: 64px (default)
      expect(spacing.touchTargetMin).toBe(64);
      // STEWARD touch target: 44px
      expect(spacing.stewardTargetMin).toBe(44);
    });

    it('should export typography scale per SPEC', async () => {
      const { typography } = await import('../utils/theme');

      // display-elderly: 32px/800/40px
      expect(typography.displayElderly.fontSize).toBe(32);
      expect(typography.displayElderly.fontWeight).toBe('800');
      expect(typography.displayElderly.lineHeight).toBe(40);

      // body-lg-elderly: 20px/600/30px
      expect(typography.bodyLgElderly.fontSize).toBe(20);
      expect(typography.bodyLgElderly.fontWeight).toBe('600');
      expect(typography.bodyLgElderly.lineHeight).toBe(30);

      // headline-lg: 24px/700/32px
      expect(typography.headlineLg.fontSize).toBe(24);
      expect(typography.headlineLg.fontWeight).toBe('700');
      expect(typography.headlineLg.lineHeight).toBe(32);

      // label-caps: 12px/700/16px
      expect(typography.labelCaps.fontSize).toBe(12);
      expect(typography.labelCaps.fontWeight).toBe('700');
    });
  });

  describe('Project structure (SPEC Project Structure)', () => {
    it('should have all required route files', () => {
      const requiredRoutes = [
        'index.tsx',
        '_layout.tsx',
        '(auth)/_layout.tsx',
        '(auth)/login.tsx',
        '(auth)/register.tsx',
        '(companionee)/_layout.tsx',
        '(companionee)/index.tsx',
        '(companionee)/home.tsx',
        '(steward)/_layout.tsx',
        '(steward)/index.tsx',
        '(steward)/settings.tsx',
        '(steward)/[pairingId]/_layout.tsx',
        '(steward)/[pairingId]/index.tsx',
        '(steward)/[pairingId]/logs.tsx',
        '(steward)/[pairingId]/feed.tsx',
        '(steward)/[pairingId]/voice.tsx',
      ];

      const appBasePath = join(__dirname, '..', '..', 'app');
      for (const route of requiredRoutes) {
        const fullPath = join(appBasePath, route);
        let exists = false;
        try {
          readFileSync(fullPath);
          exists = true;
        } catch {
          exists = false;
        }
        expect(exists, `Missing route: ${route}`).toBe(true);
      }
    });

    it('should have all required service files', () => {
      const requiredServices = [
        'api.ts',
        'auth.ts',
        'pairing.ts',
        'feed.ts',
        'voice-clone.ts',
        'events.ts',
      ];

      for (const service of requiredServices) {
        const fullPath = join(srcDir, 'services', service);
        let exists = false;
        try {
          readFileSync(fullPath);
          exists = true;
        } catch {
          exists = false;
        }
        expect(exists, `Missing service: ${service}`).toBe(true);
      }
    });

    it('should have all required store files', () => {
      const requiredStores = [
        'auth-store.ts',
        'role-store.ts',
      ];

      for (const store of requiredStores) {
        const fullPath = join(srcDir, 'store', store);
        let exists = false;
        try {
          readFileSync(fullPath);
          exists = true;
        } catch {
          exists = false;
        }
        expect(exists, `Missing store: ${store}`).toBe(true);
      }
    });

    it('should NOT have old files that were cleaned up', () => {
      const elderAppRoot = join(__dirname, '..', '..');
      const oldFiles = [
        join(elderAppRoot, 'App.tsx'),
        join(srcDir, 'screens', 'BindScreen.tsx'),
        join(srcDir, 'screens', 'HomeScreen.tsx'),
      ];

      for (const file of oldFiles) {
        let exists = false;
        try {
          readFileSync(file);
          exists = true;
        } catch {
          exists = false;
        }
        expect(exists, `Old file still exists: ${file}`).toBe(false);
      }
    });
  });
});
