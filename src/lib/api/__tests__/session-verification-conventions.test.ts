/**
 * @jest-environment node
 *
 * Guards session invalidation. A password change or reset only kills old sessions
 * if every authorization decision goes through AuthService.validateToken (via
 * requireAuth / getCurrentUser / verifySessionToken / requireAdmin). A route that
 * calls tokenService.verify() directly accepts any correctly signed JWT, including
 * a stolen one issued before the password changed — this check catches that statically.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../../../..');
const SERVER_DIRS = ['src/app/api', 'src/lib/api', 'src/lib/auth'].map((dir) =>
  path.join(ROOT, dir)
);

function listSourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === '__tests__' ? [] : listSourceFiles(fullPath);
    }
    return /\.tsx?$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name) ? [fullPath] : [];
  });
}

describe('session verification conventions', () => {
  const files = SERVER_DIRS.flatMap(listSourceFiles);

  it('should find the API routes to inspect', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('should never authorize a request with a signature-only token check', () => {
    const offenders = files
      .filter((file) =>
        /getTokenService\(\)|tokenService\.(verify|decode)\(|jwt\.(verify|decode)\(/.test(
          fs.readFileSync(file, 'utf8')
        )
      )
      .map((file) => path.relative(ROOT, file).replace(/\\/g, '/'));

    expect(offenders).toEqual([]);
  });
});
