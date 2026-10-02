const fs = require('fs');
const content = fs.readFileSync('tests/logger.test.ts', 'utf8');

const updated = content.replace(
  `    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});`,
  `    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});`
).replace(
  `    it('should fallback to console.log when token is missing', () => {
      const entry = { level: 'info' as LogLevel, message: 'Test message', timestamp: '2023-01-01', service: 'test' };
      sendLog(mockCtx, undefined, entry);

      expect(console.log).toHaveBeenCalledWith('[INFO] Test message');
      expect(mockCtx.waitUntil).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
    });`,
  `    it('should fallback to console.info when token is missing and level is info', () => {
      const entry = { level: 'info' as LogLevel, message: 'Test message', timestamp: '2023-01-01', service: 'test' };
      sendLog(mockCtx, undefined, entry);

      expect(console.info).toHaveBeenCalledWith('[INFO] Test message');
      expect(mockCtx.waitUntil).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should fallback to console.warn when token is missing and level is warn', () => {
      const entry = { level: 'warn' as LogLevel, message: 'Test warn message', timestamp: '2023-01-01', service: 'test' };
      sendLog(mockCtx, undefined, entry);

      expect(console.warn).toHaveBeenCalledWith('[WARN] Test warn message');
      expect(mockCtx.waitUntil).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should fallback to console.debug when token is missing and level is debug', () => {
      const entry = { level: 'debug' as LogLevel, message: 'Test debug message', timestamp: '2023-01-01', service: 'test' };
      sendLog(mockCtx, undefined, entry);

      expect(console.debug).toHaveBeenCalledWith('[DEBUG] Test debug message');
      expect(mockCtx.waitUntil).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
    });`
).replace(
  `      expect(console.error).toHaveBeenCalledWith('[ERROR] Test error message', '\\nSomething went wrong', '\\nError stack');
      expect(console.log).not.toHaveBeenCalled();`,
  `      expect(console.error).toHaveBeenCalledWith('[ERROR] Test error message', '\\nSomething went wrong', '\\nError stack');
      expect(console.info).not.toHaveBeenCalled();`
).replace(
  `      expect(console.error).toHaveBeenCalledWith('[ERROR] Test error message', '', '');
      expect(console.log).not.toHaveBeenCalled();`,
  `      expect(console.error).toHaveBeenCalledWith('[ERROR] Test error message', '', '');
      expect(console.info).not.toHaveBeenCalled();`
);

fs.writeFileSync('tests/logger.test.ts', updated);
