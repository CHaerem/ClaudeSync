describe('GitHub URL Extraction', () => {
    beforeEach(() => {
      // Reset the DOM before each test
      document.body.innerHTML = '';
    });
  
    test('extracts valid GitHub URL from description', () => {
      document.body.innerHTML = `
        <div class="text-text-300 text-sm leading-relaxed line-clamp-2">
          Project using https://github.com/user/repo
        </div>
      `;
      const url = extractGithubUrl();
      expect(url).toBe('https://github.com/user/repo');
    });
  
    test('returns null when no GitHub URL is present', () => {
      document.body.innerHTML = `
        <div class="text-text-300 text-sm leading-relaxed line-clamp-2">
          Project with no GitHub URL
        </div>
      `;
      const url = extractGithubUrl();
      expect(url).toBeNull();
    });
  });